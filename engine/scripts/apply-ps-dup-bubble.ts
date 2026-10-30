/**
 * Non-adjacent Ps duplicate add/drop:
 *   add: identical-70 adjacent, then bubble copy to goal slot
 *   drop: bubble second copy adjacent to first, then identical-70 drop
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
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < 13 * 100000 + 202),
  new Map()
);
function justify(a: string, b: string, maxPos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.pos >= maxPos) continue;
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
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
  const AL = topItems(cur);
  if (AL.length !== AR.length) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 40 && cur !== goal; step++) {
    if (justify(cur, goal, pos)) return path;
    const items = topItems(cur);
    const startOd = orderDist(items, AR);
    let best: string | null = null;
    let bestD = Infinity;
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const d = orderDist(sw, AR);
      if (d > startOd) continue;
      const e = joinItems(sw);
      if (seen.has(e) || !justify(cur, e, pos)) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
      if (e === goal) {
        best = e;
        break;
      }
    }
    if (!best) return null;
    path.push(best);
    seen.add(best);
    cur = best;
  }
  return cur === goal || justify(cur, goal, pos) ? path.filter((p) => p !== goal) : null;
}

function countAtom(items: string[], atom: string) {
  return items.filter((x) => x === atom).length;
}

function solveDup(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R, pos)) return [];
  const AL = topItems(L);
  const AR = topItems(R);
  // find Ps atom whose count differs
  const atoms = new Set([...AL, ...AR].filter((x) => / \\Ps /.test(x)));
  for (const atom of atoms) {
    const cL = countAtom(AL, atom);
    const cR = countAtom(AR, atom);
    if (cL === cR) continue;
    if (cR === cL + 1) {
      // add adjacent then bubble to R
      const idx = AL.indexOf(atom);
      if (idx < 0) continue;
      const withDup = AL.slice();
      withDup.splice(idx + 1, 0, atom);
      const mid = joinItems(withDup);
      if (!justify(L, mid, pos)) continue;
      if (mid === R || justify(mid, R, pos)) return mid === R ? [] : [mid];
      const bubble = greedy(mid, R, pos);
      if (bubble) return [mid, ...bubble];
    }
    if (cL === cR + 1) {
      // bubble to make adjacent copies, then drop
      // target: same as R but with an extra adjacent pair somewhere, then drop
      // simpler: greedy toward a state with adjacent dups matching R after drop
      // Build goalAdjacent = insert atom next to first occurrence in R
      const idx = AR.indexOf(atom);
      if (idx < 0) continue;
      const adj = AR.slice();
      adj.splice(idx + 1, 0, atom);
      const midGoal = joinItems(adj);
      const toAdj = greedy(L, midGoal, pos);
      if (toAdj == null && L !== midGoal && !justify(L, midGoal, pos)) continue;
      const path = toAdj ? [...toAdj] : [];
      let cur = toAdj && toAdj.length ? toAdj[toAdj.length - 1]! : L;
      if (cur !== midGoal) {
        if (!justify(cur, midGoal, pos) && cur !== midGoal) continue;
        if (cur !== midGoal) path.push(midGoal);
        cur = midGoal;
      }
      // drop adjacent
      const dropped = joinItems(
        (() => {
          const items = topItems(cur);
          const i = items.indexOf(atom);
          if (i < 0 || items[i + 1] !== atom) return items;
          const out = items.slice();
          out.splice(i + 1, 1);
          return out;
        })()
      );
      if (!justify(cur, dropped, pos)) continue;
      if (dropped !== R) path.push(dropped);
      if (dropped === R || justify(dropped, R, pos)) {
        const rest = dropped === R ? [] : greedy(dropped, R, pos);
        if (rest) return [...path, ...rest].filter((p) => ensure(p) !== R);
      }
    }
  }
  return null;
}

function insert(L: string, R: string, mids: string[], label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  if (!finalMids.length) return false;
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  const wantR = fingerprint(R);
  const anchors: { end: number; trail: string }[] = [];
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
    if (fingerprint(joined) !== want) continue;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    if (ns >= lines.length || !/\\Rq/.test(lines[ns]!)) continue;
    let ne = ns;
    while (ne + 1 < lines.length) {
      const nxt = lines[ne + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      ne++;
    }
    const nextJoined = lines
      .slice(ns, ne + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(nextJoined) !== wantR) continue;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    anchors.push({ end, trail: tm ? tm[1]! : '\\\\\\\\' });
  }
  if (anchors.length !== 1) {
    console.log('NO/AMBIG', label, anchors.length);
    return false;
  }
  const a = anchors[0]!;
  const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${a.trail}`);
  lines.splice(a.end + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK', label, '+' + block.length);
  return true;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  // only Ps-count-diff fails
  const AL = topItems(f.left);
  const AR = topItems(f.right);
  const atoms = new Set([...AL, ...AR].filter((x) => / \\Ps /.test(x)));
  let diff = false;
  for (const a of atoms) {
    if (countAtom(AL, a) !== countAtom(AR, a)) diff = true;
  }
  if (!diff) continue;
  const chain = solveDup(f.left, f.right, pos);
  const label = `${thm} s${f.step}`;
  if (!chain) {
    console.log('OPEN', label);
    continue;
  }
  console.log('CHAIN', label, '+' + chain.length);
  insert(f.left, f.right, chain, label);
}
console.log('done');
