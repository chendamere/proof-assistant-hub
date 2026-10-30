/**
 * After non-injective operand bind fix, Ps can bubble past its own R(i).
 * Fill remaining fails with justified adjacent bubbles / dups / flips.
 */
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
const recheckPath = path.join(__dirname, 'out/recheck-ch14.jsonl');

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
function topItems(expr: string): string[] {
  const e = ensure(expr);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = e.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = e.slice(start).trim();
  if (tail) items.push(tail);
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
const dag = new Map();
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (ix) return ix;
  ix = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  indexCache.set(pos, ix);
  return ix;
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function solve(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (justify(cur, goal, pos)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 40 && cur !== goal; step++) {
    const items = topItems(cur);
    const goalItems = topItems(goal);
    const startOd = orderDist(items, goalItems);
    const cands: string[] = [];

    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      if (orderDist(sw, goalItems) <= startOd) cands.push(joinItems(sw));
    }
    // dup/drop Ps
    for (let i = 0; i < items.length; i++) {
      if (!/ \\Ps /.test(items[i]!)) continue;
      const dup = items.slice();
      dup.splice(i + 1, 0, items[i]!);
      cands.push(joinItems(dup));
      if (i + 1 < items.length && items[i + 1] === items[i]) {
        const drop = items.slice();
        drop.splice(i, 1);
        cands.push(joinItems(drop));
      }
    }
    // flip top-level Ps
    for (let i = 0; i < items.length; i++) {
      const pm = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
      if (!pm) continue;
      const fl = items.slice();
      fl[i] = `${pm[2]} \\Ps ${pm[1]}`;
      cands.push(joinItems(fl));
    }
    // flip Bb condition
    {
      const re = /\\B(?:lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        cands.push(
          ensure(
            cur.slice(0, m.index) +
              m[0]!.replace(`${m[1]} \\Ps ${m[2]}`, `${m[2]} \\Ps ${m[1]}`) +
              cur.slice(m.index + m[0]!.length)
          )
        );
      }
    }
    // Arm-local: flip any Ps; swap Ps with following Pu/nPu when names share.
    {
      const re = /([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        cands.push(
          ensure(cur.slice(0, m.index) + `${m[2]} \\Ps ${m[1]}` + cur.slice(m.index + m[0].length))
        );
      }
    }
    {
      const re =
        /([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\2 \\(Pu|nPu),/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        cands.push(
          ensure(
            cur.slice(0, m.index) +
              `${m[2]} \\${m[3]},${m[1]} \\Ps ${m[2]},` +
              cur.slice(m.index + m[0].length)
          )
        );
      }
    }
    // Drop Pu/nPu flags when goal has fewer
    if ((cur.match(/\\Pu|\\nPu/g) || []).length > (goal.match(/\\Pu|\\nPu/g) || []).length) {
      for (const flag of ['\\\\Pu', '\\\\nPu'] as const) {
        const re = new RegExp(`,([A-Za-z][A-Za-z0-9_]*) ${flag},`);
        const mm = cur.match(re);
        if (mm) cands.push(ensure(cur.replace(re, ',')));
      }
    }
    // Drop empty Or-Bb
    {
      const next = cur.replace(/\\Bb\{[^}]*\}\{,\}\{,\\Or,\},?/g, '');
      if (next !== cur) cands.push(ensure(next));
    }

    let best: { e: string; d: number } | null = null;
    for (const raw of cands) {
      const e = ensure(raw);
      if (seen.has(e) || e === cur) continue;
      if (!justify(cur, e, pos)) continue;
      const d = orderDist(topItems(e), goalItems);
      // Allow equal-orderDist hops (needed for R-pair swap before Ps can advance).
      if (e === goal || d <= startOd || e.length !== cur.length) {
        if (!best || e === goal || d < best.d || (d === best.d && e.length < best.e.length))
          best = { e, d };
      }
    }
    if (!best) return null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal ? (path[path.length - 1] === goal ? path.slice(0, -1) : path) : null;
}

// Prefer fresh recheck if verify finished; else use existing
const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });
const seen = new Set<string>();
const jobs: Array<{ after: number; trail: string; mids: string[]; label: string }> = [];

for (const f of fails) {
  const id = `${f.key}::${f.step}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  console.log('TRY', thm, 's' + f.step);
  const t0 = Date.now();
  const path = solve(f.left, f.right, pos);
  console.log(path ? `CHAIN +${path.length}` : 'OPEN', Date.now() - t0 + 'ms');
  if (!path || !path.length) continue;
  const mids = path[path.length - 1] === ensure(f.right) ? path.slice(0, -1) : path;
  if (!mids.length) continue;
  const raw = fs.readFileSync(texPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(f.left);
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(joined) === want) {
      const tm = lines[end]!.match(/(\\+)\s*$/);
      jobs.push({
        after: end,
        trail: tm ? tm[1]! : '\\\\\\\\',
        mids,
        label: `thm ${thm} s${f.step}`,
      });
      break;
    }
  }
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
console.log('done inserted=' + inserted + ' jobs=' + jobs.length);
