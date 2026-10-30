/**
 * Probe each fresh fail: direct justify, multiset equality, short BFS bubble.
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

function bfsBubble(L0: string, R0: string, pos: number, maxSteps = 12): string[] | null {
  const goal = ensure(R0);
  const start = ensure(L0);
  if (justify(start, goal, pos)) return [];
  type Node = { e: string; path: string[] };
  const q: Node[] = [{ e: start, path: [] }];
  const seen = new Set([start]);
  while (q.length) {
    const { e, path } = q.shift()!;
    if (path.length >= maxSteps) continue;
    const items = topItems(e);
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
    // also try arm-local Os swaps if Bb present and multisets differ inside
    for (const cand of cands) {
      if (seen.has(cand)) continue;
      const rule = justify(e, cand, pos);
      if (!rule) continue;
      const nextPath = [...path, cand];
      if (cand === goal || justify(cand, goal, pos)) {
        return justify(cand, goal, pos) && cand !== goal ? nextPath : nextPath.slice(0, -1);
      }
      seen.add(cand);
      q.push({ e: cand, path: nextPath });
    }
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/proof-step-failures.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

console.log('index warm…');
indexBefore(13 * 100000 + 202);
console.log('probing', fails.length, 'fails');

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const AL = topItems(L);
  const AR = topItems(R);
  const same = multisetEq(AL, AR);
  const od = orderDist(AL, AR);
  const direct = justify(L, R, pos);
  let chain: string[] | null = null;
  let note = '';
  if (direct) {
    note = 'DIRECT ' + direct;
  } else if (same) {
    const t0 = Date.now();
    chain = bfsBubble(L, R, pos, 16);
    note = chain
      ? `BUBBLE +${chain.length} ${Date.now() - t0}ms`
      : `SAME-MULTI od=${od} NO-BUBBLE ${Date.now() - t0}ms`;
  } else {
    // show multiset delta
    const c = new Map<string, number>();
    for (const x of AL) c.set(x, (c.get(x) ?? 0) + 1);
    for (const x of AR) c.set(x, (c.get(x) ?? 0) - 1);
    const onlyL: string[] = [];
    const onlyR: string[] = [];
    for (const [k, v] of c) {
      if (v > 0) onlyL.push(`${v}x ${k.slice(0, 60)}`);
      if (v < 0) onlyR.push(`${-v}x ${k.slice(0, 60)}`);
    }
    note = `DIFF onlyL=[${onlyL.join('; ')}] onlyR=[${onlyR.join('; ')}]`;
  }
  console.log(`thm${thm} s${f.step}: nL=${AL.length} nR=${AR.length} ${note}`);
  if (chain && chain.length && chain.length <= 6) {
    for (let i = 0; i < chain.length; i++) {
      const prev = i === 0 ? L : chain[i - 1]!;
      console.log('  mid', i, justify(prev, chain[i]!, pos), 'od', orderDist(topItems(chain[i]!), AR));
    }
  }
}
