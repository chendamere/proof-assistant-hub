import { theorems } from '../../src/data/theorems';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { checkInferenceRules } from '../src/inferenceRules';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const rule = theorems.find((r) => r.id === 'theorems-of-node-null-comparison-29-iumnm')!;
const oc = theorems.find((r) => r.id.includes('null-comparison') && r.leftSide.includes('\\Pu') && r.leftSide.includes('\\Oc'))!;
const from = normalizeSpacing(',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),');
console.log('rule', rule?.id, rule?.leftSide, '=>', rule?.rightSide);
console.log('oc rule', oc?.id, oc?.leftSide, '=>', oc?.rightSide);
const rw = oneStepRewrites(from, rule.leftSide, rule.rightSide);
console.log('rewrites', rw.length);
for (const e of rw) console.log(' ', normalizeSpacing(e));
const mid = normalizeSpacing(',i \\Ps i_1,i \\On,i_1 \\Pu,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),');
console.log('check mid', checkInferenceRules(from, mid, rule.leftSide, rule.rightSide));
const goal = normalizeSpacing(',i \\Ps i_1,i \\On,i \\Oc i_2,i_1 \\Pu,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),');
const rw2 = oneStepRewrites(mid, oc.leftSide, oc.rightSide);
console.log('mid-> via oc', rw2.map((e) => normalizeSpacing(e)));
console.log('check goal', checkInferenceRules(mid, goal, oc.leftSide, oc.rightSide).match);
