/** Apply guided chains for 124 s54/s62/s86. */
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
function bookBody(expr: string) {
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

function insert(L: string, R: string, mids: string[], label: string): boolean {
  const finalMids = mids.filter((m) => fingerprint(m) !== fingerprint(L) && fingerprint(m) !== fingerprint(R));
  if (!finalMids.length) return false;
  let cur = ensure(L);
  for (const mid of finalMids) {
    if (!justify(cur, mid)) {
      console.log('BREAK', label);
      return false;
    }
    cur = ensure(mid);
  }
  if (!justify(cur, R) && ensure(cur) !== ensure(R)) {
    console.log('TAIL', label);
    return false;
  }
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

type State = { items: string[]; cur: string; path: string[] };
function st(L: string): State {
  return { items: topItems(L), cur: ensure(L), path: [] };
}
function doStep(s: State, e: string): boolean {
  if (!justify(s.cur, e)) return false;
  s.path.push(e);
  s.cur = e;
  s.items = topItems(e);
  return true;
}
function bubbleAtom(s: State, atom: string, destIndex: number): boolean {
  let i = s.items.indexOf(atom);
  if (i < 0) return false;
  while (i !== destIndex) {
    const j = i < destIndex ? i : i - 1;
    const sw = s.items.slice();
    const t = sw[j]!;
    sw[j] = sw[j + 1]!;
    sw[j + 1] = t;
    if (!doStep(s, joinItems(sw))) return false;
    i += i < destIndex ? 1 : -1;
  }
  return true;
}

function solveBridge(L0: string, R0: string): string[] | null {
  const R = ensure(R0);
  const s = st(L0);
  // dedupe i Ps i1
  const p1 = s.items.map((x, i) => (x === 'i \\Ps i_1' ? i : -1)).filter((i) => i >= 0);
  if (p1.length >= 2) {
    if (!bubbleAtom(s, 'i \\Ps i_1', p1[0]! + 1)) {
      // bubble the later one — find later occurrence
      const later = s.items.map((x, i) => (x === 'i \\Ps i_1' ? i : -1)).filter((i) => i >= 0);
      if (later.length < 2) return null;
      while (later[1]! > later[0]! + 1) {
        const a = later[1]!;
        const sw = s.items.slice();
        const t = sw[a - 1]!;
        sw[a - 1] = sw[a]!;
        sw[a] = t;
        if (!doStep(s, joinItems(sw))) return null;
        later[1]!--;
      }
    }
    const i = s.items.indexOf('i \\Ps i_1');
    if (s.items[i + 1] === 'i \\Ps i_1') {
      if (!doStep(s, joinItems([...s.items.slice(0, i), ...s.items.slice(i + 1)]))) return null;
    }
  }
  // dedupe i1 Ps i2
  let p2 = s.items.map((x, i) => (x === 'i_1 \\Ps i_2' ? i : -1)).filter((i) => i >= 0);
  while (p2.length >= 2 && p2[1]! > p2[0]! + 1) {
    const a = p2[1]!;
    const sw = s.items.slice();
    const t = sw[a - 1]!;
    sw[a - 1] = sw[a]!;
    sw[a] = t;
    if (!doStep(s, joinItems(sw))) return null;
    p2 = s.items.map((x, i) => (x === 'i_1 \\Ps i_2' ? i : -1)).filter((i) => i >= 0);
  }
  if (p2.length >= 2 && p2[1] === p2[0]! + 1) {
    if (!doStep(s, joinItems([...s.items.slice(0, p2[0]!), ...s.items.slice(p2[0]! + 1)]))) return null;
  }
  // adj i Ps i1 and i1 Ps i2 for fwd73
  let ip = s.items.indexOf('i \\Ps i_1');
  let iq = s.items.indexOf('i_1 \\Ps i_2');
  if (ip < 0 || iq < 0) return null;
  while (Math.abs(ip - iq) > 1) {
    const from = iq;
    const to = ip < iq ? ip + 1 : ip;
    if (!bubbleAtom(s, 'i_1 \\Ps i_2', to)) return null;
    ip = s.items.indexOf('i \\Ps i_1');
    iq = s.items.indexOf('i_1 \\Ps i_2');
  }
  {
    const iq2 = s.items.indexOf('i_1 \\Ps i_2');
    const sw = s.items.slice();
    sw[iq2] = 'i \\Ps i_2';
    if (!doStep(s, joinItems(sw))) return null;
  }
  // bubble i Ps i2 to i Oc i2, order Oc then Ps, drop
  let ps = s.items.indexOf('i \\Ps i_2');
  let oc = s.items.indexOf('i \\Oc i_2');
  while (Math.abs(ps - oc) > 1) {
    const to = oc < ps ? oc + 1 : oc;
    if (!bubbleAtom(s, 'i \\Ps i_2', to)) return null;
    ps = s.items.indexOf('i \\Ps i_2');
    oc = s.items.indexOf('i \\Oc i_2');
  }
  ps = s.items.indexOf('i \\Ps i_2');
  oc = s.items.indexOf('i \\Oc i_2');
  if (ps === oc - 1) {
    const sw = s.items.slice();
    const t = sw[ps]!;
    sw[ps] = sw[oc]!;
    sw[oc] = t;
    if (!doStep(s, joinItems(sw))) return null;
  }
  ps = s.items.indexOf('i \\Ps i_2');
  if (!doStep(s, joinItems([...s.items.slice(0, ps), ...s.items.slice(ps + 1)]))) return null;

  // reorder to R
  const goal = topItems(R);
  for (let n = 0; n < 24 && ensure(s.cur) !== R; n++) {
    if (justify(s.cur, R)) break;
    let best: { e: string; d: number } | null = null;
    for (let i = 0; i < s.items.length - 1; i++) {
      const sw = s.items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const e = joinItems(sw);
      if (!justify(s.cur, e)) continue;
      let d = 0;
      for (let k = 0; k < sw.length; k++) {
        const want = goal.indexOf(sw[k]!);
        d += Math.abs(k - (want < 0 ? 99 : want));
      }
      if (!best || d < best.d) best = { e, d };
    }
    if (!best || !doStep(s, best.e)) return null;
  }
  return ensure(s.cur) === R || justify(s.cur, R) ? s.path.filter((p) => ensure(p) !== R) : null;
}

function solveS62(L0: string, R0: string): string[] | null {
  const R = ensure(R0);
  const s = st(L0);
  let ri = s.items.indexOf('R\\_(i_1)');
  const pui = () => s.items.indexOf('i_1 \\Pu');
  if (ri < 0 || pui() < 0) return null;
  while (ri > pui() + 1) {
    if (!bubbleAtom(s, 'R\\_(i_1)', pui() + 1)) return null;
    ri = s.items.indexOf('R\\_(i_1)');
  }
  if (!doStep(s, joinItems(s.items.filter((x) => x !== 'R\\_(i_1)')))) return null;
  let oni = s.items.indexOf('i_1 \\On');
  let opi = s.items.indexOf('i_1 \\Op');
  while (Math.abs(oni - opi) > 1) {
    const to = oni < opi ? oni + 1 : oni;
    if (!bubbleAtom(s, 'i_1 \\Op', to)) return null;
    oni = s.items.indexOf('i_1 \\On');
    opi = s.items.indexOf('i_1 \\Op');
  }
  const lo = Math.min(oni, opi);
  if (!doStep(s, joinItems([...s.items.slice(0, lo), ...s.items.slice(lo + 2)]))) return null;
  const goal = topItems(R);
  for (let n = 0; n < 24 && ensure(s.cur) !== R; n++) {
    if (justify(s.cur, R)) break;
    let best: { e: string; d: number } | null = null;
    for (let i = 0; i < s.items.length - 1; i++) {
      const sw = s.items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const e = joinItems(sw);
      if (!justify(s.cur, e)) continue;
      let d = 0;
      for (let k = 0; k < sw.length; k++) {
        const want = goal.indexOf(sw[k]!);
        d += Math.abs(k - (want < 0 ? 99 : want));
      }
      if (!best || d < best.d) best = { e, d };
    }
    if (!best || !doStep(s, best.e)) return null;
  }
  return ensure(s.cur) === R || justify(s.cur, R) ? s.path.filter((p) => ensure(p) !== R) : null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((f) => [54, 62, 86].includes(f.step));

for (const f of [...fails].sort((a, b) => b.step - a.step)) {
  const label = '124 s' + f.step;
  console.log('\n====', label, '====');
  const chain = f.step === 62 ? solveS62(f.left, f.right) : solveBridge(f.left, f.right);
  console.log(chain ? `CHAIN +${chain.length}` : 'OPEN');
  if (chain?.length) insert(f.left, f.right, chain, label);
}
console.log('done');
