/**
 * Diagnose why no equivalent substitution for:
 * Target left:  ",i \Od m, j \Od n, \Bb{if(m \Pe n)}{,m \Os, n \Os, }{,m \Os, n \Os, \Or,},"
 * Target right: ",i \Od m, j \Od n, \Bb{if(m \Pe n)}{,m \Os, n \Os, }{, m \Os,\Or,},"
 * Rule left:    ",i \Os, \Or,"
 * Rule right:   ", \Or,"
 *
 * Expected: rule matches in bottom arm (replace ", n \Os, \Or," with ", \Or," via i→n)
 */

import { exprToDAG, dagToExpr, vf2ExprSubgraphIsomorphismAll, substituteInDAG } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { trySubstitution } from '../src/lib/inferenceRules/substitution';
import type { ExprNodeData } from '../src/lib/dag/types';

const targetLeft =
  ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},';
const targetRight =
  ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{, m \\Os,\\Or,},';
const ruleLeft = ',i \\Os, \\Or,';
const ruleRight = ', \\Or,';

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function runDiagnostic() {
  logSection('INPUT');
  console.log('Target left: ', JSON.stringify(targetLeft));
  console.log('Target right:', JSON.stringify(targetRight));
  console.log('Rule left:   ', JSON.stringify(ruleLeft));
  console.log('Rule right:  ', JSON.stringify(ruleRight));

  const normTargetL = normalizeSpacing(targetLeft);
  const normTargetR = normalizeSpacing(targetRight);
  const normRuleL = normalizeSpacing(ruleLeft);
  const normRuleR = normalizeSpacing(ruleRight);

  let normExpected = normalizeSpacing(targetRight);
  try {
    normExpected = normalizeSpacing(dagToExpr(exprToDAG(normExpected)));
  } catch {
    // keep
  }
  console.log('\nNormalized expected (roundtrip):', JSON.stringify(normExpected));

  logSection('STEP 1: DAG STRUCTURES');
  const targetDAG = exprToDAG(normTargetL);
  const patternDAG = exprToDAG(normRuleL);
  const replacementDAG = exprToDAG(normRuleR);

  console.log('\nPattern DAG (rule left):');
  console.log('  nodes:', patternDAG.nodes.length);
  patternDAG.nodes.forEach((n, i) => {
    const d = n.data as ExprNodeData;
    console.log(`    ${i}: ${n.id} op=${d?.op} operands=[${(d?.operands ?? []).join(',')}]`);
  });
  console.log('  edges:', patternDAG.edges.length);

  console.log('\nTarget DAG (target left):');
  console.log('  nodes:', targetDAG.nodes.length);
  targetDAG.nodes.forEach((n, i) => {
    const d = n.data as ExprNodeData;
    console.log(`    ${i}: ${n.id} op=${d?.op} operands=[${(d?.operands ?? []).join(',')}] start=${d?.start} end=${d?.end}`);
  });
  console.log('  edges:', targetDAG.edges.length);

  logSection('STEP 2: VF2 ISOMORPHISM - does pattern match in target?');
  let vf2Count = 0;
  for (const vf2Result of vf2ExprSubgraphIsomorphismAll(patternDAG, targetDAG)) {
    vf2Count++;
    console.log(`\n--- Match ${vf2Count} ---`);
    const mapping = vf2Result.mapping;
    const opMap = vf2Result.operandMapping;
    console.log('Node mapping (pattern -> target):', Object.fromEntries(mapping));
    console.log('Operand mapping:', Object.fromEntries(opMap));

    if (opMap.size === 0) {
      console.log('SKIP: empty operand mapping');
      continue;
    }

    const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
    let start = normTargetL.length;
    let end = 0;
    for (const tid of mapping.values()) {
      const node = tNodeMap.get(tid);
      const d = node?.data as { start?: number; end?: number } | undefined;
      if (d?.start != null) start = Math.min(start, d.start);
      if (d?.end != null) end = Math.max(end, d.end);
    }
    console.log('Matched span in target:', start, '-', end);
    console.log('Matched substring:', JSON.stringify(normTargetL.slice(start, end)));

    try {
      const merged = substituteInDAG(
        targetDAG,
        patternDAG,
        replacementDAG,
        mapping,
        opMap
      );
      const reconstructed = dagToExpr(merged); // no operandMapping - applySubst already substituted replacement nodes
      const match = normalizeSpacing(reconstructed) === normExpected;
      console.log('\nReconstructed:', JSON.stringify(reconstructed));
      console.log('Expected:     ', JSON.stringify(normExpected));
      console.log('Match:', match ? 'YES' : 'NO');

      if (!match) {
        console.log('\nCharacter diff:');
        const rec = normalizeSpacing(reconstructed);
        const exp = normExpected;
        for (let i = 0; i < Math.max(rec.length, exp.length); i++) {
          if (rec[i] !== exp[i]) {
            const ctx = 40;
            console.log('  First diff at index', i);
            console.log('  Rec:', JSON.stringify(rec.slice(Math.max(0, i - ctx), i + ctx)));
            console.log('  Exp:', JSON.stringify(exp.slice(Math.max(0, i - ctx), i + ctx)));
            break;
          }
        }
      }
    } catch (err) {
      console.error('Exception:', err instanceof Error ? err.message : String(err));
    }
  }

  if (vf2Count === 0) {
    console.log('\nNO VF2 MATCHES FOUND - pattern does not occur as subgraph in target.');
    console.log('\nPossible causes:');
    console.log('- Pattern ",i \\Os, \\Or," has 2 nodes (\\Os, \\Or). Target bottom arm has m \\Os, n \\Os, \\Or.');
    console.log('- VF2 may match \\Os+\\Or in the bottom arm, but structure/connectivity might differ.');
    console.log('- Pattern is a linear chain; target has branch structure - subgraph must match within an arm.');
  }

  logSection('STEP 3: ALL 4 TRYSUBSTITUTION DIRECTIONS');
  const attempts = [
    { target: targetLeft, ruleL: ruleLeft, ruleR: ruleRight, expected: targetRight, side: 'left', label: 'left: ruleL->ruleR in target left -> right' },
    { target: targetLeft, ruleL: ruleRight, ruleR: ruleLeft, expected: targetRight, side: 'left', label: 'left: ruleR->ruleL in target left -> right' },
    { target: targetRight, ruleL: ruleLeft, ruleR: ruleRight, expected: targetLeft, side: 'right', label: 'right: ruleL->ruleR in target right -> left' },
    { target: targetRight, ruleL: ruleRight, ruleR: ruleLeft, expected: targetLeft, side: 'right', label: 'right: ruleR->ruleL in target right -> left' },
  ];

  for (const a of attempts) {
    const r = trySubstitution(a.target, a.ruleL, a.ruleR, a.expected, a.target, a.side);
    console.log(`\n${a.label}:`, r ? 'MATCH' : 'no match');
  }

  logSection('SUMMARY');
  console.log(`
Rule: ",i \\Os, \\Or," -> ", \\Or," (remove operand before \\Os when followed by \\Or)
Target left bottom arm:  ",m \\Os, n \\Os, \\Or,"
Target right bottom arm: ", m \\Os,\\Or," (no n \\Os)

Expected transformation: In bottom arm, ", n \\Os, \\Or," matches pattern (i->n), 
replace with ", \\Or," -> ",m \\Os, \\Or," which equals right bottom arm.

Diagnosis: Check above whether VF2 finds the match and whether substituteInDAG produces correct result.
`);
}

runDiagnostic();
