import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

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

function check(thm: number, step: number) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::' + thm + '::') && x.step === step);
  if (!f) {
    console.log(thm, 's' + step, 'gone');
    return;
  }
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  const index = buildRuleIndex(
    all.filter((r) => r.pos < pos),
    new Map()
  );
  const A = ensure(f.left);
  const B = ensure(f.right);
  if (matchesDerivedBbTransition(A, B)) {
    console.log(thm, 's' + step, 'DERIVED');
    return;
  }
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      console.log(thm, 's' + step, rule.id);
      return;
    }
  }
  console.log(thm, 's' + step, 'OPEN');
  console.log('  L', f.left.slice(0, 100));
  console.log('  R', f.right.slice(0, 100));
}

for (const [t, s] of [
  [144, 7],
  [132, 3],
  [129, 10],
  [129, 12],
  [135, 0],
  [135, 1],
  [145, 0],
  [145, 19],
  [23, 0],
  [122, 2],
  [122, 4],
] as [number, number][]) {
  check(t, s);
}

// 144 s7: reverse of subnode expand?
const sub0 = all.find((r) => r.id.includes('relationship-of-subnode-0'));
console.log('\nsub0', sub0?.id, '\n L', sub0?.leftSide.slice(0, 100), '\n R', sub0?.rightSide.slice(0, 120));
const f144 = fails.find((x: { key: string; step: number }) => x.key.includes('::144::') && x.step === 7);
if (f144) {
  console.log('144s7 L', f144.left);
  console.log('144s7 R', f144.right);
}
