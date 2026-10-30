/** 124 s135: pull i Ps i1 out of Bb{i Pu}, reorder, push i1 Os into arms. */
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
const POS = 13 * 100000 + 124;

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
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string) {
  return ensure(expr).replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
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

console.log('building index…');
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < POS),
  new Map()
);
console.log('ready');
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.step === 135)!;
const L = ensure(f.left);
const R = ensure(f.right);
const pathMids: string[] = [];
let cur = L;

function step(next: string, why: string) {
  const j = justify(cur, next);
  console.log(why, j ?? 'FAIL');
  if (!j) throw new Error(why);
  if (ensure(next) !== ensure(R)) pathMids.push(next);
  cur = ensure(next);
}

// 1. reverse identical-29 / swap-65: pull i Ps i1 from both arms
const mid1 = ensure(
  L.replace(
    '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    'i \\Ps i_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
step(mid1, 'pull Ps');

// 2. bubble i Ps i1 between Ocs
let items = topItems(cur);
let pi = items.indexOf('i \\Ps i_1');
const goalPi = items.indexOf('i \\Oc i_1') + 1;
while (pi !== goalPi) {
  const j = pi < goalPi ? pi : pi - 1;
  const sw = items.slice();
  const t = sw[j]!;
  sw[j] = sw[j + 1]!;
  sw[j + 1] = t;
  step(joinItems(sw), 'bubble Ps');
  items = topItems(cur);
  pi = items.indexOf('i \\Ps i_1');
}

// 3. Move Bb right past Os until i1 Os sits immediately before Bb, then null-12 push
items = topItems(cur);
let oi = items.indexOf('i_1 \\Os');
let bi = items.findIndex((x) => x.startsWith('\\Bb'));
while (oi !== bi - 1 && bi >= 0 && bi + 1 < items.length) {
  // Prefer swapping Bb with the atom on its right (move Bb right)
  if (bi < oi) {
    const sw = items.slice();
    const t = sw[bi]!;
    sw[bi] = sw[bi + 1]!;
    sw[bi + 1] = t;
    step(joinItems(sw), 'Bb right');
  } else {
    const j = oi;
    const sw = items.slice();
    const t = sw[j]!;
    sw[j] = sw[j + 1]!;
    sw[j + 1] = t;
    step(joinItems(sw), 'bubble Os');
  }
  items = topItems(cur);
  oi = items.indexOf('i_1 \\Os');
  bi = items.findIndex((x) => x.startsWith('\\Bb'));
}

const pushed = ensure(
  cur.replace(
    ',i_1 \\Os,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    ',\\Bb{i \\Pu}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
step(pushed, 'push Os');

// false arm may need i1 Os past R(i1): {i1 Os, R(i1), ...} → {R(i1), i1 Os, ...}
if (ensure(cur) !== R && !justify(cur, R)) {
  const swapped = ensure(
    cur.replace(
      '{,i_1 \\Os,R(i_1),i \\On,',
      '{,R(i_1),i_1 \\Os,i \\On,'
    )
  );
  if (swapped !== cur) step(swapped, 'arm swap Os/R');
}
console.log('=R', ensure(cur) === R, justify(cur, R));
if (ensure(cur) !== R && !justify(cur, R)) {
  console.log('cur', cur);
  console.log('R  ', R);
  process.exit(1);
}

// insert
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
console.log('anchors', anchors.length);
if (anchors.length !== 1) process.exit(1);
const a = anchors[0]!;
const block = pathMids.map((mid) => `\\Rq${bookBody(mid)}${a.trail}`);
lines.splice(a.end + 1, 0, ...block);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('OK +' + block.length);
