/** 108 s17/s51: bubble j1 Ps j2 next to i1 Ps j*, then identical-73. */
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

function solveSubst(L0: string, R0: string, from: string, to: string): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const items = topItems(L);
  const goal = topItems(R);
  // find indices
  const fi = items.indexOf(from);
  const bridge = 'j_1 \\Ps j_2';
  const bi = items.indexOf(bridge);
  if (fi < 0 || bi < 0) {
    console.log('missing atoms', from, bridge);
    return null;
  }
  // bubble bridge next to from
  let cur = items.slice();
  const path: string[] = [];
  const moveToward = (fromIdx: number, toIdx: number) => {
    while (fromIdx !== toIdx) {
      const j = fromIdx < toIdx ? fromIdx : fromIdx - 1;
      const sw = cur.slice();
      const t = sw[j]!;
      sw[j] = sw[j + 1]!;
      sw[j + 1] = t;
      const e = joinItems(sw);
      const prev = joinItems(cur);
      if (!justify(prev, e)) return false;
      path.push(e);
      cur = sw;
      fromIdx = fromIdx < toIdx ? fromIdx + 1 : fromIdx - 1;
    }
    return true;
  };
  // bring bridge to fi+1 (just after from)
  let curBi = cur.indexOf(bridge);
  let curFi = cur.indexOf(from);
  if (curBi < curFi) {
    // move bridge right to fi
    if (!moveToward(curBi, curFi)) return null;
  } else if (curBi > curFi + 1) {
    if (!moveToward(curBi, curFi + 1)) return null;
  }
  // now apply identical-73: from, bridge → from, to  OR replace from with to keeping bridge
  // 73: i Ps j, j Ps m → i Ps j, i Ps m  so from=i1 Ps j1, bridge=j1 Ps j2 → i1 Ps j1, i1 Ps j2
  const after = cur.slice();
  const f2 = after.indexOf(from);
  const b2 = after.indexOf(bridge);
  if (Math.abs(f2 - b2) !== 1) {
    console.log('not adjacent', f2, b2, after);
    return null;
  }
  // replace bridge with `to` (i1 Ps j2) while keeping from — that's 73 right side
  after[b2] = to;
  const mid73 = joinItems(after);
  const prev = joinItems(cur);
  const j73 = justify(prev, mid73);
  console.log('73', j73 ?? 'FAIL');
  if (!j73) return null;
  path.push(mid73);
  cur = after;
  // drop `from` via identical-70 reverse if goal doesn't have it
  if (!goal.includes(from) && cur.includes(from) && cur.includes(to)) {
    const drop = cur.slice();
    const di = drop.indexOf(from);
    // need adjacent duplicate? from and to are different. Drop from alone — need a rule.
    // After 73 we have from=i1 Ps j1, to=i1 Ps j2. Goal only has to.
    // Drop from: not identical-70. Maybe just... no rule drops arbitrary Ps.
    // Alternative: 73 replaces? Looking at 73 again: LEFT i Ps j, j Ps m RIGHT i Ps j, i Ps m
    // So it KEEPS i Ps j and REPLACES j Ps m with i Ps m. It does NOT remove i Ps j.
    // So after 73 we still have i1 Ps j1. Goal has i1 Ps j2 instead of i1 Ps j1.
    // Need to DROP i1 Ps j1 somehow, or the goal still has j1 Ps j2?
  }
  // Check goal multiset
  console.log('cur', cur);
  console.log('goal', goal);
  // If goal has same multiset, bubble
  const curE = joinItems(cur);
  if (curE === R || justify(curE, R)) return path.filter((p) => ensure(p) !== R);
  // drop from if goal lacks it: try identical-70 only works for duplicates
  // Use reverse of copy? 
  // Actually look at fail again - maybe goal still has j1 Ps j2 and just changed i1 Ps j1 to i1 Ps j2
  // So we need to REMOVE i1 Ps j1 and have i1 Ps j2. After 73: have both i1 Ps j1 and i1 Ps j2 (replaced bridge).
  // We lost j1 Ps j2! Goal might still need j1 Ps j2.
  return path;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::108::') && (x.step === 17 || x.step === 51));

for (const f of fails) {
  console.log('\n==== s' + f.step + ' ====');
  console.log('L', f.left);
  console.log('R', f.right);
  if (f.step === 17) {
    const chain = solveSubst(f.left, f.right, 'i_1 \\Ps j_1', 'i_1 \\Ps j_2');
    console.log('chain', chain?.length ?? null);
  } else {
    const chain = solveSubst(f.left, f.right, 'i_1 \\Ps j_2', 'i_1 \\Ps j_1');
    console.log('chain', chain?.length ?? null);
  }
}
