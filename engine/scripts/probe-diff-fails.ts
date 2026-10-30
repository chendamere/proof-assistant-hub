import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { armFactorStep, oneSiteToward, oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (new Set(axioms.map((r) => r.id)).has(rule.id) || new Set(definitions.map((r) => r.id)).has(rule.id))
    return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
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
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: getPositionForRule(r),
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
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const lines = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const seen = new Set<string>();
const fails = lines.filter((f) => {
  const id = `${f.key}::${f.step}::${f.left}`;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
});

const pick = process.argv[2] ?? '100';
const subset = fails.filter((f) => f.key.includes(`::${pick}::`));
for (const f of subset) {
  const pos = 13 * 100000 + parseInt(pick, 10);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n==== thm', pick, 'step', f.step, 'len', L.length, R.length, 'eq', L === R);
  if (L !== R) {
    for (let i = 0; i < Math.min(L.length, R.length); i++) {
      if (L[i] !== R[i]) {
        console.log('diff@', i, JSON.stringify(L.slice(i, i + 60)), '||', JSON.stringify(R.slice(i, i + 60)));
        break;
      }
    }
    if (L.length !== R.length) console.log('lenDiff', L.length - R.length);
  }
  const arm = armFactorStep(L, R);
  const site = oneSiteToward(L, R);
  console.log('direct', justify(L, R, pos));
  console.log('arm', arm ? justify(L, arm, pos) : null, arm && arm.slice(0, 100));
  console.log('site', site ? justify(L, site, pos) : null, site && site.slice(0, 100));

  // Greedy adjacent: try swap rules that improve token order
  if (!arm && !site) {
    let best: { id: string; d: number; e: string } | null = null;
    const startD = Math.abs(L.length - R.length) + [...L].reduce((n, c, i) => n + (c !== R[i] ? 1 : 0), 0);
    for (const rule of allRules.filter((r) => r.pos < pos && /swap|identical|release|copy|recursive-function-r-1[0-7]|null-comparison|node-connectivity-[0-3]/i.test(r.id)).slice(0, 120)) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const e = ensure(raw);
        if (e === L) continue;
        const d = Math.abs(e.length - R.length) + [...e].reduce((n, c, i) => n + (c !== R[i] ? 1 : 0), 0);
        if (d >= startD) continue;
        if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: indexBefore(pos).dagCache }).match)
          continue;
        if (!best || d < best.d) best = { id: rule.id, d, e };
      }
    }
    console.log('rewriteBest', best?.id, best?.d);
  }
}
