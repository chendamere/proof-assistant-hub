/** Probe first hops for remaining ch16 fails. */
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneSiteToward, oneStepRewrites, armFactorStep } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
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
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch16.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const sample = fails.filter(
  (f: { key: string; step: number }) =>
    (f.key.includes('::6::') && [0, 9, 11].includes(f.step)) ||
    (f.key.includes('::12::') && [6, 7].includes(f.step)) ||
    (f.key.includes('::23::') && [0, 3, 4].includes(f.step)) ||
    (f.key.includes('::145::') && f.step === 0)
);

for (const f of sample) {
  const pos = keyPos(f.key);
  const index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    new Map()
  );
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n===', f.key.split('::')[1], 's' + f.step, '===');
  console.log('L', L.slice(0, 120));
  console.log('R', R.slice(0, 120));
  const one = oneSiteToward(L, R, index, { maxCands: 40 });
  console.log(
    'oneSite',
    one?.slice(0, 3).map((c) => ({ id: c.ruleId, d: c.expr.length, e: c.expr.slice(0, 80) }))
  );
  const arm = armFactorStep(L, R, index);
  console.log('armFactor', arm?.slice(0, 2).map((c) => ({ id: c.ruleId, e: c.expr.slice(0, 80) })));
  const rew = oneStepRewrites(L, index, { max: 30 }).filter((c) => {
    // prefer shrink or shared tokens with R
    return c.expr.length <= L.length + 20;
  });
  console.log(
    'rewrites',
    rew.slice(0, 5).map((c) => ({ id: c.ruleId, e: c.expr.slice(0, 70) }))
  );
}
