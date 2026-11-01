import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { expandSim } from '../src/inferenceRules/sim';

const CO = [
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
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 14)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function jExact(a: string, b: string, id: string) {
  const rule = all.find((r) => r.id === id)!;
  const A = ensure(a);
  const B = ensure(b);
  return checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match;
}

const L = f.left as string;
const R = f.right as string;
console.log('sim expand 320', expandSim(',\\Ot i,', ',\\sim, i \\Pn i,'));

// Drop one Pn inside true arm
const drop1 = L.replace('s_2 \\Pn s_2,s_2 \\Pn s_2,', 's_2 \\Pn s_2,');
console.log('L->drop1', j(L, drop1), 'exact320', jExact(L, drop1, 'rules-of-node-continuity-320-tiini'));
console.log('drop1->L', j(drop1, L));

const drop2 = drop1.replace('s_2 \\Pn s_2,', '');
console.log('drop1->drop2', j(drop1, drop2), 'exact320', jExact(drop1, drop2, 'rules-of-node-continuity-320-tiini'));

// Add Pe via temp-value-equal
const withPe = drop2.replace('{\\,\\Ot s_1,\\Ot s_2,}', '{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}');
// careful: after drop2 true arm is {,Ot s1,Ot s2,}
const withPe2 = drop2.replace(
  '{,\\Ot s_1,\\Ot s_2,}',
  '{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}'
);
console.log('drop2 true', drop2.match(/\\Bb\{[^}]+\}(\{[^}]*\})/)?.[1]);
console.log('drop2->withPe', j(drop2, withPe2), 'exact tve', jExact(drop2, withPe2, 'temp-value-equal'));

// Reorder Od
const peOd = withPe2.replace('{,i \\Od s_2,i \\Od s_1,}', '{,i \\Od s_1,i \\Od s_2,}');
console.log('withPe->peOd', j(withPe2, peOd));
console.log('peOd->R', j(peOd, R));

// Combined: drop both at once? collapse double then drop
const collapse = L.replace('s_2 \\Pn s_2,s_2 \\Pn s_2,', 's_2 \\Pn s_2,');
console.log('collapse via 311', jExact(L, collapse, 'rules-of-node-continuity-311-iniini'));

// Full chain intermediates for apply
const steps = [L, drop1, drop2, withPe2, peOd, R];
for (let i = 0; i < steps.length - 1; i++) {
  console.log(`hop${i}`, j(steps[i]!, steps[i + 1]!));
}
