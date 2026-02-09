/**
 * Diagnostic script for convertRuleOtherSideWithDAG / substituteInDAG.
 * 
 * Target: left  ",\\Bb{if(i \\Ps j)}{, }{, \\Or,},"
 *         right ",i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},"
 * Rule:   left  ",\\Blb{if(i \\Ps j)}{, }{, \\Or,}, "
 *         right ",i \\Od m, j \\Od n, \\Blb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},"
 * 
 * Isomorphism found but equivalent substitution fails after conversion.
 */

import { exprToDAG, dagToExpr, SingleRootDAGInjection, substituteInDAG } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { trySubstitution } from '../src/lib/inferenceRules/substitution';
import type { ExprNodeData } from '../src/lib/dag/types';

const targetLeft = ',\\Bb{if(i \\Ps j)}{, }{, \\Or,},';
const targetRight = ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},';
const ruleLeft = ',\\Blb{if(i \\Ps j)}{, }{, \\Or,}, ';
const ruleRight = ',i \\Od m, j \\Od n, \\Blb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},';

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function logObj(label: string, obj: unknown) {
  console.log(`\n${label}:`);
  console.log(JSON.stringify(obj, (_, v) => (v instanceof Map ? Object.fromEntries(v) : v), 2));
}

function runDiagnostic() {
  logSection('CONVERT RULE OTHER SIDE WITH DAG - DIAGNOSTIC');

  console.log('\nInput expressions:');
  console.log('  Target left: ', JSON.stringify(targetLeft));
  console.log('  Target right:', JSON.stringify(targetRight));
  console.log('  Rule left:   ', JSON.stringify(ruleLeft));
  console.log('  Rule right:  ', JSON.stringify(ruleRight));

  const normalizedTarget = normalizeSpacing(targetLeft);
  const normalizedRule = normalizeSpacing(ruleLeft);
  const targetDAG = exprToDAG(normalizedTarget);
  const patternDAG = exprToDAG(normalizedRule);
  const replacementDAG = exprToDAG(normalizeSpacing(ruleRight));

  logSection('Step 1: DAG structures');
  logObj('Target DAG (from target left)', {
    nodes: targetDAG.nodes.map((n) => ({
      id: n.id,
      op: (n.data as ExprNodeData)?.op,
      operands: (n.data as ExprNodeData)?.operands,
      branchKind: (n.data as ExprNodeData & { branchKind?: string })?.branchKind,
    })),
    edges: targetDAG.edges,
  });
  logObj('Pattern DAG (from rule left)', {
    nodes: patternDAG.nodes.map((n) => ({
      id: n.id,
      op: (n.data as ExprNodeData)?.op,
      operands: (n.data as ExprNodeData)?.operands,
      branchKind: (n.data as ExprNodeData & { branchKind?: string })?.branchKind,
    })),
    edges: patternDAG.edges,
  });
  logObj('Replacement DAG (from rule right)', {
    nodes: replacementDAG.nodes.map((n) => ({
      id: n.id,
      op: (n.data as ExprNodeData)?.op,
      operands: (n.data as ExprNodeData)?.operands,
      branchKind: (n.data as ExprNodeData & { branchKind?: string })?.branchKind,
    })),
    edges: replacementDAG.edges,
  });

  console.log('\ndagToExpr of target (roundtrip check):', JSON.stringify(dagToExpr(targetDAG)));
  console.log('Expected (normalized target left):     ', JSON.stringify(normalizedTarget));
  console.log('Roundtrip match:', dagToExpr(targetDAG) === normalizedTarget ? 'YES' : 'NO');

  logSection('Step 2: VF2 isomorphism enumeration');
  let trialIdx = 0;
  for (const vf2Result of SingleRootDAGInjection(patternDAG, targetDAG)) {
    trialIdx++;
    console.log(`\n--- Trial ${trialIdx} ---`);
    const operandMapping = vf2Result.operandMapping;
    const nodeMapping = vf2Result.mapping;
    console.log('Node mapping (pattern -> target):', Object.fromEntries(nodeMapping));
    console.log('Operand mapping:', Object.fromEntries(operandMapping));

    if (!operandMapping || operandMapping.size === 0) {
      console.log('SKIP: no operand mapping');
      continue;
    }

    const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
    let candidateStart = normalizedTarget.length;
    let candidateEnd = 0;
    for (const targetId of nodeMapping.values()) {
      const node = tNodeMap.get(targetId);
      const data = node?.data as { start?: number; end?: number } | undefined;
      if (data?.start != null) candidateStart = Math.min(candidateStart, data.start);
      if (data?.end != null) candidateEnd = Math.max(candidateEnd, data.end);
    }
    console.log('Matched target span:', candidateStart, '-', candidateEnd);

    try {
      logSection(`Step 3 (Trial ${trialIdx}): substituteInDAG`);
      const merged = substituteInDAG(
        targetDAG,
        patternDAG,
        replacementDAG,
        nodeMapping,
        operandMapping
      );
      logObj('Merged DAG', {
        nodes: merged.nodes.map((n) => ({
          id: n.id,
          op: (n.data as ExprNodeData)?.op,
          operands: (n.data as ExprNodeData)?.operands,
          branchKind: (n.data as ExprNodeData & { branchKind?: string })?.branchKind,
        })),
        edges: merged.edges,
      });

      console.log('\n--- dagToExpr of merged DAG ---');
      const reconstructed = dagToExpr(merged, operandMapping);
      console.log('Reconstructed:', JSON.stringify(reconstructed));
      console.log('Expected:     ', JSON.stringify(normalizeSpacing(targetRight)));
      const match = normalizeSpacing(reconstructed) === normalizeSpacing(targetRight);
      console.log('Match:', match ? 'YES' : 'NO');

      if (!match) {
        console.log('\n!!! FAILURE: Reconstructed expression does not match expected !!!');
        console.log('Difference analysis:');
        const recNorm = normalizeSpacing(reconstructed);
        const expNorm = normalizeSpacing(targetRight);
        if (recNorm.length !== expNorm.length) {
          console.log(`  Length: reconstructed=${recNorm.length}, expected=${expNorm.length}`);
        }
        for (let i = 0; i < Math.max(recNorm.length, expNorm.length); i++) {
          if (recNorm[i] !== expNorm[i]) {
            const ctx = 30;
            const start = Math.max(0, i - ctx);
            const end = Math.min(recNorm.length, i + ctx);
            console.log(`  First diff at index ${i}:`);
            console.log(`    Reconstructed: ...${JSON.stringify(recNorm.slice(start, end))}...`);
            console.log(`    Expected:      ...${JSON.stringify(expNorm.slice(start, end))}...`);
            console.log(`    char at ${i}: rec=${JSON.stringify(recNorm[i])} exp=${JSON.stringify(expNorm[i])}`);
            break;
          }
        }
      }
    } catch (err) {
      console.error('\n!!! EXCEPTION in substituteInDAG or dagToExpr !!!');
      console.error(err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) console.error(err.stack);
    }
  }

  if (trialIdx === 0) {
    console.log('\nNo VF2 matches found - isomorphism enumeration produced zero results.');
  }

  logSection('DIAGNOSIS SUMMARY');
  console.log(`
Root cause: substituteInDAG maps pattern nodes to replacement nodes BY INDEX
(patternDAG.nodes[i] -> replacementDAG.nodes[i]). This assumes pattern and
replacement have IDENTICAL structure.

In this example:
  - Pattern (Blb): 2 nodes (cond, \\Or)
  - Replacement (rule right): 8 nodes (Od chain + full Blb with arms)

The index mapping maps cond->first Od, \\Or->second Od, which is wrong.
Boundary edges then connect sub_0 and sub_1 (the Od nodes) directly to the
tail n1, short-circuiting the rest of the replacement. dagToExpr serializes
only the first Op before hitting the tail, producing ", i \\Od m,".

Fix needed: substituteInDAG must identify replacement HEADS (entry points)
and TAILS (exit points) from the replacement DAG's own structure, not by
pattern index. Connect prefix->replacement heads, replacement tails->suffix.
`);

  logSection('Step 4: Full trySubstitution flow');
  const result = trySubstitution(
    targetLeft,
    ruleLeft,
    ruleRight,
    targetRight,
    targetLeft,
    'left'
  );
  console.log('\ntrySubstitution result:', result ? 'MATCH' : 'NO MATCH');
  if (result?.reconstructedExpr) {
    console.log('Reconstructed:', JSON.stringify(result.reconstructedExpr));
  }
}

try {
  runDiagnostic();
} catch (err) {
  console.error('Fatal:', err);
  process.exit(1);
}
