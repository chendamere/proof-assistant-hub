import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const POS = 13 * 100000 + 124;
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < POS),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const base =
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps i_2,i_2 \\Ps j_1,';
const drop =
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_2 \\Ps j_1,';
console.log('drop bridge', justify(base, drop));

const L62 =
  ',i \\Ps i_1,i \\On,i_1 \\Pu,i_1 \\On,i_1 \\Op,R\\_(i_1),i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';
const mid = ',i \\Ps i_1,i \\On,i_1 \\Pu,i_1 \\On,i_1 \\Op,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';
console.log('drop R_ via prev-1?', justify(L62, mid));

const onlyR = ensure(L62.replace(',R\\_(i_1),', ','));
console.log('drop only R_', justify(L62, onlyR), onlyR);

// prev-1 needs i Pu adjacent conceptually - try with just those atoms
console.log(
  'prev-1 isolated',
  justify(',i_1 \\Pu,R\\_(i_1),', ',i_1 \\Pu,')
);

// case focus without shell
const bb =
  ',\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}{,i \\nPu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),},';
const arm = ',i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),';
console.log('bare Bb focus', justify(bb, arm));
console.log(
  'null54',
  justify(',i \\Pu,' + bb.slice(1), ',i \\Pu,' + arm.slice(1))
);
