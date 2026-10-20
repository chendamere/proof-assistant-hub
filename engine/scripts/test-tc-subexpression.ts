/**
 * Soundness checks for \\Tc instantiation + Brs suffix substitution.
 * Usage: npx tsx engine/scripts/test-tc-subexpression.ts
 */

import { checkInferenceRules } from '../src/inferenceRules';
import { dagToExpr, exprToDAG } from '../src/dag';

function expectMatch(name: string, left: string, right: string, ruleL: string, ruleR: string, should: boolean): void {
  const result = checkInferenceRules(left, right, ruleL, ruleR);
  const ok = result.match === should;
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}: match=${result.match} expected=${should}${result.inferenceRule ? ` (${result.inferenceRule})` : ''}`);
  if (!ok) process.exitCode = 1;
  if (ok && should && result.matchPosition) {
    const pl = result.matchPosition.instantiatedPatternLeft;
    const pr = result.matchPosition.instantiatedPatternRight;
    if (pl && pr) console.log(`    pattern ${pl} ⟺ ${pr}`);
  }
}

const errorL = ',\\Or,';
const errorR = ',\\Or, \\Tc code,';
const distL = ',\\Brs{,}{,} ,\\Tc c,';
const distR = ', \\Brs{,\\Tc c,}{,\\Tc c,},';

const th11s0L = ',\\Brs{,\\Tc c,}{,\\Or,} ,';
const th11s0R = ',\\Brs{,\\Tc c,}{,\\Or,\\Tc c,} ,';
const th11s1L = th11s0R;
const th11s1R = ',\\Brs{,}{,\\Or,} ,\\Tc c,';

expectMatch('th11 step0 via error-code', th11s0L, th11s0R, errorL, errorR, true);
expectMatch('th11 step1 via code distribution (Brs arm suffix)', th11s1L, th11s1R, distL, distR, true);
expectMatch('th11 step1 not via error-code', th11s1L, th11s1R, errorL, errorR, false);

expectMatch(
  'th12 step1 via code distribution',
  ',\\Brs{,\\Or,\\Tc c,}{,\\Tc c,} ,',
  ',\\Brs{,\\Or,}{,},\\Tc c,',
  distL,
  distR,
  true
);

expectMatch(
  'code distribution overlays Bb (chapter 2 style)',
  ',\\Bb{i \\Pe j}{,\\Tc c,}{,\\Or,\\Tc c,},',
  ',\\Bb{i \\Pe j}{,}{,\\Or,},\\Tc c,',
  distL,
  distR,
  true
);

expectMatch(
  'Brs does not overlay Blb',
  ',\\Blb{i \\Pe j}{,\\Tc c,}{,\\Or,\\Tc c,},',
  ',\\Blb{i \\Pe j}{,}{,\\Or,},\\Tc c,',
  distL,
  distR,
  false
);

expectMatch(
  'empty-arm distribution of a concrete fragment',
  ',\\Brs{,}{,}, i \\On,',
  ',\\Brs{,i \\On,}{,i \\On,},',
  distL,
  distR,
  true
);

expectMatch(
  'code distribution does not prove an operator swap',
  ',i \\Od m, j \\Op,',
  ',j \\On, j \\Op, i \\Od m, j \\Op,',
  distL,
  distR,
  false
);

const nestL = ', \\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_2,},';
const nestR = ', \\Bb{i \\Oe j}{, \\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_3,},}{,\\Tc c_2,} ,';
const swapL = ',i \\Od m, j \\Op,';
const swapR = ',j \\On, j \\Op, i \\Od m, j \\Op,';
for (const [id, ruleL, ruleR] of [
  ['error-code', errorL, errorR],
  ['code distribution', distL, distR],
  ['nest-left', nestL, nestR],
] as const) {
  expectMatch(`${id} does not prove a next/prev insertion`, swapL, swapR, ruleL, ruleR, false);
}

const round = dagToExpr(exprToDAG(',\\Brs{,\\Tc c,}{,\\Or,},'));
const roundOk = round.includes('\\Tc') && round.includes('\\Or');
console.log(`${roundOk ? 'OK' : 'FAIL'} Brs arm roundtrip: ${round}`);
if (!roundOk) process.exitCode = 1;

if (process.exitCode) console.log('\nSome checks failed');
else console.log('\nAll checks passed');
