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
const f = fails.find(
  (x: { key: string; step: number }) => x.key.includes('::129::') && x.step === 12
)!;
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

const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);
console.log('direct', j(L, R));

// Mid: Ps in both outer arms only (pulled from inner), then pull out
// First: subst i Od n → j Od n via Ps in false of Pc Bb
const substOd = L.replace(
  '{,i \\Ps j,i \\Od n,}',
  '{,i \\Ps j,j \\Od n,}'
);
console.log('L->substOd', j(L, substOd));

// Pull Ps out of Pc Bb both arms (rev connectivity-29)
const outPc = substOd.replace(
  '{,i \\Ps j,\\Ot n,}{,i \\Ps j,j \\Od n,}',
  '{,\\Ot n,}{,j \\Od n,}'
).replace(
  // need Ps before Bb after pull
  '\\Bb{m \\Pc t}{,\\Ot n,}{,j \\Od n,}',
  'i \\Ps j,\\Bb{m \\Pc t}{,\\Ot n,}{,j \\Od n,}'
);
// careful rebuild
const outPc2 = L.replace(
  '{,j \\Ob m,\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,j \\Od n,},m \\Os,}',
  '{,j \\Ob m,i \\Ps j,\\Bb{m \\Pc t}{,\\Ot n,}{,j \\Od n,},m \\Os,}'
);
console.log('L->outPc2 (pull+subst combined?)', j(L, outPc2));

// Stepwise: subst first via identical-on-Od?
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Ps/.test(r.leftSide) || !/\\Od/.test(r.leftSide + r.rightSide)) continue;
  if (r.leftSide.length > 90) continue;
  console.log(r.id, r.leftSide, '=>', r.rightSide);
}
