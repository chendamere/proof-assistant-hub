import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
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
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
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
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x: { key: string; right: string }) =>
    x.key.includes('::129::') && x.right.includes('i \\Ps j') && x.right.includes('\\Bb{j \\Pu}')
)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 129;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const id of [
    'subst-identical-id',
    'rules-of-three-fundamental-relationships-11-isjidt',
    'theorems-of-identical-node-comparison-29-msnbifi',
    'swap-theorems-of-same-operand-65-isjbifi',
  ]) {
    const rule = all.find((r) => r.id === id)!;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return id;
  }
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(f.left);
const R = ensure(f.right);
const subst = L.replace('{,i \\Ps j,i \\Od n,}', '{,i \\Ps j,j \\Od n,}');
const pulled = subst.replace(
  '\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,j \\Od n,}',
  'i \\Ps j,\\Bb{m \\Pc t}{,\\Ot n,}{,j \\Od n,}'
);
const peFront = pulled.replace('{,j \\Ob m,i \\Ps j,', '{,i \\Ps j,j \\Ob m,');
const outerPull = ensure(
  peFront
    .replace('{,i \\Ps j,j \\Od n,}', '{,j \\Od n,}')
    .replace('{,i \\Ps j,j \\Ob m,', '{,j \\Ob m,')
    .replace(',\\Bb{j \\Pu}', ',i \\Ps j,\\Bb{j \\Pu}')
);

console.log('L->subst', j(L, subst));
console.log('subst->pulled', j(subst, pulled));
console.log('pulled->peFront', j(pulled, peFront));
console.log('peFront->outer', j(peFront, outerPull));
console.log('outer==R', outerPull === R, j(outerPull, R));
console.log('chain', [L, subst, pulled, peFront, outerPull, R].map((x, i, a) => (i ? j(a[i - 1]!, x) : 'start')));
