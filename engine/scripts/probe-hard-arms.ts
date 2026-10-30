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
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function dist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const thm = process.argv[2] ?? '100';
const step = parseInt(process.argv[3] ?? '38', 10);
const f = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes(`::${thm}::`) && x.step === step);
if (!f) {
  console.error('not found', thm, step);
  process.exit(1);
}
const L = ensure(f.left);
const R = ensure(f.right);
const pos = 13 * 100000 + parseInt(thm, 10);
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function justify(a: string, b: string) {
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

console.log('startD', dist(L, R));
console.log('L', L.slice(0, 200));
console.log('R', R.slice(0, 200));

let cur = L;
const path: string[] = [];
for (let stepN = 0; stepN < 12 && cur !== R; stepN++) {
  const startD = dist(cur, R);
  let best: { id: string; e: string; d: number } | null = null;
  const focus = rules.filter((r) =>
    /swap|identical|recursive-function-r|release|copy|Ps|R\(|null|flag|node-connectivity-[0-3]/i.test(
      r.id + r.leftSide
    )
  );
  for (const rule of focus) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (e === cur) continue;
      const d = dist(e, R);
      if (e !== R && d >= startD) continue;
      if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      if (!best || d < best.d || e === R) best = { id: rule.id, e, d };
      if (e === R) break;
    }
    if (best?.e === R) break;
  }
  if (!best) {
    console.log('stuck', stepN, 'd', startD);
    break;
  }
  console.log('hop', stepN, best.id, 'd', best.d);
  path.push(best.e);
  cur = best.e;
}
console.log('done', cur === R, 'hops', path.length);
