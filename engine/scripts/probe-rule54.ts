import { checkInferenceRules } from '../src/inferenceRules';
import { theorems } from '../../src/data/theorems';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { InferenceRules } from '../src/inferenceRules/rules';

const rule = theorems.find((t) => t.id.includes('identical-node-comparison-54'))!;
console.log('rule', JSON.stringify(rule.leftSide), JSON.stringify(rule.rightSide));

const pairs: Array<[string, string, string]> = [
  ['exact', rule.leftSide, rule.rightSide],
  ['book', ',i \\Ps i_1, i_1 \\Pu,', ',i_1 \\Pu, i \\Ps i_1,'],
  ['nospace', ',i \\Ps i_1,i_1 \\Pu,', ',i_1 \\Pu,i \\Ps i_1,'],
  ['norm book', normalizeSpacing(',i \\Ps i_1, i_1 \\Pu,'), normalizeSpacing(',i_1 \\Pu, i \\Ps i_1,')],
];

for (const [label, a, b] of pairs) {
  const r = checkInferenceRules(a, b, rule.leftSide, rule.rightSide);
  console.log(label, r);
  if (!r.match) {
    for (const inf of InferenceRules) {
      const x = inf.check(a, b, rule.leftSide, rule.rightSide);
      if (x.match) console.log('  via', inf.name);
    }
  }
}

const r22 = theorems.find((t) => t.id.includes('recursive-function-r-22'))!;
console.log(
  'r22',
  checkInferenceRules(',m \\Ps n, R(i),', ',R(i), m \\Ps n,', r22.leftSide, r22.rightSide)
);

// List other swap Pu rules near 54
for (const t of theorems) {
  if (!t.id.includes('identical-node-comparison-5')) continue;
  if (!/\\Pu/.test(t.leftSide + t.rightSide)) continue;
  console.log(t.id, t.leftSide, '⟺', t.rightSide);
  console.log(
    '  book',
    checkInferenceRules(',i \\Ps i_1, i_1 \\Pu,', ',i_1 \\Pu, i \\Ps i_1,', t.leftSide, t.rightSide).match
  );
}
