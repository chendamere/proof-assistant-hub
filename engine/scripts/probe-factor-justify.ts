import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { exprToDAG, countOperations, extractOperators } from '../src/dag';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { armFactorStep } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const fail = JSON.parse(
  fs.readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8').split('\n')[0]!
) as { key: string; left: string; right: string };
const rule = theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-12-mcnlbif')!;
const cur = normalizeSpacing(fail.left);
const goal = normalizeSpacing(fail.right);
const fact = armFactorStep(cur, goal);
console.log('fact?', !!fact, fact?.slice(0, 100));
console.log('raw match', fact && checkInferenceRules(cur, fact, rule.leftSide, rule.rightSide).match);
if (!fact) process.exit(1);

const leftDAG = exprToDAG(normalizeSpacing(fail.left));
const factDAG = exprToDAG(normalizeSpacing(fact));
console.log('delta', countOperations(factDAG) - countOperations(leftDAG));
console.log('opsL', [...extractOperators(leftDAG)]);
console.log('opsF', [...extractOperators(factDAG)]);

const ruleL = exprToDAG(normalizeSpacing(rule.leftSide));
const ruleR = exprToDAG(normalizeSpacing(rule.rightSide));
console.log('rule delta', countOperations(ruleR) - countOperations(ruleL));

import { earlyRulePosition } from '../../src/data/rulePosition';
const CHAPTER_ORDER = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison',
  'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand',
  'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction',
  'Recursive_Function_R',
  'Previous_Order_Induction',
  'Recursive_Function_R_Prev',
  'Rules_of_Node_Ring',
  'Rules_of_Node_Connectivity',
];
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function getPositionForRule(r: { id: string }): number {
  const early = earlyRulePosition(r.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(r.id) || definitionIds.has(r.id)) return -1;
  const m = r.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}
const thmPos = 13 * 100000 + 24;
console.log('rule pos', getPositionForRule(rule), 'thm pos', thmPos);
const prior = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: getPositionForRule(r) }))
  .filter((r) => r.pos < thmPos);
console.log('prior', prior.length, 'has12', prior.some((r) => r.id === rule.id));
const index = buildRuleIndex(prior);
const toTry = getRulesForTransition(index, fail.left, fact);
console.log('toTry', toTry.length, 'has12', toTry.some((r) => r.id === rule.id));
let found = false;
for (const r of toTry) {
  if (checkInferenceRules(fail.left, fact, r.leftSide, r.rightSide, { dagCache: index.dagCache }).match) {
    console.log('first match', r.id);
    found = true;
    break;
  }
}
console.log('any match', found);
