/**
 * Debug script for vf2ExprSubgraphIsomorphism.
 * Tests the single-match VF2 function with example pattern/target pairs.
 */

import {
  exprToDAG,
  vf2ExprSubgraphIsomorphism,
  augmentTargetDAGForTcMatching,
} from '../src/lib/dag';
import { SingleRootDAGInjection } from '../src/lib/dag/vf2Expr';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import type { ExprNodeData } from '../src/lib/dag/types';

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function runTest(
  label: string,
  patternExpr: string,
  targetExpr: string,
  augment = false
) {
  logSection(label);
  const pattern = exprToDAG(normalizeSpacing(patternExpr));
  let target = exprToDAG(normalizeSpacing(targetExpr));

// 

  console.log('\nPattern:', JSON.stringify(patternExpr));
  console.log('Nodes:', pattern.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', '));

  console.log('\nTarget:', JSON.stringify(targetExpr));
  console.log('Nodes:', target.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', '));

  const result = vf2ExprSubgraphIsomorphism(pattern, target);

  if (result) {
    console.log('\n--- MATCH FOUND ---');
    console.log('Node mapping (pattern -> target):', Object.fromEntries(result.mapping));
    console.log('Operand mapping:', Object.fromEntries(result.operandMapping));
  } else {
    console.log('\n--- NO MATCH ---');
    console.log('vf2ExprSubgraphIsomorphism returned null.');
  }
}
function runTest2(
  label: string,
  patternExpr: string,
  targetExpr: string,
  augment = false
) {
  logSection(label);
  const pattern = exprToDAG(normalizeSpacing(patternExpr));
  let target = exprToDAG(normalizeSpacing(targetExpr));

// 

  console.log('\nPattern:', JSON.stringify(patternExpr));
  console.log('Nodes:', pattern.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', '));

  console.log('\nTarget:', JSON.stringify(targetExpr));
  console.log('Nodes:', target.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', '));

  let matchCount = 0;
  for (const result of SingleRootDAGInjection(pattern, target)) {
    matchCount++;
    console.log(`\n--- MATCH ${matchCount} ---`);
    console.log('Node mapping (pattern -> target):', Object.fromEntries(result.mapping));
    console.log('Operand mapping:', Object.fromEntries(result.operandMapping));
  }
  if (matchCount === 0) {
    console.log('\n--- NO MATCH ---');
    console.log('SingleRootDAGInjection returned no matches.');
  }
}

// Example 1: Simple chain - pattern ",i \\Os, \\Or," matches in target
// runTest(
//   'Example 1: Simple pattern in chain target',
//   ',i \\Os, \\Or,',
//   ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},'
// );

// Example 2: Branch structure with \\Tc and \\Oe/\\Pu compatibility
// runTest(
//   'Example 2: Branch pattern with empty-arm augmentation',
//   ', \\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc c_1,}{,\\Tc c_2,},}{, \\Bb{m \\Oe n}{,\\Tc c_3,}{,\\Tc c_4,},},',
//   ',\\Bb{if(i \\Pu)}{, \\Bb{if(m \\Pu)}{,}{,\\Or,},}{, \\Bb{if(m \\Pu)}{, \\Or,}{, \\Or,},},',
//   true
// );

// Example 3: No match - pattern too large
// runTest('Example 3: Pattern larger than target (no match)', ',a \\Os, b \\Os, \\Or,', ',x \\Or,');

// Example 4: Exact match
// runTest('Example 4: Exact match', ',x \\Or,', ',x \\Or,');


runTest2('Example 1: Simple pattern in chain target',
  ',i \\Os, \\Or,',
  ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},'
);