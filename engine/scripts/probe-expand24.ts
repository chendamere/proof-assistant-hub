/**
 * Find which earlier rule justifies thm24 step 5 expand (Bb m Pc n → Oc+R+Bb Ps).
 */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}
function toBook(expr: string): string {
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
function dist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 5);
const L = ensure(f.left);
const R = ensure(f.right);
const pos = 13 * 100000 + 24;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: getPositionForRule(r) }))
  .filter((r) => r.pos < pos)
  .filter((r) => /Pc|Ps|Bb|Oc|connectivity|node-ring|identical|recursive|swap|operators/i.test(r.id + r.leftSide));

console.log('rules', rules.length, 'startD', dist(L, R));
let best: { id: string; expr: string; d: number } | null = null;
let hits = 0;
for (const rule of rules) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (e === L) continue;
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide).match) continue;
    hits++;
    const d = dist(e, R);
    if (!best || d < best.d) {
      best = { id: rule.id, expr: e, d };
      console.log('better', rule.id, 'd', d, e.slice(0, 140));
    }
    if (e === R) {
      console.log('GOAL via', rule.id);
      process.exit(0);
    }
  }
}
console.log('hits', hits, 'best', best?.id, best?.d);
if (best) console.log(best.expr.slice(0, 300));
