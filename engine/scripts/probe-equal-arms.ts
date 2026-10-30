import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
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
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

// Find rules where both arms of Bb/Blb appear equal on one side and collapse on the other
let n = 0;
for (const t of [...axioms, ...definitions, ...theorems]) {
  const sides = [t.leftSide, t.rightSide];
  const equalArm = sides.some((s) => /\\B[a-z]*\{[^}]*\}\{([^}]*)\}\{\1\}/.test(s));
  if (!equalArm) continue;
  console.log(t.id);
  console.log(' L', t.leftSide);
  console.log(' R', t.rightSide);
  console.log();
  if (++n > 30) break;
}
console.log('equal-arm rules', n);

// Try ALL rules' oneStepRewrites on 181 that reduce Bb count
const pos = 13 * 100000 + 124;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  dag
);
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::124::') && x.step === 181)!;
const L = ensure(f.left);
const R = ensure(f.right);

console.log('\nScanning rewrites that drop Bb or shorten toward goal…');
let hits = 0;
for (const rule of allRules.filter((r) => r.pos < pos)) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (e === L) continue;
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      continue;
    const bbL = (L.match(/\\Bb|\\Blb/g) || []).length;
    const bbE = (e.match(/\\Bb|\\Blb/g) || []).length;
    if (bbE < bbL || e === R || Math.abs(e.length - R.length) < Math.abs(L.length - R.length)) {
      console.log(rule.id, 'bb', bbL, '→', bbE, e.slice(0, 160));
      hits++;
    }
  }
  if (hits > 20) break;
}
console.log('hits', hits);

// Also try from eb2 mid
const mid =
  ',\\Bb{}{,i \\Pu,j \\Oc j_1,}{,i \\nPu,j \\Oc j_1,},i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,i_2 \\Os,j_1 \\Os,';
console.log('\nFrom mid, scan…');
hits = 0;
for (const rule of allRules.filter((r) => r.pos < pos)) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(mid, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (e === ensure(mid)) continue;
    if (!checkInferenceRules(ensure(mid), e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      continue;
    const bbM = (mid.match(/\\Bb|\\Blb/g) || []).length;
    const bbE = (e.match(/\\Bb|\\Blb/g) || []).length;
    if (bbE < bbM || e === R || e.length < mid.length - 5) {
      console.log(rule.id, 'bb', bbM, '→', bbE, e.slice(0, 160));
      hits++;
    }
  }
  if (hits > 25) break;
}
console.log('mid hits', hits);
