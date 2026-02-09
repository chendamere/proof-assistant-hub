/**
 * Diagnosis: SingleRootDAGInjection performance when target and pattern both contain branches.
 * Measures: iterations, time per root attempt, total matches, substitution trial cost.
 */

import {
  exprToDAG,
  SingleRootDAGInjection,
  augmentTargetDAGForTcMatching,
} from '../src/lib/dag';
import { trySubstitution } from '../src/lib/inferenceRules/substitution';
import { checkInferenceRules } from '../src/lib/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/lib/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { axioms } from '../src/data/axioms';
import { definitions } from '../src/data/definitions';
import { theorems } from '../src/data/theorems';
import type { DAGStructure, ExprNodeData } from '../src/lib/dag/types';

function timeMs(): number {
  return performance.now();
}

function roundMs(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(1)}µs` : `${ms.toFixed(2)}ms`;
}

/** Count root attempts and match yields for SingleRootDAGInjection */
function diagnoseSingleRoot(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>,
  label: string
) {
  const tNodes = target.nodes.map((n) => n.id);
  const pNodes = pattern.nodes.map((n) => n.id);

  const t0 = timeMs();
  let matchCount = 0;
  let firstMatchAt: number | null = null;
  for (const r of SingleRootDAGInjection(pattern, target)) {
    matchCount++;
    if (firstMatchAt === null) firstMatchAt = timeMs() - t0;
  }
  const totalMs = timeMs() - t0;

  console.log(`\n--- ${label} ---`);
  console.log(`  Pattern nodes: ${pNodes.length}, Target nodes: ${tNodes.length}`);
  console.log(`  Root attempts: ${tNodes.length} (every target node tried as root)`);
  console.log(`  Matches found: ${matchCount}`);
  console.log(`  First match at: ${firstMatchAt != null ? roundMs(firstMatchAt) : 'N/A'}`);
  console.log(`  Total time: ${roundMs(totalMs)}`);
  if (tNodes.length > 0) {
    console.log(`  Per-root avg: ${roundMs(totalMs / tNodes.length)}`);
  }
}

/** Time full trySubstitution flow (4 directions, each iterating SingleRootDAGInjection) */
function diagnoseTrySubstitution(
  targetLeft: string,
  targetRight: string,
  ruleLeft: string,
  ruleRight: string,
  label: string
) {
  console.log(`\n=== ${label} ===`);
  const t0 = timeMs();
  const result = trySubstitution(
    targetLeft,
    ruleLeft,
    ruleRight,
    targetRight,
    targetLeft,
    'left'
  );
  const ms = timeMs() - t0;
  console.log(`  Result: ${result ? 'MATCH' : 'no match'}`);
  console.log(`  Time: ${roundMs(ms)}`);
  return { result, ms };
}

/** Stress: branch within branch, varying depth */
function runBranchStress() {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS: Branch-within-branch (both sides have branches)');
  console.log('='.repeat(60));

  // Pattern: 2 levels of nesting
  const patternExpr = ',\\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,a \\Or,}{,b \\Or,},}{,c \\Or,},';
  // Target: same structure
  const targetExpr = ',\\Bb{if(i \\Pu)}{,\\Bb{if(m \\Pu)}{,1 \\Or,}{,2 \\Or,},}{,3 \\Or,},';

  const pattern = exprToDAG(normalizeSpacing(patternExpr));
  const target = exprToDAG(normalizeSpacing(targetExpr));

  diagnoseSingleRoot(pattern, target, '2-level branch both sides');

  // Full trySubstitution
  diagnoseTrySubstitution(
    targetExpr,
    targetExpr,
    patternExpr.replace(/\\Oe/g, '\\Pu').replace(/\\Bb/g, '\\Bb{if'),
    patternExpr.replace(/\\Oe/g, '\\Pu').replace(/\\Bb/g, '\\Bb{if'),
    'trySubstitution (equiv match)'
  );
}

/** Stress: larger target with multiple branch arms */
function runLargeTargetStress() {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS: Large target (many nodes)');
  console.log('='.repeat(60));

  const patternExpr = ',x \\Or,';
  const targetExpr =
    ',\\Bb{if(1 \\Pu)}{,\\Bb{if(2 \\Pu)}{,1 \\Or,}{,2 \\Or,},}{,\\Bb{if(3 \\Pu)}{,3 \\Or,}{,4 \\Or,},},';

  const pattern = exprToDAG(normalizeSpacing(patternExpr));
  const target = exprToDAG(normalizeSpacing(targetExpr));

  diagnoseSingleRoot(pattern, target, 'Pattern 1 node, Target 9 nodes (many roots to try)');

  // Pattern with branches matching target with branches
  const pattern2Expr = ',\\Bb{i \\Oe j}{,a \\Or,}{,b \\Or,},';
  const target2Expr =
    ',\\Bb{if(1 \\Pu)}{,1 \\Or,}{,2 \\Or,},\\Bb{if(2 \\Pu)}{,3 \\Or,}{,4 \\Or,},';
  const pattern2 = exprToDAG(normalizeSpacing(pattern2Expr));
  const target2 = exprToDAG(normalizeSpacing(target2Expr));

  diagnoseSingleRoot(pattern2, target2, 'Pattern 4 nodes, Target 8 nodes (2 top-level branches)');
}

/** Stress: Tc pattern (pattern > target, augmentation) */
function runTcStress() {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS: \\Tc (pattern > target, augmentation)');
  console.log('='.repeat(60));

  const patternExpr =
    ', \\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc c_1,}{,\\Tc c_2,},}{, \\Bb{m \\Oe n}{,\\Tc c_3,}{,\\Tc c_4,},},';
  const targetExpr =
    ',\\Bb{if(i \\Pu)}{, \\Bb{if(m \\Pu)}{,}{,\\Or,},}{, \\Bb{if(m \\Pu)}{, \\Or,}{, \\Or,},},';

  let pattern = exprToDAG(normalizeSpacing(patternExpr));
  let target = exprToDAG(normalizeSpacing(targetExpr));
  if (pattern.nodes.length > target.nodes.length) {
    target = augmentTargetDAGForTcMatching(target) as DAGStructure<ExprNodeData>;
  }

  diagnoseSingleRoot(pattern, target, 'Tc: 10 pattern nodes, augmented target');
}

/** Time complexity summary */
function printComplexityAnalysis() {
  console.log('\n' + '='.repeat(60));
  console.log('TIME COMPLEXITY ANALYSIS: SingleRootDAGInjection');
  console.log('='.repeat(60));
  console.log(`
Let:
  T = number of target nodes
  P = number of pattern nodes
  d = max node degree (outgoing edges)

SingleRootDAGInjection structure:
  1. Outer loop: tries EACH target node as root → O(T) iterations
  2. Per iteration: fillMap(pStart, tStart) does recursive match
  3. fillMap is DETERMINISTIC: for each pattern node, findOutgoingWithType returns
     exactly one target node (by edge type). No backtracking over alternatives.
  4. fillMap depth: O(P) recursive levels
  5. Per level: getOutgoingWithTypes O(d), findOutgoingWithType O(d), exprDataMatches O(1)

SingleRootDAGInjection per run: O(T × P × d)

Try-substitution flow:
  - 4 directions (left/right, rule normal/reversed)
  - Each direction: iterates SingleRootDAGInjection until match OR maxTrials (32–64)
  - Per match: convertRuleOtherSideWithDAG (substituteInDAG, dagToExpr, resolveOperandMapping)

Worst case: 4 × min(M, maxTrials) × (SingleRoot cost + convertRuleOtherSideWithDAG cost)
  where M = number of matches yielded by SingleRootDAGInjection (up to T)

BOTTLENECK when both have branches:
  - T can be large (e.g. 20–50 nodes for nested branches)
  - We try ALL T nodes as root even when only 1–2 are valid
  - No early pruning: wrong root fails only after full fillMap traversal
  - convertRuleOtherSideWithDAG is called for each match attempt (substituteInDAG is non-trivial)
`);
}

/** Simulate proof step verification: compare unfiltered vs filtered by op-count delta */
function runProofVerificationStress() {
  console.log('\n' + '='.repeat(60));
  console.log('STRESS: Simulated proof step verification (many rules, branch expressions)');
  console.log('='.repeat(60));

  // Realistic branch expressions from proof-steps-table
  const targetLeft =
    ',i \\Oc i_0, i_0 \\Os, \\In \\Ps i, \\Bb{if(i \\Pe j)}{,\\Tc c_1,}{,\\Tc c_2,},';
  const targetRight =
    ',i \\Oc i_0, \\Bb{if(i \\Pe j)}{, \\In \\Ps i, i_0 \\Os,\\Tc c_1,}{, \\In \\Ps i, i_0 \\Os,\\Tc c_2,},';

  const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
    id: r.id,
    leftSide: r.leftSide,
    rightSide: r.rightSide,
  }));

  // Unfiltered: first 100 rules
  const rulesUnfiltered = allRules.slice(0, 100);
  const t0 = timeMs();
  let rulesChecked = 0;
  let matched = false;
  for (const rule of rulesUnfiltered) {
    const result = checkInferenceRules(
      targetLeft,
      targetRight,
      rule.leftSide,
      rule.rightSide
    );
    rulesChecked++;
    if (result.match) {
      matched = true;
      break;
    }
  }
  const msUnfiltered = timeMs() - t0;

  // Filtered: build index, get rules for transition
  const index = buildRuleIndex(allRules);
  const rulesFiltered = getRulesForTransition(index, targetLeft, targetRight);
  const t1 = timeMs();
  let rulesCheckedFiltered = 0;
  let matchedFiltered = false;
  for (const rule of rulesFiltered) {
    const result = checkInferenceRules(
      targetLeft,
      targetRight,
      rule.leftSide,
      rule.rightSide
    );
    rulesCheckedFiltered++;
    if (result.match) {
      matchedFiltered = true;
      break;
    }
  }
  const msFiltered = timeMs() - t1;

  console.log(`\n--- Verify 1 transition (left -> right with branches) ---`);
  console.log(`  Unfiltered (first 100 rules): ${rulesChecked} tried, matched=${matched}, ${roundMs(msUnfiltered)}`);
  console.log(`  Filtered by op-count delta: ${rulesFiltered.length} rules to try (of ${allRules.length})`);
  console.log(`  Filtered run: ${rulesCheckedFiltered} tried, matched=${matchedFiltered}, ${roundMs(msFiltered)}`);
  console.log(`  Index build + filtered check: ${roundMs(msFiltered)}`);
}

// Run
console.log('SingleRootDAGInjection Performance Diagnosis');
runBranchStress();
runLargeTargetStress();
runTcStress();
runProofVerificationStress();
printComplexityAnalysis();
