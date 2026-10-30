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
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]) {
  return ensure(',' + items.join(',') + ',');
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

const L =
  ',i \\Ps i_1,i \\On,i_1 \\Pu,i_1 \\On,i_1 \\Op,R\\_(i_1),i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';
const R =
  ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';

// Bubble R_(i1) left next to i1 Pu
let items = topItems(L);
let cur = ensure(L);
const path: string[] = [];
let ri = items.indexOf('R\\_(i_1)');
const pi = items.indexOf('i_1 \\Pu');
console.log('positions Pu', pi, 'R_', ri);
while (ri > pi + 1) {
  const sw = items.slice();
  const t = sw[ri - 1]!;
  sw[ri - 1] = sw[ri]!;
  sw[ri] = t;
  const e = joinItems(sw);
  const j = justify(cur, e);
  console.log('swap', items[ri - 1], '↔ R_', j);
  if (!j) break;
  path.push(e);
  items = sw;
  cur = e;
  ri--;
}
console.log('adjacent?', items[pi + 1] === 'R\\_(i_1)');
const droppedR = joinItems(items.filter((x) => x !== 'R\\_(i_1)'));
console.log('drop R_', justify(cur, droppedR));
if (justify(cur, droppedR)) {
  cur = droppedR;
  path.push(cur);
  items = topItems(cur);
}

// try drop On and Op
for (const atom of ['i_1 \\On', 'i_1 \\Op']) {
  const next = joinItems(items.filter((x) => x !== atom));
  console.log('drop', atom, justify(cur, next));
  if (justify(cur, next)) {
    cur = next;
    path.push(cur);
    items = topItems(cur);
  }
}

// reorder to R
console.log('reorder to R', justify(cur, R), 'eq', ensure(cur) === ensure(R));
// bubble i On past i1 Pu if needed
items = topItems(cur);
let oi = items.indexOf('i \\On');
const target = topItems(R);
while (joinItems(items) !== ensure(R) && oi >= 0) {
  const goalOi = target.indexOf('i \\On');
  if (oi === goalOi) break;
  const dir = oi < goalOi ? 1 : -1;
  const sw = items.slice();
  const j = oi;
  const k = oi + dir;
  const t = sw[j]!;
  sw[j] = sw[k]!;
  sw[k] = t;
  const e = joinItems(sw);
  const ju = justify(cur, e);
  console.log('ord', items[j], '↔', items[k], ju);
  if (!ju) break;
  path.push(e);
  items = sw;
  cur = e;
  oi = items.indexOf('i \\On');
}
console.log('final', ensure(cur) === ensure(R), justify(cur, R));
console.log('path len', path.length);
