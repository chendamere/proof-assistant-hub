/** Probe why a reorder fail won't bubble. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const p = e.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = e.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}
function orderDist(A: string[], B: string[]): number {
  const targetIdx = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    if (!targetIdx.has(B[i]!)) targetIdx.set(B[i]!, []);
    targetIdx.get(B[i]!)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const slots = targetIdx.get(A[i]!) ?? [];
    const k = used.get(A[i]!) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(A[i]!, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));

const keyFilter = process.argv[2] ?? '::100::';
const stepFilter = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x) => x.key.includes(keyFilter) && (stepFilter == null || x.step === stepFilter)
)!;
const thm = parseInt(f.key.split('::')[1]!, 10);
const pos = 13 * 100000 + thm;
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

const L = ensure(f.left);
const R = ensure(f.right);
const AL = topItems(L);
const AR = topItems(R);
console.log('thm', thm, 's' + f.step, 'dist', orderDist(AL, AR));
console.log('L items:');
AL.forEach((x, i) => console.log(' ', i, x.slice(0, 80)));
console.log('R items:');
AR.forEach((x, i) => console.log(' ', i, x.slice(0, 80)));

// Find which adjacent swaps are justified
console.log('\nadjacent swaps that reduce/keep dist:');
const startD = orderDist(AL, AR);
let justified = 0;
for (let i = 0; i < AL.length - 1; i++) {
  const sw = AL.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const d = orderDist(sw, AR);
  if (d > startD) continue;
  const e = joinItems(sw);
  const j = justify(L, e);
  console.log(
    `  swap ${i}/${i + 1}`,
    d <= startD ? `d ${startD}→${d}` : '',
    j ?? 'FAIL',
    '|',
    AL[i]!.slice(0, 30),
    '<->',
    AL[i + 1]!.slice(0, 30)
  );
  if (j) justified++;
}
console.log('justified reducing swaps', justified);

// Try flip72 for Ps past R or similar: for each Ps next to non-swappable
console.log('\nflip72 candidates:');
for (let i = 0; i < AL.length - 1; i++) {
  const a = AL[i]!;
  const b = AL[i + 1]!;
  const ps = /\\Ps/.test(a) ? a : /\\Ps/.test(b) ? b : null;
  if (!ps) continue;
  const m = ps.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
  if (!m) continue;
  const flipped = `${m[2]} \\Ps ${m[1]}`;
  const items2 = AL.slice();
  const idx = /\\Ps/.test(a) ? i : i + 1;
  items2[idx] = flipped;
  const mid = joinItems(items2);
  const j1 = justify(L, mid);
  if (!j1) continue;
  // then swap
  const sw = items2.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const afterSwap = joinItems(sw);
  const j2 = justify(mid, afterSwap);
  // flip back
  const items3 = sw.slice();
  const idx2 = items3.findIndex((x) => x === flipped);
  if (idx2 >= 0) items3[idx2] = ps;
  const back = joinItems(items3);
  const j3 = justify(afterSwap, back);
  console.log(`  at ${i}`, j1, j2 ?? 'swapFAIL', j3 ?? 'flipBackFAIL', 'net', orderDist(topItems(back), AR));
}
