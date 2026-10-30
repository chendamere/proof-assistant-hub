/**
 * Manually search a short chain for thm24 step 5 using connectivity-0 expand.
 */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites, armFactorStep, oneSiteToward } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';

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
function tokenDist(a: string, b: string): number {
  const toks = (s: string) =>
    ensure(s)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const A = toks(a);
  const B = toks(b);
  const counts = new Map<string, number>();
  for (const t of A) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const t of B) counts.set(t, (counts.get(t) ?? 0) - 1);
  let d = 0;
  for (const v of counts.values()) d += Math.abs(v);
  const n = Math.min(A.length, B.length);
  let order = Math.abs(A.length - B.length);
  for (let i = 0; i < n; i++) if (A[i] !== B[i]) order++;
  return d * 3 + order;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 5);
const goal = ensure(f.right);
let cur = ensure(f.left);
const pos = 13 * 100000 + 24;
const allRules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: getPositionForRule(r) }))
  .filter((r) => r.pos < pos);
const dag = new Map();
const index = buildRuleIndex(allRules, dag);

function justify(from: string, to: string) {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      return rule.id;
    }
  }
  return null;
}

const focusIds = /node-connectivity-0|node-connectivity-1|node-connectivity-2|identical|swap|recursive-function-r-1[0-9]/i;
const focus = allRules.filter((r) => focusIds.test(r.id));

const path: string[] = [];
const ids: string[] = [];
for (let step = 0; step < 16 && cur !== goal; step++) {
  const startD = tokenDist(cur, goal);
  let best: { expr: string; id: string; d: number } | null = null;

  const arm = armFactorStep(cur, goal);
  if (arm) {
    const id = justify(cur, arm);
    if (id) {
      const d = tokenDist(arm, goal);
      if (d < startD) best = { expr: ensure(arm), id, d };
    }
  }
  const site = oneSiteToward(cur, goal);
  if (site) {
    const id = justify(cur, site);
    if (id) {
      const d = tokenDist(site, goal);
      if (!best || d < best.d) best = { expr: ensure(site), id, d };
    }
  }

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
      const d = tokenDist(e, goal);
      if (e !== goal && d > startD + 4) continue;
      if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      if (!best || d < best.d || (d === best.d && e === goal)) best = { expr: e, id: rule.id, d };
      if (e === goal) break;
    }
    if (best?.expr === goal) break;
  }

  if (!best || best.d >= startD) {
    console.log('stuck at', step, 'd', startD);
    console.log(cur.slice(0, 220));
    break;
  }
  console.log('hop', step, best.id, 'd', best.d);
  path.push(best.expr);
  ids.push(best.id);
  cur = best.expr;
}
console.log('done', cur === goal, 'hops', path.length);
console.log(JSON.stringify({ ids, path: path.map((p) => p.slice(0, 80)) }, null, 2));
