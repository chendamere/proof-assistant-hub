/** Greedy distance-minimizing reorder fill for selected theorems. */
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
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const thmFilter = process.argv[2] ? parseInt(process.argv[2], 10) : null;

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
function toBook(expr: string) {
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
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
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
function multisetEq(A: string[], B: string[]): boolean {
  if (A.length !== B.length) return false;
  const c = new Map<string, number>();
  for (const x of A) c.set(x, (c.get(x) ?? 0) + 1);
  for (const x of B) c.set(x, (c.get(x) ?? 0) - 1);
  for (const v of c.values()) if (v) return false;
  return true;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (!ix) {
    ix = buildRuleIndex(
      allRules.filter((r) => r.pos < pos),
      new Map()
    );
    indexCache.set(pos, ix);
  }
  return ix;
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function greedy(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal, pos)) return [];
  const AR = topItems(goal);
  if (!multisetEq(topItems(cur), AR)) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 30 && cur !== goal; step++) {
    if (justify(cur, goal, pos)) return path;
    const items = topItems(cur);
    const startOd = orderDist(items, AR);
    let best: { e: string; d: number } | null = null;
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const d = orderDist(sw, AR);
      if (d > startOd) continue;
      const e = joinItems(sw);
      if (seen.has(e)) continue;
      if (!justify(cur, e, pos)) continue;
      if (!best || d < best.d) best = { e, d };
      if (e === goal) {
        best = { e, d: -1 };
        break;
      }
    }
    if (!best) return null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal || justify(cur, goal, pos) ? path.filter((p) => p !== goal) : null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const jobs: { after: number; trail: string; mids: string[]; label: string }[] = [];
const raw0 = fs.readFileSync(texPath, 'utf8');
const lines0 = raw0.split(/\r?\n/);

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  if (thmFilter != null && thm !== thmFilter) continue;
  const pos = 13 * 100000 + thm;
  const chain = greedy(f.left, f.right, pos);
  if (!chain) {
    console.log('OPEN', thm, 's' + f.step);
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + chain.length);
  if (!chain.length) continue;
  const want = fingerprint(f.left);
  let hits = 0;
  for (let i = 0; i < lines0.length; i++) {
    if (!/\\Rq/.test(lines0[i]!)) continue;
    let end = i;
    while (end + 1 < lines0.length) {
      const nxt = lines0[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = lines0
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(joined) !== want) continue;
    hits++;
    let ns = end + 1;
    while (ns < lines0.length && !/\\Rq/.test(lines0[ns]!) && lines0[ns]!.trim()) ns++;
    if (ns < lines0.length && /\\Rq/.test(lines0[ns]!)) {
      let ne = ns;
      while (ne + 1 < lines0.length) {
        const nxt = lines0[ne + 1]!;
        if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
        ne++;
      }
      const nextJoined = lines0
        .slice(ns, ne + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ');
      if (fingerprint(nextJoined) !== fingerprint(f.right)) continue;
    }
    const tm = lines0[end]!.match(/(\\+)\s*$/);
    jobs.push({
      after: end,
      trail: tm ? tm[1]! : '\\\\\\\\',
      mids: chain,
      label: `thm ${thm} s${f.step}`,
    });
    break;
  }
  if (!hits) console.log('  NO ANCHOR', thm, 's' + f.step);
}

jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const used = new Set<number>();
let inserted = 0;
for (const job of jobs) {
  if (used.has(job.after)) continue;
  used.add(job.after);
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted);
