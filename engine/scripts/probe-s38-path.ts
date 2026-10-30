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

const pos = 13 * 100000 + 100;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function just(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::100::') && x.step === 38)!;
const L = ensure(f.left);
const R = ensure(f.right);
console.log('direct', just(L, R));

// Path: dup Ps → move one before R via ??? → drop/swap
// From book: want to reach i_1 Ps i_2, R(i_1), R(i_2), i_1 Ps i_2, R(j_1) then drop leading? no
// Reverse-engineer from goal:
// R = ..., i_1 Ps i_2, R(i_2), R(i_1), R(j_1), Bb
// Try: R_with_trail = ..., i_1 Ps i_2, R(i_2), R(i_1), i_1 Ps i_2, R(j_1), Bb
const midA = R.replace(
  'i_1 \\Ps i_2, R(i_2), R(i_1), R(j_1)',
  'i_1 \\Ps i_2, R(i_2), R(i_1), i_1 \\Ps i_2, R(j_1)'
);
console.log('goal←add trail', midA !== R, just(midA, R).slice(0, 2));
console.log('L→midA', just(L, midA).slice(0, 2));

const midB = midA.replace(
  'i_1 \\Ps i_2, R(i_2), R(i_1), i_1 \\Ps i_2',
  'i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2'
);
console.log('midA↔swapR', just(midA, midB).slice(0, 2), just(midB, midA).slice(0, 2));

// From L: R(i_1),R(i_2),i_1 Ps i_2,R(j_1) → i_1 Ps i_2, R(i_1), R(i_2), i_1 Ps i_2, R(j_1)
const midC = L.replace(
  'R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1)',
  'i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1)'
);
console.log('L→midC (insert lead keep trail)', midC !== L, just(L, midC).slice(0, 3));
console.log('midC→midB', just(midC, midB).slice(0, 2));
console.log('midB→midA', just(midB, midA).slice(0, 2));
console.log('midA→R', just(midA, R).slice(0, 2));

// Try dup on L first
const midD = L.replace(
  'R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1)',
  'R(i_1), R(i_2), i_1 \\Ps i_2, i_1 \\Ps i_2, R(j_1)'
);
console.log('L→dup', just(L, midD).slice(0, 2));
console.log('dup→midC', just(midD, midC).slice(0, 3));

// 202 s19 full
const f202 = fails.find((x) => x.key.includes('::202::') && x.step === 19)!;
const L202 = ensure(f202.left);
const R202 = ensure(f202.right);
console.log('\n202 s19 direct', just(L202, R202).slice(0, 3));
const flip1 = L202.replace('\\Blb{i_1 \\Ps j_2}', '\\Blb{j_2 \\Ps i_1}');
console.log('flip1', just(L202, flip1).slice(0, 2));
const via72 = flip1.replace('\\Blb{j_2 \\Ps i_1}', '\\Blb{j_1 \\Ps i_1}');
console.log('72', just(flip1, via72).slice(0, 2));
const flip2 = via72.replace('\\Blb{j_1 \\Ps i_1}', '\\Blb{i_1 \\Ps j_1}');
console.log('flip2', just(via72, flip2).slice(0, 2));
console.log('flip2==R?', flip2 === R202, just(flip2, R202).slice(0, 2));

// 124 s181 — try empty-branch rules via oneStepRewrites
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
const f181 = fails.find((x) => x.key.includes('::124::') && x.step === 181)!;
const L181 = ensure(f181.left);
const R181 = ensure(f181.right);
console.log('\n124 s181 direct', just(L181, R181).slice(0, 3));
const eb = rules.filter((r) => /empty-branch|flag|release|identical-node-comparison-79|operators/.test(r.id));
let found = 0;
for (const rule of eb) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(L181, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (!checkInferenceRules(L181, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      continue;
    const d = Math.abs(e.length - R181.length);
    if (e === R181 || d < 40 || /\\Bb\{i \\Pu\}/.test(L181) !== /\\Bb\{i \\Pu\}/.test(e)) {
      console.log('181 rewrite', rule.id, '→', e.slice(0, 100), e === R181 ? 'GOAL' : '');
      found++;
      if (found > 8) break;
    }
  }
  if (found > 8) break;
}
console.log('181 rewrite hits', found);
