/** Guided s54 solve: dedupe Ps, fwd73 to i Ps i2, reverse copy-identical. */
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
    const emptyL = rule.leftSide.replace(/\s/g, '') === ',' || rule.leftSide.replace(/\s/g, '') === '';
    if (emptyL && topItems(B).length >= topItems(A).length) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L =
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps i_2,i_2 \\Ps j_1,';
const R =
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_2 \\Ps j_1,';

let items = topItems(L);
let cur = ensure(L);
const path: string[] = [];
function step(e: string, why: string) {
  const j = justify(cur, e);
  console.log(why, j ?? 'FAIL');
  if (!j) throw new Error(why);
  path.push(e);
  cur = e;
  items = topItems(cur);
}

// 1. Bubble second i Ps i1 next to first, dedupe
console.log('items', items.join(' | '));
const positions = items.map((x, i) => (x === 'i \\Ps i_1' ? i : -1)).filter((i) => i >= 0);
console.log('i Ps i1 at', positions);
// move index positions[1] left to positions[0]+1
let a = positions[1]!;
const target = positions[0]! + 1;
while (a > target) {
  const sw = items.slice();
  const t = sw[a - 1]!;
  sw[a - 1] = sw[a]!;
  sw[a] = t;
  step(joinItems(sw), `bubble Ps ${a}`);
  a--;
}
// dedupe adjacent
{
  const i = items.indexOf('i \\Ps i_1');
  if (items[i + 1] === 'i \\Ps i_1') {
    step(joinItems([...items.slice(0, i), ...items.slice(i + 1)]), 'dedupe i Ps i1');
  }
}

// 2. Bubble two i1 Ps i2 together and dedupe one
let p2 = items.map((x, i) => (x === 'i_1 \\Ps i_2' ? i : -1)).filter((i) => i >= 0);
console.log('i1 Ps i2 at', p2);
while (p2.length >= 2 && p2[1]! > p2[0]! + 1) {
  const a2 = p2[1]!;
  const sw = items.slice();
  const t = sw[a2 - 1]!;
  sw[a2 - 1] = sw[a2]!;
  sw[a2] = t;
  step(joinItems(sw), 'bubble i1 Ps i2');
  p2 = items.map((x, i) => (x === 'i_1 \\Ps i_2' ? i : -1)).filter((i) => i >= 0);
}
if (p2.length >= 2 && p2[1] === p2[0]! + 1) {
  step(joinItems([...items.slice(0, p2[0]!), ...items.slice(p2[0]! + 1)]), 'dedupe i1 Ps i2');
}

console.log('after dedupe', items.join(' | '));

// 3. Need i Ps i1 adjacent to i1 Ps i2 for fwd73: i Ps i1, i1 Ps i2 → i Ps i1, i Ps i2
let ip = items.indexOf('i \\Ps i_1');
let iq = items.indexOf('i_1 \\Ps i_2');
console.log('Ps positions', ip, iq);
// move iq next to ip
while (Math.abs(ip - iq) > 1) {
  if (iq > ip + 1) {
    const sw = items.slice();
    const t = sw[iq - 1]!;
    sw[iq - 1] = sw[iq]!;
    sw[iq] = t;
    step(joinItems(sw), 'adj for 73');
  } else if (iq < ip - 1) {
    const sw = items.slice();
    const t = sw[iq]!;
    sw[iq] = sw[iq + 1]!;
    sw[iq + 1] = t;
    step(joinItems(sw), 'adj for 73');
  } else break;
  ip = items.indexOf('i \\Ps i_1');
  iq = items.indexOf('i_1 \\Ps i_2');
}
// apply fwd73: replace i1 Ps i2 with i Ps i2
{
  const iq2 = items.indexOf('i_1 \\Ps i_2');
  const sw = items.slice();
  sw[iq2] = 'i \\Ps i_2';
  step(joinItems(sw), 'fwd73');
}

// 4. Bubble i Ps i2 next to i Oc i2, reverse copy-identical
let ps = items.indexOf('i \\Ps i_2');
let oc = items.indexOf('i \\Oc i_2');
console.log('Ps/Oc', ps, oc);
while (Math.abs(ps - oc) > 1) {
  if (ps > oc + 1) {
    const sw = items.slice();
    const t = sw[ps - 1]!;
    sw[ps - 1] = sw[ps]!;
    sw[ps] = t;
    step(joinItems(sw), 'bubble Ps to Oc');
  } else if (ps < oc - 1) {
    const sw = items.slice();
    const t = sw[ps]!;
    sw[ps] = sw[ps + 1]!;
    sw[ps + 1] = t;
    step(joinItems(sw), 'bubble Ps to Oc');
  } else break;
  ps = items.indexOf('i \\Ps i_2');
  oc = items.indexOf('i \\Oc i_2');
}
{
  let psi = items.indexOf('i \\Ps i_2');
  let oci = items.indexOf('i \\Oc i_2');
  // need Oc immediately before Ps
  if (psi === oci - 1) {
    const sw = items.slice();
    const t = sw[psi]!;
    sw[psi] = sw[oci]!;
    sw[oci] = t;
    step(joinItems(sw), 'Oc before Ps');
    psi = items.indexOf('i \\Ps i_2');
    oci = items.indexOf('i \\Oc i_2');
  }
  console.log('order', items[oci], items[psi], 'adj', oci + 1 === psi);
  step(joinItems([...items.slice(0, psi), ...items.slice(psi + 1)]), 'rev copy-identical');
}

console.log('now', items.join(' | '));
console.log('=R?', ensure(cur) === ensure(R), justify(cur, R));
// reorder if needed
const goal = topItems(R);
for (let stepN = 0; stepN < 20 && ensure(cur) !== ensure(R); stepN++) {
  if (justify(cur, R)) break;
  let best: string | null = null;
  let bestD = 1e9;
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    const t = sw[i]!;
    sw[i] = sw[i + 1]!;
    sw[i + 1] = t;
    const e = joinItems(sw);
    if (!justify(cur, e)) continue;
    let d = 0;
    for (let k = 0; k < sw.length; k++) {
      const want = goal.indexOf(sw[k]!);
      d += Math.abs(k - (want < 0 ? 99 : want));
    }
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) break;
  step(best, 'reorder');
}
console.log('DONE', ensure(cur) === ensure(R) || !!justify(cur, R), 'hops', path.length);
