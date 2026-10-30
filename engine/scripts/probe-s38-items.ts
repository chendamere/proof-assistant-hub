import fs from 'fs';
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
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
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

const pos = 13 * 100000 + 100;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function just(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::100::') && x.step === 38)!;
const L = ensure(f.left);
const R = ensure(f.right);
const a = topItems(L);
const b = topItems(R);
console.log('L items around R/Ps:');
for (let i = 0; i < a.length; i++) {
  if (/R\(|Ps|Bb|Oc/.test(a[i]!)) console.log(i, a[i]!.slice(0, 60));
}
console.log('R items:');
for (let i = 0; i < b.length; i++) {
  if (/R\(|Ps|Bb|Oc/.test(b[i]!)) console.log(i, b[i]!.slice(0, 60));
}

// Book path reverse of 554-580:
// Start L items: ... R(i_1), R(i_2), i_1 Ps i_2, R(j_1), Bb
// Want: ... i_1 Ps i_2, R(i_2), R(i_1), R(j_1), Bb
//
// Known working subpath when Ps is BEFORE R:
// dup, swap R, drop, r-27, bubble, drop trail
//
// Forward from L using item ops:
function tryPath(label: string, steps: string[][]) {
  let cur = a.slice();
  const path: string[] = [];
  for (const next of steps) {
    const e0 = joinItems(cur);
    const e1 = joinItems(next);
    const id = just(e0, e1);
    console.log(label, id || 'FAIL', 'dItems', next.length - cur.length);
    if (!id) return null;
    path.push(e1);
    cur = next;
  }
  const ok = joinItems(cur) === R;
  console.log(label, 'reaches goal?', ok);
  return ok ? path : path;
}

const iR1 = a.findIndex((x) => x === 'R(i_1)');
const iR2 = a.findIndex((x) => x === 'R(i_2)');
const iPs = a.findIndex((x) => x === 'i_1 \\Ps i_2');
const iRj = a.findIndex((x) => x === 'R(j_1)');
console.log('indices', { iR1, iR2, iPs, iRj });

// Path A: duplicate Ps at iPs, then ... 
{
  const s1 = a.slice();
  s1.splice(iPs + 1, 0, 'i_1 \\Ps i_2');
  console.log('\n--- dup Ps ---');
  console.log('just dup', just(joinItems(a), joinItems(s1)));
}

// Path B: from goal backward
{
  console.log('\n--- from goal backward ---');
  const g = b.slice();
  // add trailing Ps after R(i_1): find i_1 Ps, R(i_2), R(i_1), R(j_1)
  const gi = g.findIndex((x) => x === 'i_1 \\Ps i_2');
  const gR2 = g.findIndex((x) => x === 'R(i_2)');
  const gR1 = g.findIndex((x) => x === 'R(i_1)');
  console.log('goal idx', { gi, gR2, gR1 });
  const s1 = g.slice();
  // insert Ps after R(i_1) before R(j_1)
  const at = g.findIndex((x) => x === 'R(j_1)');
  s1.splice(at, 0, 'i_1 \\Ps i_2');
  console.log('goal ← add trail after R pair', just(joinItems(s1), joinItems(g)));
  // swap R(i_2),R(i_1) in s1
  const s2 = s1.slice();
  const p2 = s2.findIndex((x) => x === 'R(i_2)');
  const p1 = s2.findIndex((x) => x === 'R(i_1)');
  if (p2 >= 0 && p1 === p2 + 1) {
    s2[p2] = 'R(i_1)';
    s2[p1] = 'R(i_2)';
  }
  console.log('s1 ↔ swap R', just(joinItems(s1), joinItems(s2)));
  // Now s2 should be: i_1 Ps, R(i_1), R(i_2), i_1 Ps, R(j_1)
  // Drop leading Ps: R(i_1), R(i_2), i_1 Ps, R(j_1)  -- need a rule!
  const s3 = s2.slice();
  const lead = s3.findIndex((x) => x === 'i_1 \\Ps i_2');
  s3.splice(lead, 1);
  console.log('s2 → drop leading Ps', just(joinItems(s2), joinItems(s3)));
  console.log('s3 == L?', joinItems(s3) === L);
  // Drop trailing instead: i_1 Ps, R(i_1), R(i_2), R(j_1)
  const s4 = s2.slice();
  const trailIdx = (() => {
    let seen = false;
    for (let i = 0; i < s4.length; i++) {
      if (s4[i] === 'i_1 \\Ps i_2') {
        if (seen) return i;
        seen = true;
      }
    }
    return -1;
  })();
  if (trailIdx >= 0) s4.splice(trailIdx, 1);
  console.log('s2 → drop trailing Ps', just(joinItems(s2), joinItems(s4)));
}

// Check if r-22 fires for R(j_1) past Ps (non-colliding)
{
  const s = a.slice();
  // swap iPs with iRj
  const tmp = s[iPs]!;
  s[iPs] = s[iRj]!;
  s[iRj] = tmp;
  console.log('\nswap Ps with R(j_1)', just(joinItems(a), joinItems(s)));
}
