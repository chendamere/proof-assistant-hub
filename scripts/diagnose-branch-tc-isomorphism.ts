/**
 * Diagnose why VF2 doesn't find isomorphism for:
 * Target left:  ",\Bb{if(i \Pu)}{, \Bb{if(m \Pu)}{,}{,\Or,},}{, \Bb{if(m \Pu)}{, \Or,}{, \Or,},},"
 * Target right: ",\Bb{if(m \Pu)}{, \Bb{if(i \Pu)}{,}{,\Or,},}{, \Bb{if(m \Pu)}{, \Or,}{, \Or,},},"
 * Rule left:    ", \Bb{i \Oe j}{,\Bb{m \Oe n}{,\Tc c_1,}{,\Tc c_2,},}{, \Bb{m \Oe n}{,\Tc c_3,}{,\Tc c_4,},},"
 * Rule right:   ", \Bb{m \Oe n}{,\Bb{i \Oe j}{,\Tc c_1,}{,\Tc c_3,},}{, \Bb{i \Oe j}{,\Tc c_2,}{,\Tc c_4,},},"
 */

import { exprToDAG, dagToExpr, SingleRootDAGInjection, augmentTargetDAGForTcMatching } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import type { ExprNodeData } from '../src/lib/dag/types';

const targetLeft =
  ',\\Bb{if(i \\Pu)}{, \\Bb{if(m \\Pu)}{,}{,\\Or,},}{, \\Bb{if(m \\Pu)}{, \\Or,}{, \\Or,},},';
const targetRight =
  ',\\Bb{if(m \\Pu)}{, \\Bb{if(i \\Pu)}{,}{,\\Or,},}{, \\Bb{if(m \\Pu)}{, \\Or,}{, \\Or,},},';
const ruleLeft =
  ', \\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc c_1,}{,\\Tc c_2,},}{, \\Bb{m \\Oe n}{,\\Tc c_3,}{,\\Tc c_4,},},';
const ruleRight =
  ', \\Bb{m \\Oe n}{,\\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_3,},}{, \\Bb{i \\Oe j}{,\\Tc c_2,}{,\\Tc c_4,},},';

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

  logSection('STEP 1: DAG STRUCTURES');
  let targetDAG, patternDAG;
  try {
    targetDAG = exprToDAG(normTargetL);
    patternDAG = exprToDAG(normRuleL);
  } catch (err) {
    console.error('exprToDAG failed:', err);
    return;
  }

  console.log('\nPattern DAG (rule left) -', patternDAG.nodes.length, 'nodes:');
  patternDAG.nodes.forEach((n, i) => {
    const d = n.data as ExprNodeData;
    console.log(`  ${n.id}: op=${d?.op} operands=[${(d?.operands ?? []).join(',')}]`);
  });
  console.log('Edges:', patternDAG.edges.map((e) => `${e.from}->${e.to}`).join(', '));

  console.log('\nTarget DAG (target left) -', targetDAG.nodes.length, 'nodes:');
  targetDAG.nodes.forEach((n, i) => {
    const d = n.data as ExprNodeData;
    console.log(`  ${n.id}: op=${d?.op} operands=[${(d?.operands ?? []).join(',')}]`);
  });
  console.log('Edges:', targetDAG.edges.map((e) => `${e.from}->${e.to}`).join(', '));

  logSection('STEP 2: STRUCTURAL COMPARISON');
  console.log('\nPattern structure (cond/tail ops):');
  const pCondTails = patternDAG.nodes.filter(
    (n) => (n.data as ExprNodeData)?.op?.includes(':cond') || (n.data as ExprNodeData)?.op?.endsWith(':tail')
  );
  pCondTails.forEach((n) => {
    const d = n.data as ExprNodeData;
    console.log(`  ${n.id}: ${d?.op}`);
  });

  console.log('\nTarget structure (cond/tail ops):');
  const tCondTails = targetDAG.nodes.filter(
    (n) => (n.data as ExprNodeData)?.op?.includes(':cond') || (n.data as ExprNodeData)?.op?.endsWith(':tail')
  );
  tCondTails.forEach((n) => {
    const d = n.data as ExprNodeData;
    console.log(`  ${n.id}: ${d?.op}`);
  });

  console.log('\nKey difference: Pattern uses \\Oe (i \\Oe j, m \\Oe n), Target uses \\Pu (i \\Pu, m \\Pu)');
  console.log('VF2 now treats \\Oe and \\Pu as compatible (first operand only).');
  console.log('Augmenting target with empty placeholders for \\Tc->empty arms so node count matches.');

  if (patternDAG.nodes.length > targetDAG.nodes.length) {
    targetDAG = augmentTargetDAGForTcMatching(targetDAG);
    console.log('\nTarget DAG after augmentation -', targetDAG.nodes.length, 'nodes');
  }

  logSection('STEP 3: VF2 ISOMORPHISM');
  let vf2Count = 0;
  for (const vf2Result of SingleRootDAGInjection(patternDAG, targetDAG)) {
    vf2Count++;
    console.log(`\n--- Match ${vf2Count} ---`);
    console.log('Node mapping:', Object.fromEntries(vf2Result.mapping));
    console.log('Operand mapping:', Object.fromEntries(vf2Result.operandMapping));
  }

  if (vf2Count === 0) {
    console.log('\nNO VF2 MATCHES FOUND.');
    console.log('\nDIAGNOSIS:');
    console.log('- Pattern conditions: i \\Oe j (equals), m \\Oe n (equals)');
    console.log('- Target conditions:  i \\Pu (defined), m \\Pu (defined)');
    console.log('- VF2 requires identical operator structure: :cond:\\Oe !== :cond:\\Pe');
    console.log('- The rule swaps nesting (outer i\\Oe j, inner m\\Oe n) <-> (outer m\\Oe n, inner i\\Oe j)');
    console.log('- Target has outer i\\Pu, inner m\\Pu vs outer m\\Pu, inner i\\Pu - same swap pattern');
    console.log('- But \\Oe and \\Pu are different ops, so node-by-node matching fails.');
  }

  logSection('STEP 4: NORMALIZE BRANCH OP CHECK');
  console.log('\nIn vf2Expr, normalizeBranchOp maps branch ops for comparison.');
  console.log(':cond:\\Oe -> :cond:\\Oe');
  console.log(':cond:\\Pe -> :cond:\\Pe');
  console.log(':cond:\\Pu -> :cond:\\Pu');
  console.log('These are all different - no match.');
}

runDiagnostic();
