/** 108 s17: dup-bridge + identical-73 + drop leftover i1 Ps j1 via… probe. */
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    const c = s[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 108;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
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

const f = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
    .trim()
    .split(/\n/)
    .find((l) => l.includes('::108::') && l.includes('"step":17'))!
);

const L = ensure(f.left);
const R = ensure(f.right);
console.log('direct', justify(L, R) ?? 'FAIL');

// Bubble second j1 Ps j2 next to i1 Ps j1, then 73
let items = topItems(L);
const hops: string[] = [];
let cur = L;

function swapAt(i: number) {
  const sw = items.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const e = joinItems(sw);
  const j = justify(cur, e);
  if (!j) return false;
  hops.push(e);
  items = sw;
  cur = e;
  console.log('swap', i, j);
  return true;
}

// find indices
let bi = -1;
let fi = items.indexOf('i_1 \\Ps j_1');
for (let i = 0; i < items.length; i++) {
  if (items[i] === 'j_1 \\Ps j_2' && i !== items.indexOf('j_1 \\Ps j_2')) {
    bi = i; // second occurrence
    break;
  }
}
if (bi < 0) {
  // use last occurrence
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i] === 'j_1 \\Ps j_2') {
      bi = i;
      break;
    }
  }
}
console.log('fi', fi, 'bi', bi, 'items', items);

// move bi toward fi+1
while (bi > fi + 1) {
  if (!swapAt(bi - 1)) break;
  bi--;
  fi = items.indexOf('i_1 \\Ps j_1');
}
while (bi < fi) {
  if (!swapAt(bi)) break;
  bi++;
  fi = items.indexOf('i_1 \\Ps j_1');
}
console.log('adjacent?', Math.abs(items.indexOf('i_1 \\Ps j_1') - items.lastIndexOf('j_1 \\Ps j_2')));

// Apply 73: replace adjacent j1 Ps j2 with i1 Ps j2
{
  const iPs = items.indexOf('i_1 \\Ps j_1');
  let jPs = -1;
  if (items[iPs + 1] === 'j_1 \\Ps j_2') jPs = iPs + 1;
  else if (items[iPs - 1] === 'j_1 \\Ps j_2') jPs = iPs - 1;
  if (jPs >= 0) {
    const sw = items.slice();
    sw[jPs] = 'i_1 \\Ps j_2';
    const e = joinItems(sw);
    console.log('73', justify(cur, e) ?? 'FAIL');
    if (justify(cur, e)) {
      hops.push(e);
      items = sw;
      cur = e;
    }
  }
}
console.log('after73', items);
console.log('goal   ', topItems(R));
console.log('→R', justify(cur, R) ?? 'FAIL');

// Try drop i1 Ps j1
{
  const sw = items.filter((x, i) => !(x === 'i_1 \\Ps j_1' && i === items.indexOf('i_1 \\Ps j_1')));
  const e = joinItems(sw);
  console.log('drop i1Psj1', justify(cur, e) ?? 'FAIL', e === R);
}

// Try flip i1 Ps j1 then something
{
  const sw = items.slice();
  const i = sw.indexOf('i_1 \\Ps j_1');
  if (i >= 0) {
    sw[i] = 'j_1 \\Ps i_1';
    const e = joinItems(sw);
    console.log('flip', justify(cur, e) ?? 'FAIL');
  }
}
