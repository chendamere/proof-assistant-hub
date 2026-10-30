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
    // skip empty-LHS creativity (spurious)
    if (rule.leftSide.replace(/\s/g, '') === ',' || rule.leftSide.replace(/\s/g, '') === '') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function justifyAllowCreate(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

// isolated reverse create-next-prev
console.log(
  'rev create-next-prev',
  justifyAllowCreate(',i_1 \\On,i_1 \\Op,', ',')
);
console.log(
  'rev with context',
  justifyAllowCreate(
    ',i \\Ps i_1,i_1 \\Pu,i_1 \\On,i_1 \\Op,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,',
    ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,'
  )
);

// Full s62 solve
const L =
  ',i \\Ps i_1,i \\On,i_1 \\Pu,i_1 \\On,i_1 \\Op,R\\_(i_1),i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';
const R =
  ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,';

let items = topItems(L);
let cur = ensure(L);
const path: string[] = [];

// bubble R_ to Pu
let ri = items.indexOf('R\\_(i_1)');
const pui = () => items.indexOf('i_1 \\Pu');
while (ri > pui() + 1) {
  const sw = items.slice();
  const t = sw[ri - 1]!;
  sw[ri - 1] = sw[ri]!;
  sw[ri] = t;
  const e = joinItems(sw);
  const j = justify(cur, e);
  if (!j) {
    console.log('bubble fail', items[ri - 1]);
    break;
  }
  console.log('bubble', j);
  path.push(e);
  items = sw;
  cur = e;
  ri--;
}
const noR = joinItems(items.filter((x) => x !== 'R\\_(i_1)'));
console.log('drop R_', justify(cur, noR));
if (!justify(cur, noR)) process.exit(1);
path.push(noR);
cur = noR;
items = topItems(cur);

// ensure On, Op adjacent then drop via create-next-prev reverse
let oni = items.indexOf('i_1 \\On');
let opi = items.indexOf('i_1 \\Op');
while (Math.abs(oni - opi) > 1) {
  // move Op toward On
  const j = opi > oni ? opi - 1 : opi;
  const sw = items.slice();
  const t = sw[j]!;
  sw[j] = sw[j + 1]!;
  sw[j + 1] = t;
  const e = joinItems(sw);
  const ju = justify(cur, e);
  console.log('pair', ju, items[j], items[j + 1]);
  if (!ju) break;
  path.push(e);
  items = sw;
  cur = e;
  oni = items.indexOf('i_1 \\On');
  opi = items.indexOf('i_1 \\Op');
}
console.log('On/Op adj', oni, opi, items[oni], items[opi]);
const lo = Math.min(oni, opi);
const dropped = joinItems([...items.slice(0, lo), ...items.slice(lo + 2)]);
console.log('drop OnOp', justifyAllowCreate(cur, dropped));
console.log('drop OnOp strict', justify(cur, dropped));
if (justifyAllowCreate(cur, dropped)) {
  path.push(dropped);
  cur = dropped;
  items = topItems(cur);
}

// reorder to R
const goal = topItems(R);
for (let step = 0; step < 20 && ensure(cur) !== ensure(R); step++) {
  if (justify(cur, R)) {
    console.log('direct to R', justify(cur, R));
    break;
  }
  let best: { e: string; d: number } | null = null;
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    const t = sw[i]!;
    sw[i] = sw[i + 1]!;
    sw[i + 1] = t;
    const e = joinItems(sw);
    if (!justify(cur, e)) continue;
    // kendall-ish
    let d = 0;
    const gi = new Map<string, number[]>();
    for (let k = 0; k < goal.length; k++) {
      if (!gi.has(goal[k]!)) gi.set(goal[k]!, []);
      gi.get(goal[k]!)!.push(k);
    }
    const used = new Map<string, number>();
    for (let k = 0; k < sw.length; k++) {
      const u = used.get(sw[k]!) ?? 0;
      used.set(sw[k]!, u + 1);
      const opts = gi.get(sw[k]!) ?? [];
      const want = opts[u] ?? 99;
      d += Math.abs(k - want);
    }
    if (!best || d < best.d) best = { e, d };
  }
  if (!best) {
    console.log('stuck reorder', cur);
    break;
  }
  console.log('reorder', justify(cur, best.e), 'd', best.d);
  path.push(best.e);
  cur = best.e;
  items = topItems(cur);
}
console.log('DONE', ensure(cur) === ensure(R) || !!justify(cur, R), 'hops', path.length);
