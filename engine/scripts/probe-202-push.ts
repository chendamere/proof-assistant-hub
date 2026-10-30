/** Probe identical-15 push variants for 202 s3 and dup for s5/s9/s11. */
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 202;
const prefer = allRules.filter(
  (r) =>
    r.pos < pos &&
    /identical-node-comparison-1[0-9]|recursive-function-r-|swap-release|swap-temp|create-copy|thm-R-i-release|operators-and-relationships/.test(
      r.id
    )
);
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
const memo = new Map<string, string | null>();
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  for (const rule of prefer) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      memo.set(key, rule.id);
      return rule.id;
    }
  }
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      hit = rule.id;
      break;
    }
  }
  memo.set(key, hit);
  return hit;
}
function topItems(e: string): string[] {
  const s = ensure(e);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
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
function swapAdj(e: string, i: number) {
  const items = topItems(e);
  const sw = items.slice();
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  return joinItems(sw);
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const f3 = fails.find((x) => x.key.includes('::202::') && x.step === 3)!;
let cur = ensure(f3.left);
const R3 = ensure(f3.right);
console.log('s3 start items', topItems(cur));

// bubble j1 Os to Blb
for (let k = 0; k < 2; k++) {
  const items = topItems(cur);
  const i = items.indexOf('j_1 \\Os');
  const next = swapAdj(cur, i);
  console.log('bubble', k + 1, justify(cur, next));
  cur = next;
}
console.log('after bubble', topItems(cur).slice(-4));

// try push variants
const variants = [
  '{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}',
  '{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
  '{,i_1 \\Os,j_2 \\Os,j_1 \\Os,}{,i_1 \\Os,j_2 \\Os,j_1 \\Os,}',
];
for (const arms of variants) {
  const next = ensure(
    cur.replace(',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}', `,\\Blb{i_1 \\Ps j_2}${arms}`)
  );
  const j = justify(cur, next);
  console.log('push', arms.slice(0, 35), j);
  if (j) {
    // then reorder to R3
    let c2 = next;
    // Target top without Blb: i Oc i1, R(i1), j Oc j2, j Oc j1, R(j2), R_(j1)
    // Current: i Oc i1, j Oc j2, j Oc j1, R_(j1), R(i1), R(j2), Blb...
    // Manual bubble path:
    const goalItems = topItems(R3);
    console.log('goal items', goalItems);
    console.log('cur items ', topItems(c2));
    // greedy adjacent swaps improving orderDist
    function orderDist(A: string[], B: string[]) {
      let d = 0;
      const used = new Map<string, number>();
      for (let i = 0; i < A.length; i++) {
        const slots: number[] = [];
        for (let j = 0; j < B.length; j++) if (B[j] === A[i]) slots.push(j);
        const k = used.get(A[i]!) ?? 0;
        const j = k < slots.length ? slots[k]! : B.length;
        used.set(A[i]!, k + 1);
        d += Math.abs(i - j);
      }
      return d;
    }
    const path: string[] = [c2];
    for (let step = 0; step < 20 && c2 !== R3; step++) {
      if (justify(c2, R3)) {
        console.log('can finish at step', step, justify(c2, R3));
        break;
      }
      const items = topItems(c2);
      const startD = orderDist(items, goalItems);
      let best: { e: string; d: number; rule: string } | null = null;
      for (let i = 0; i < items.length - 1; i++) {
        const e = swapAdj(c2, i);
        if (e === c2) continue;
        const d = orderDist(topItems(e), goalItems);
        if (d > startD) continue;
        const rule = justify(c2, e);
        if (!rule) continue;
        if (!best || d < best.d) best = { e, d, rule };
      }
      if (!best) {
        console.log('stuck reorder', topItems(c2));
        break;
      }
      console.log('reorder', best.rule, 'd', best.d, topItems(best.e).slice(0, 6));
      c2 = best.e;
      path.push(c2);
    }
    console.log('final eq', c2 === R3, justify(c2, R3));
    break;
  }
}

// Also try: reorder FIRST then push
console.log('\n--- reorder then push ---');
cur = ensure(f3.left);
const R3items = topItems(R3);
// After push, j1 Os is inside Blb; for reorder-first we want top like R but with j1 Os still outside next to Blb
const targetTop = [
  'i \\Oc i_1',
  'R(i_1)',
  'j \\Oc j_2',
  'j \\Oc j_1',
  'R(j_2)',
  'R\\_(j_1)',
  'j_1 \\Os',
  '\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
];
function orderDist(A: string[], B: string[]) {
  let d = 0;
  const used = new Map<string, number>();
  for (let i = 0; i < A.length; i++) {
    const slots: number[] = [];
    for (let j = 0; j < B.length; j++) if (B[j] === A[i]) slots.push(j);
    const k = used.get(A[i]!) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length;
    used.set(A[i]!, k + 1);
    d += Math.abs(i - j);
  }
  return d + Math.abs(A.length - B.length) * 3;
}
for (let step = 0; step < 24; step++) {
  const items = topItems(cur);
  if (items.join('|') === targetTop.join('|')) break;
  const startD = orderDist(items, targetTop);
  let best: { e: string; d: number; rule: string } | null = null;
  for (let i = 0; i < items.length - 1; i++) {
    const e = swapAdj(cur, i);
    const d = orderDist(topItems(e), targetTop);
    if (d > startD) continue;
    const rule = justify(cur, e);
    if (!rule) continue;
    if (!best || d < best.d) best = { e, d, rule };
  }
  if (!best) {
    console.log('stuck at', topItems(cur), 'd', startD);
    break;
  }
  console.log('pre', best.rule, 'd', best.d, topItems(best.e));
  cur = best.e;
}
console.log('predone', topItems(cur).join(' | '));
for (const arms of variants) {
  const next = ensure(
    cur.replace(',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}', `,\\Blb{i_1 \\Ps j_2}${arms}`)
  );
  console.log('then push', arms.slice(0, 30), justify(cur, next), next === R3 || !!justify(next, R3));
}

// s5 / s9
for (const step of [5, 9]) {
  const f = fails.find((x) => x.key.includes('::202::') && x.step === step)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\ns' + step);
  console.log('L Ps count', (L.match(/j_2 \\Ps j_1/g) || []).length);
  console.log('R Ps count', (R.match(/j_2 \\Ps j_1/g) || []).length);
  if (step === 5) {
    const mid = ensure(
      L.replace(
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb',
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
      )
    );
    console.log('dup', justify(L, mid), mid === R);
    // try checking specific rules
    for (const rule of prefer.filter((r) => /r-27|identical|copy|Ps/.test(r.id)).slice(0, 40)) {
      if (checkInferenceRules(L, mid, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
        console.log('hit', rule.id);
      }
    }
    // scan ALL early rules for this transition (slow but once)
    let hits = 0;
    for (const rule of allRules.filter((r) => r.pos < pos)) {
      if (rule.id.includes('error-code') || rule.id.includes('equiv-code')) continue;
      if (checkInferenceRules(L, mid, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
        console.log('FULL hit', rule.id);
        hits++;
        if (hits > 3) break;
      }
    }
    if (!hits) console.log('no full hits for dup');
  } else {
    const mid = ensure(
      L.replace(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,', ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),')
    );
    console.log('drop', justify(L, mid), mid === R);
    let hits = 0;
    for (const rule of allRules.filter((r) => r.pos < pos)) {
      if (rule.id.includes('error-code') || rule.id.includes('equiv-code')) continue;
      if (checkInferenceRules(L, mid, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
        console.log('FULL hit', rule.id);
        hits++;
        if (hits > 3) break;
      }
    }
    if (!hits) console.log('no full hits for drop');
  }
}

// s11
{
  const f = fails.find((x) => x.key.includes('::202::') && x.step === 11)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\ns11');
  const pull = ensure(
    L.replace(
      '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
      'j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
    )
  );
  console.log('pull', justify(L, pull));
  if (justify(L, pull)) {
    // target after pull: items should become R
    // L items: i Oc i1, R(i1), j Oc j2, j Oc j1, R(j2), R_(j1), Blb{...j2 Os...}
    // after pull: i Oc i1, R(i1), j Oc j2, j Oc j1, R(j2), R_(j1), j2 Os, Blb{...}
    // R: i Oc i1, R(i1), j Oc j2, R(j2), j2 Os, j Oc j1, R_(j1), Blb
    let c = pull;
    const goal = topItems(R);
    for (let step = 0; step < 16; step++) {
      if (c === R || justify(c, R)) {
        console.log('done', step, c === R ? 'eq' : justify(c, R));
        break;
      }
      const items = topItems(c);
      const startD = orderDist(items, goal);
      let best: { e: string; d: number; rule: string } | null = null;
      for (let i = 0; i < items.length - 1; i++) {
        const e = swapAdj(c, i);
        const d = orderDist(topItems(e), goal);
        if (d > startD) continue;
        const rule = justify(c, e);
        if (!rule) continue;
        if (!best || d < best.d) best = { e, d, rule };
      }
      if (!best) {
        console.log('stuck', topItems(c));
        break;
      }
      console.log('sw', best.rule, topItems(best.e));
      c = best.e;
    }
  }
}
