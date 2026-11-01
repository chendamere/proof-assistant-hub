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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 129;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

for (const f of fails.filter((x: { key: string }) => x.key.includes('::129::'))) {
  console.log('\n=== s' + f.step);
  console.log('L', f.left);
  console.log('R', f.right);
  console.log('direct', j(f.left, f.right));
}

// s10: drop Pn, push Ps into Bb both arms
const f10 = fails.find(
  (x: { key: string; step: number }) => x.key.includes('::129::') && x.step === 10
)!;
const L = ensure(f10.left);
const dropPn = L.replace('{,\\Ot n,n \\Pn n,}', '{,\\Ot n,}');
console.log('s10 dropPn', j(L, dropPn));
const intoPs = dropPn.replace(
  '{,j \\Ob m,i \\Ps j,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,}',
  '{,j \\Ob m,\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,i \\Od n,},m \\Os,}'
);
console.log('dropPn->intoPs', j(dropPn, intoPs));
console.log('intoPs->R', j(intoPs, f10.right), 'eq', intoPs === ensure(f10.right));

// Ps into Pc Bb rules
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Ps/.test(r.leftSide) || !/\\Pc/.test(r.leftSide + r.rightSide)) continue;
  if (!/\\Bb/.test(r.leftSide + r.rightSide)) continue;
  if (r.leftSide.length > 110) continue;
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}
