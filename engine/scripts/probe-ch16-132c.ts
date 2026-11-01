import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
const f = fails.find((x: { key: string }) => x.key.includes('::132::'))!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 132;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  for (const id of [
    'rules-of-node-connectivity-106-icjbifj',
    'rules-of-node-connectivity-??',
  ]) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return id;
  }
  // find Pc commute id
  const sym = all.find(
    (r) => r.leftSide.replace(/\s/g, '') === ',i\\Pc j,' && r.rightSide.replace(/\s/g, '') === ',j\\Pc i,'
  );
  if (sym) {
    if (
      checkInferenceRules(ensure(a), ensure(b), sym.leftSide, sym.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return sym.id;
  }
  return null;
}

const L = ensure(f.left);
const R = ensure(f.right);
console.log('sym', all.find((r) => r.leftSide.includes('i \\Pc j') && r.rightSide.includes('j \\Pc i'))?.id);

// Path: flip i Pc j → j Pc i in false arm, then 106: j Pc i, Bb{m Pc i} wait no
// 106: i Pc j, Bb{j Pc m} → Bb{i Pc m}
// We have i Pc j, Bb{m Pc i}. Flip Bb cond? Pc in cond m Pc i → i Pc m via symmetry inside Bb?
const flipCond = L.replace('\\Bb{m \\Pc i}', '\\Bb{i \\Pc m}');
console.log('L->flipCond', j(L, flipCond));
// Then 106 with i Pc j, Bb{i Pc m}? 106 wants Bb{j Pc m}. 
// Flip outer Pc: i Pc j → j Pc i, then 106 as j Pc i, Bb{i Pc m} → j Pc i, Bb{j Pc m}
const flipOuter = L.replace(/i \\Pc j/g, 'j \\Pc i');
console.log('L->flipOuter', j(L, flipOuter));
// Only flip the false-arm Pc (keep true as i Pc j)
const flipFalseOnly = L.replace(
  '{,t \\Ob m,i \\Pc j,\\Bb{m \\Pc i}',
  '{,t \\Ob m,j \\Pc i,\\Bb{m \\Pc i}'
);
console.log('L->flipFalsePc', j(L, flipFalseOnly));

// After flipCond to Bb{i Pc m}, apply 106: need left of Bb cond to be j when we have i Pc j
// i Pc j, Bb{i Pc m} is NOT 106 form.
// flipCond then flip both Pc in false: j Pc i, Bb{i Pc m}, then 106 → j Pc i, Bb{j Pc m}, then flip back

let cur = L;
const hops: string[] = [];
function hop(next: string, label: string) {
  const id = j(cur, next);
  console.log(label, id);
  if (!id) return false;
  hops.push(id);
  cur = ensure(next);
  return true;
}

// 1. Flip Pc in Bb cond: m Pc i → i Pc m
if (!hop(L.replace('\\Bb{m \\Pc i}', '\\Bb{i \\Pc m}'), 'flip cond')) process.exit(1);
// 2. Flip the adjacent i Pc j to j Pc i in false arm only  
if (
  !hop(
    cur.replace('{,t \\Ob m,i \\Pc j,\\Bb{i \\Pc m}', '{,t \\Ob m,j \\Pc i,\\Bb{i \\Pc m}'),
    'flip false Pc'
  )
)
  process.exit(1);
// 3. connectivity-106: j Pc i, Bb{i Pc m} → j Pc i, Bb{j Pc m}
if (!hop(cur.replace('\\Bb{i \\Pc m}', '\\Bb{j \\Pc m}'), '106 subst')) process.exit(1);
// 4. Flip j Pc i back to i Pc j
if (
  !hop(
    cur.replace('{,t \\Ob m,j \\Pc i,\\Bb{j \\Pc m}', '{,t \\Ob m,i \\Pc j,\\Bb{j \\Pc m}'),
    'unflip false Pc'
  )
)
  process.exit(1);
// 5. Flip Bb cond j Pc m → m Pc j
if (!hop(cur.replace('\\Bb{j \\Pc m}', '\\Bb{m \\Pc j}'), 'unflip cond')) process.exit(1);
console.log('eq R', cur === R);
console.log('hops', hops.join(', '));
