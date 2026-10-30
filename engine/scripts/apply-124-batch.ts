/** Fill remaining 124 easy hops: ident70, pull Os, drop empty Bb+reorder; probe case-split. */
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
const pos = 13 * 100000 + 124;
console.log('warm…');
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string, allowEmpty = false) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (!allowEmpty && rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function greedy(L0: string, R0: string): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal)) return [];
  const AR = topItems(goal);
  if (topItems(cur).length !== AR.length) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 40 && cur !== goal; step++) {
    if (justify(cur, goal)) return path;
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
      if (seen.has(e) || !justify(cur, e)) continue;
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
  return cur === goal || justify(cur, goal) ? path.filter((p) => p !== goal) : null;
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
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::124::'));

for (const f of fails) {
  const L = ensure(f.left);
  const R = ensure(f.right);
  const label = '124 s' + f.step;
  console.log('\n====', label, '====');

  // s99: drop empty Bb then bubble
  if (f.step === 99) {
    const mid = ensure(L.replace(',\\Bb{i \\Pu}{,}{,},', ','));
    const j = justify(L, mid, true);
    console.log('drop', j);
    if (j) {
      const bubble = greedy(mid, R);
      console.log('bubble', bubble?.length ?? null);
      if (bubble) insert(L, R, [mid, ...bubble], label);
    }
    continue;
  }

  // s96: pull equal i1 Os
  if (f.step === 96) {
    const mid = ensure(
      L.replace(
        ',i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},',
        ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},'
      )
    );
    console.log('pull', justify(L, mid) ?? 'FAIL', mid === R);
    if (justify(L, mid) && (mid === R || justify(mid, R))) insert(L, R, mid === R ? [] : [mid], label);
    continue;
  }

  // s38/s70: identical-70 add i Ps i1 then bubble
  if (f.step === 38 || f.step === 70) {
    const items = topItems(L);
    const atom = 'i \\Ps i_1';
    const idx = items.indexOf(atom);
    if (idx < 0) {
      console.log('no atom');
      continue;
    }
    const withDup = items.slice();
    withDup.splice(idx + 1, 0, atom);
    const mid = joinItems(withDup);
    console.log('70', justify(L, mid) ?? 'FAIL');
    if (!justify(L, mid)) continue;
    if (mid === R || justify(mid, R)) {
      insert(L, R, mid === R ? [] : [mid], label);
      continue;
    }
    const bubble = greedy(mid, R);
    console.log('bubble', bubble?.length ?? null);
    if (bubble) insert(L, R, [mid, ...bubble], label);
    continue;
  }

  // s47: add i1 Ps i2
  if (f.step === 47) {
    const items = topItems(L);
    const atom = 'i_1 \\Ps i_2';
    const idx = items.indexOf(atom);
    if (idx < 0) {
      console.log('no atom');
      continue;
    }
    const withDup = items.slice();
    withDup.splice(idx + 1, 0, atom);
    const mid = joinItems(withDup);
    console.log('70', justify(L, mid) ?? 'FAIL');
    if (!justify(L, mid)) continue;
    const bubble = greedy(mid, R);
    console.log('bubble', bubble?.length ?? null);
    if (bubble) insert(L, R, [mid, ...bubble], label);
    else if (mid === R || justify(mid, R)) insert(L, R, mid === R ? [] : [mid], label);
    continue;
  }

  // s24 case-split probe: null-54 path
  if (f.step === 24) {
    // Try: drop shell via create-copy after bubbling Os to Oc, then null-54
    const cands = [
      L.replace(/,i_2 \\Os,i_1 \\Os,j_1 \\Os,$/, ','),
      ensure(
        ',i \\Pu,i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}{,i \\nPu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),},i_2 \\Os,i_1 \\Os,j_1 \\Os,'
      ),
      ensure(
        ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}{,i \\nPu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),},i_2 \\Os,j_1 \\Os,'
      ),
    ];
    for (const c of cands) {
      const e = ensure(c);
      if (e === L) continue;
      console.log('cand', justify(L, e) ?? 'FAIL');
    }
  }
}
console.log('done');
