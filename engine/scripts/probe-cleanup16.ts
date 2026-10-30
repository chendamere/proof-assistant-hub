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

const f = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes('::108::') && x.step === 107)!;
const goal = ensure(f.right);
let cur = ensure(f.left);
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r.id) }))
  .filter((r) => r.pos < 13 * 100000 + 108);

const r0 = rules.find((r) => r.id === 'rules-of-empty-branch-function-3-lbifisj')!;
const r1 = rules.find((r) => r.id === 'theorems-of-identical-node-comparison-33-isjmcn')!;
for (const rule of [r0, r1]) {
  const rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
  let best: string | null = null;
  let bestD = dist(cur, goal);
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide).match) continue;
    const d = dist(e, goal);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  console.log(rule.id, 'bestD', bestD);
  if (best) {
    console.log('expr', best);
    cur = best;
  }
}
console.log('goal', goal);
console.log('remaining diff:');
for (let i = 0; i < Math.min(cur.length, goal.length); i++) {
  if (cur[i] !== goal[i]) {
    console.log(' @', i, JSON.stringify(cur.slice(i, i + 80)));
    console.log('   ', JSON.stringify(goal.slice(i, i + 80)));
    break;
  }
}
