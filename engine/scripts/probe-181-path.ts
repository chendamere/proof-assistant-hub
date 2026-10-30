import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
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
const f = fails.find((x) => x.key.includes('::124::') && x.step === 181)!;
const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);

const eb2 = allRules.find((r) => r.id.includes('empty-branch-function-2'))!;
const rw = oneStepRewrites(L, eb2.leftSide, eb2.rightSide);
console.log('eb2 rewrites', rw.length);
for (const raw of rw) {
  const e = ensure(raw);
  if (!checkInferenceRules(L, e, eb2.leftSide, eb2.rightSide, { dagCache: index.dagCache }).match) continue;
  console.log('step1', e);
  const id = just(L, e);
  console.log(' just', id);

  // drop Pu/nPu from arms
  let cur = e;
  const dropPu = cur.replace(',i \\Pu,', ',');
  console.log('drop Pu', just(cur, ensure(dropPu)));
  if (just(cur, ensure(dropPu))) cur = ensure(dropPu);
  const dropN = cur.replace(',i \\nPu,', ',');
  console.log('drop nPu', just(cur, ensure(dropN)));
  if (just(cur, ensure(dropN))) cur = ensure(dropN);
  console.log('after flag drops', cur);

  // identical arms collapse / empty-branch-1 pull
  const eb1 = allRules.find((r) => r.id.includes('empty-branch-function-1'))!;
  for (const rule of [eb1, ...allRules.filter((r) => r.pos < pos && /empty-branch|equiv-code-dist/.test(r.id))]) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const r2 of rewrites) {
      const e2 = ensure(r2);
      if (!checkInferenceRules(cur, e2, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      console.log('step2', rule.id, e2);
      console.log('  →R?', e2 === R, just(e2, R));
    }
  }

  // syntactic: Bb{}{,j Oc,}{,j Oc,} → j Oc, Bb{}{,}{,}
  const pull = cur.replace(/\\Bb\{\}\{,j \\Oc j_1,\}\{,j \\Oc j_1,\},/, 'j \\Oc j_1, \\Bb{}{,}{,},');
  console.log('pull', just(cur, ensure(pull)), ensure(pull));
  if (just(cur, ensure(pull))) {
    const dropEmpty = ensure(pull).replace(', \\Bb{}{,}{,},', ',').replace('\\Bb{}{,}{,},', '');
    console.log('drop empty', just(ensure(pull), ensure(dropEmpty)), ensure(dropEmpty) === R, ensure(dropEmpty));
  }
}
