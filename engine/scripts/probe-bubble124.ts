import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  ).trim();
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
    const item = B[i]!;
    if (!targetIdx.has(item)) targetIdx.set(item, []);
    targetIdx.get(item)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const item = A[i]!;
    const slots = targetIdx.get(item) ?? [];
    const k = used.get(item) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(item, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}
function tokenDist(a: string, b: string) {
  const A = topItems(a);
  const B = topItems(b);
  const counts = new Map<string, number>();
  for (const t of A) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const t of B) counts.set(t, (counts.get(t) ?? 0) - 1);
  let d = 0;
  for (const v of counts.values()) d += Math.abs(v);
  return d * 8 + orderDist(A, B);
}

const f = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes('::124::') && x.step === 3);
const L = ensure(f.left);
const R = ensure(f.right);
const pos = 13 * 100000 + 124;
console.log('items L', topItems(L));
console.log('items R', topItems(R));
console.log('startD', tokenDist(L, R));

const allRules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(allRules, new Map());
function justify(a: string, b: string) {
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

let cur = L;
const path: string[] = [];
for (let step = 0; step < 20 && cur !== R; step++) {
  const a = topItems(cur);
  const b = topItems(R);
  const start = tokenDist(cur, R);
  let best: { e: string; id: string; d: number } | null = null;
  for (let i = 0; i < a.length - 1; i++) {
    const swapped = a.slice();
    const tmp = swapped[i]!;
    swapped[i] = swapped[i + 1]!;
    swapped[i + 1] = tmp;
    const e = joinItems(swapped);
    const d = tokenDist(e, R);
    const id = justify(cur, e);
    if (step === 0 && d < start) {
      console.log('cand', i, a[i], '<->', a[i + 1], 'd', d, 'id', id);
    }
    if (d >= start) continue;
    if (!id) continue;
    if (!best || d < best.d) best = { e, id, d };
  }
  // also try fill rewrites
  if (!best) {
    for (const rule of allRules.filter((r) => /swap|recursive-function-r|identical|release|create/i.test(r.id)).slice(0, 200)) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const e = ensure(raw);
        const d = tokenDist(e, R);
        if (d >= start) continue;
        if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
          continue;
        if (!best || d < best.d) best = { e, id: rule.id, d };
      }
    }
  }
  if (!best) {
    console.log('stuck', step, 'd', start);
    console.log(cur);
    break;
  }
  console.log('hop', step, best.id, 'd', best.d, topItems(best.e).slice(0, 6));
  path.push(best.e);
  cur = best.e;
}
console.log('done', cur === R, path.length);
