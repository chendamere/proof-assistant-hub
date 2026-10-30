import { checkInferenceRules } from '../src/inferenceRules';
import { theorems } from '../../src/data/theorems';

const rule = theorems.find((t) => t.id.includes('identical-node-comparison-54'))!;

const cases: Array<[string, string, string]> = [
  ['distinct m', ',i \\Ps i_1, j_1 \\Pu,', ',j_1 \\Pu, i \\Ps i_1,'],
  ['same as j', ',i \\Ps i_1, i_1 \\Pu,', ',i_1 \\Pu, i \\Ps i_1,'],
  ['m=i', ',i \\Ps i_1, i \\Pu,', ',i \\Pu, i \\Ps i_1,'],
  ['only Ps swap names', ',a \\Ps b, c \\Pu,', ',c \\Pu, a \\Ps b,'],
];

for (const [label, a, b] of cases) {
  console.log(
    label,
    checkInferenceRules(a, b, rule.leftSide, rule.rightSide),
    checkInferenceRules(a, b, rule.rightSide, rule.leftSide)
  );
}

// Compare to a known working swap with shared names - r-24
const r24 = theorems.find((t) => t.id.includes('recursive-function-r-24'))!;
console.log('r24', checkInferenceRules(',R(i_1), R(i_2),', ',R(i_2), R(i_1),', r24.leftSide, r24.rightSide));

// identical-7 flip inside Blb works with shared context
const r7 = theorems.find((t) => t.id.includes('identical-node-comparison-7-lsifisj'))!;
console.log(
  'id7',
  checkInferenceRules(
    ',\\Blb{i_1 \\Ps j_2}{,}{,},',
    ',\\Blb{j_2 \\Ps i_1}{,}{,},',
    r7.leftSide,
    r7.rightSide
  )
);
