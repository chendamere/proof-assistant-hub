/** 124 s99 reorder after Bb drop; 100/108/202 remaining with bubble after ident70. */
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
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < 13 * 100000 + 202),
  new Map()
);
function justify(a: string, b: string, maxPos: number, allowEmptyLhs = false) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.pos >= maxPos) continue;
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (!allowEmptyLhs && rule.leftSide.replace(/\s/g, '') === ',' && /identical-4|null-comparison-4|create-copy/.test(rule.id) === false) {
      /* keep */
    }
    if (!allowEmptyLhs && rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function greedyBubble(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal, pos)) return [];
  if (!multisetEq(topItems(cur), topItems(goal))) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  const AR = topItems(goal);
  for (let step = 0; step < 30 && cur !== goal; step++) {
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
      if (seen.has(e)) continue;
      if (!justify(cur, e, pos)) continue;
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

// 124 s99 from known L/R
{
  const L = ensure(
    ',j \\Oc j_1,\\Bb{i \\Pu}{,}{,},i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,i_2 \\Os,j_1 \\Os,'
  );
  const R = ensure(
    ',i \\On,i \\Oc i_2,j \\Oc j_1,R(i_2),R(j_1),i_2 \\Ps j_1,i_2 \\Os,j_1 \\Os,'
  );
  const pos = 13 * 100000 + 124;
  const mid = ensure(L.replace(',\\Bb{i \\Pu}{,}{,},', ','));
  console.log('s99 drop', justify(L, mid, pos, true));
  const bubble = greedyBubble(mid, R, pos);
  console.log('s99 bubble', bubble?.length ?? null);
  if (justify(L, mid, pos, true) && bubble) {
    insert(L, R, [mid, ...bubble], '124 s99');
  }
}

// 100 s11: add dup then bubble
{
  const fails = fs
    .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
    .trim()
    .split(/\n/)
    .map((l) => JSON.parse(l));
  for (const f of fails.filter(
    (x) =>
      x.key.includes('::100::') &&
      (x.step === 11 || x.step === 15 || x.step === 31 || x.step === 33)
  )) {
    const pos = 13 * 100000 + 100;
    const L = ensure(f.left);
    const R = ensure(f.right);
    const label = `100 s${f.step}`;
    // try ident70 then bubble
    let mid: string | null = null;
    if (f.step === 11 || f.step === 31) {
      const atom = f.step === 11 ? 'i_1 \\Ps i_2' : 'j_1 \\Ps j_2';
      mid = ensure(L.replace(`,${atom},`, `,${atom},${atom},`));
    } else {
      const atom = f.step === 15 ? 'i_1 \\Ps i_2' : 'j_1 \\Ps j_2';
      mid = ensure(L.replace(`,${atom},${atom},`, `,${atom},`));
    }
    if (!mid || mid === L) {
      console.log(label, 'no mid');
      continue;
    }
    const j = justify(L, mid, pos);
    console.log(label, 'hop1', j ?? 'FAIL');
    if (!j) continue;
    if (mid === R || justify(mid, R, pos)) {
      insert(L, R, mid === R ? [] : [mid], label);
      continue;
    }
    const bubble = greedyBubble(mid, R, pos);
    console.log(label, 'bubble', bubble?.length ?? null);
    if (bubble) insert(L, R, [mid, ...bubble], label);
  }

  // 202 s9 from current fails / hardcoded
  {
    const f = fails.find((x) => x.key.includes('::202::') && x.step === 9);
    if (f) {
      const pos = 13 * 100000 + 202;
      const L = ensure(f.left);
      const R = ensure(f.right);
      const mid = ensure(L.replace(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,', ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),'));
      console.log('202 s9', justify(L, mid, pos) ?? 'FAIL', mid === R);
      if (justify(L, mid, pos) && (mid === R || justify(mid, R, pos))) {
        insert(L, R, mid === R ? [] : [mid], '202 s9');
      }
    }
  }

  // 124 s47
  {
    const f = fails.find((x) => x.key.includes('::124::') && x.step === 47);
    if (f) {
      const pos = 13 * 100000 + 124;
      const L = ensure(f.left);
      const R = ensure(f.right);
      const mid = ensure(L.replace(',i_1 \\Ps i_2,R(i_2),', ',i_1 \\Ps i_2,R(i_2),i_1 \\Ps i_2,'));
      // try alternate placement
      const mid2 = ensure(
        L.replace(
          ',i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,',
          ',i_1 \\Op,R\\_(i_1),i_1 \\Ps i_2,R(j_1),i_1 \\Ps j_1,'
        )
      );
      for (const m of [mid2, mid]) {
        if (m === L) continue;
        const j = justify(L, m, pos);
        console.log('124 s47', j ?? 'FAIL');
        if (!j) continue;
        if (m === R || justify(m, R, pos)) {
          insert(L, R, m === R ? [] : [m], '124 s47');
          break;
        }
        const bubble = greedyBubble(m, R, pos);
        console.log('124 s47 bubble', bubble?.length ?? null);
        if (bubble) {
          insert(L, R, [m, ...bubble], '124 s47');
          break;
        }
      }
    }
  }
}
