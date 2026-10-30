/** 195: drop j Ps i1 via identical-73 + copy-identical; drop dup i1 Ps j1. */
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 195;
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
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const f = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes('::195::'))!;

const L = ensure(f.left);
const R = ensure(f.right);
const goalItems = topItems(R);

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

let cur = L;
const mids: string[] = [];
const seen = new Set([cur]);

// Greedy: prefer length-reducing justified hops, else reorder toward goal, else special rewrites
for (let step = 0; step < 40 && cur !== R; step++) {
  if (justify(cur, R)) break;
  const items = topItems(cur);
  const cands: Array<{ e: string; score: number }> = [];

  // length-reducing patterns
  for (const re of [
    /,i \\Ps i_1,/,
    /,j \\Ps i_1,/,
    /,i_1 \\Ps j_1,(?=.*i_1 \\Ps j_1)/,
  ]) {
    if (re.test(cur)) {
      // only drop second i1 Ps j1
    }
  }
  if ((cur.match(/i_1 \\Ps j_1/g) ?? []).length >= 2) {
    const e = ensure(cur.replace(',i_1 \\Ps j_1,R(i_1),R(j_1),i_1 \\Ps j_1,', ',i_1 \\Ps j_1,R(i_1),R(j_1),'));
    if (e !== cur) cands.push({ e, score: -100 });
    const e2 = ensure(cur.replace(',i_1 \\Ps j_1,i_1 \\Ps j_1,', ',i_1 \\Ps j_1,'));
    if (e2 !== cur) cands.push({ e: e2, score: -100 });
  }
  if (/i \\Ps j,j \\Ps i_1/.test(cur) || /i \\Ps j, j \\Ps i_1/.test(cur)) {
    const e = ensure(cur.replace(',i \\Ps j,j \\Ps i_1,', ',i \\Ps j,i \\Ps i_1,'));
    if (e !== cur) cands.push({ e, score: -50 });
  }
  if (/i \\Oc i_1,i \\Ps i_1/.test(cur)) {
    const e = ensure(cur.replace(',i \\Oc i_1,i \\Ps i_1,', ',i \\Oc i_1,'));
    if (e !== cur) cands.push({ e, score: -80 });
  }

  // adjacent swaps
  const startOd = orderDist(items, goalItems);
  const jPsi1 = items.indexOf('j \\Ps i_1');
  const iPsj = items.indexOf('i \\Ps j');
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    const t = sw[i]!;
    sw[i] = sw[i + 1]!;
    sw[i + 1] = t;
    const e = joinItems(sw);
    if (seen.has(e)) continue;
    const d = orderDist(sw, goalItems);
    let bonus = 0;
    // Move stray j Ps i1 left toward i Ps j for identical-73
    if (jPsi1 >= 0 && i === jPsi1 - 1) bonus = -40;
    if (items[i] === 'i \\Ps j' && items[i + 1] === 'j \\Ps i_1') bonus = -60;
    if (items[i] === 'i \\Oc i_1' && items[i + 1] === 'i \\Ps i_1') bonus = -70;
    if (d > startOd && bonus === 0) continue;
    cands.push({ e, score: d + bonus });
  }
  void iPsj;

  cands.sort((a, b) => a.score - b.score);
  let best: string | null = null;
  for (const c of cands.slice(0, 30)) {
    if (!justify(cur, c.e)) continue;
    best = c.e;
    break;
  }
  if (!best) {
    console.log('stuck at', cur);
    break;
  }
  console.log('hop', justify(cur, best), 'score', cands.find((c) => c.e === best)?.score);
  if (best !== R) mids.push(best);
  seen.add(best);
  cur = best;
}

console.log('cur', cur);
console.log('R  ', R);
console.log('ok', cur === R || !!justify(cur, R));
if (!(cur === R || justify(cur, R))) process.exit(1);

const finalMids = mids.filter((m) => ensure(m) !== R);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
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
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('inserted', block.length);
    process.exit(0);
  }
}
console.log('NO ANCHOR');
process.exit(1);
