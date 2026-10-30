/** Fast probe: bubble+ident70 drops for 124 s54/s62/s86. */
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

const POS = 13 * 100000 + 124;
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
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function solveTo(L0: string, R0: string, max = 40): string[] | null {
  const R = ensure(R0);
  const rItems = topItems(R);
  const rCount = new Map<string, number>();
  for (const x of rItems) rCount.set(x, (rCount.get(x) ?? 0) + 1);

  let cur = ensure(L0);
  const path: string[] = [];
  const seen = new Set<string>([cur]);

  const score = (e: string) => {
    const items = topItems(e);
    const c = new Map<string, number>();
    for (const x of items) c.set(x, (c.get(x) ?? 0) + 1);
    let extra = 0;
    let missing = 0;
    for (const [k, v] of c) {
      const need = rCount.get(k) ?? 0;
      if (v > need) extra += v - need;
    }
    for (const [k, v] of rCount) {
      const have = c.get(k) ?? 0;
      if (have < v) missing += v - have;
    }
    // order distance
    let ord = 0;
    const ri = rItems;
    let j = 0;
    for (const x of items) {
      if (j < ri.length && x === ri[j]) j++;
      else ord++;
    }
    return extra * 100 + missing * 1000 + ord + Math.abs(items.length - ri.length);
  };

  for (let step = 0; step < max; step++) {
    if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
    const items = topItems(cur);
    const candidates: { e: string; s: number; why: string }[] = [];

    // adjacent swaps
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const e = joinItems(sw);
      if (seen.has(e)) continue;
      if (!justify(cur, e)) continue;
      candidates.push({ e, s: score(e), why: `swap ${items[i]}` });
    }
    // drop adjacent duplicate (ident70 reverse etc)
    for (let i = 0; i < items.length - 1; i++) {
      if (items[i] !== items[i + 1]) continue;
      const next = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
      if (seen.has(next)) continue;
      if (!justify(cur, next)) continue;
      candidates.push({ e: next, s: score(next), why: `dedupe ${items[i]}` });
    }
    // try drop any single atom that is excess vs R
    const c = new Map<string, number>();
    for (const x of items) c.set(x, (c.get(x) ?? 0) + 1);
    for (let i = 0; i < items.length; i++) {
      const need = rCount.get(items[i]!) ?? 0;
      const have = c.get(items[i]!) ?? 0;
      if (have <= need) continue;
      const next = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
      if (seen.has(next)) continue;
      if (!justify(cur, next)) continue;
      candidates.push({ e: next, s: score(next), why: `drop excess ${items[i]}` });
    }

    candidates.sort((a, b) => a.s - b.s);
    if (!candidates.length) {
      console.log('stuck', cur);
      return null;
    }
    const best = candidates[0]!;
    console.log('  ', best.why, 'score', best.s, justify(cur, best.e));
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === R || justify(cur, R) ? path.filter((p) => ensure(p) !== R) : null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((f) => [54, 62, 86, 98].includes(f.step));

for (const f of fails) {
  console.log('\n==== s' + f.step + ' ====');
  const chain = solveTo(f.left, f.right);
  console.log(chain ? `OK +${chain.length}` : 'FAIL');
  if (chain) {
    let cur = ensure(f.left);
    for (const m of chain) {
      console.log(' ', justify(cur, m));
      cur = ensure(m);
    }
    console.log(' tail', justify(cur, f.right));
  }
}
