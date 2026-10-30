import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const from = normalizeSpacing(
  ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);
const goal = normalizeSpacing(
  ',i \\Ps i_1,i \\On,i \\Oc i_2,i_1 \\Pu,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);
const mid1 = normalizeSpacing(
  ',i \\Ps i_1,i \\On,i_1 \\Pu,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);
const mid2 = normalizeSpacing(
  ',i \\Ps i_1,i \\On,i \\Oc i_2,i_1 \\Pu,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);

const rules = [...axioms, ...definitions, ...theorems].filter((r) =>
  /swap|Pu|On|Oc|release|identical|operators/i.test(r.id)
);

function tryPair(a: string, b: string, label: string) {
  console.log('---', label);
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(a, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const expr of rewrites) {
      const n = normalizeSpacing(expr);
      if (n === b || n === mid1 || n === mid2) {
        const ok = checkInferenceRules(a, n, rule.leftSide, rule.rightSide).match;
        console.log('hit', rule.id, 'ok', ok, n.slice(0, 90));
      }
    }
  }
}

tryPair(from, mid1, 'from->mid1');
tryPair(mid1, mid2, 'mid1->mid2');
tryPair(from, goal, 'from->goal');

// List any one-step neighbors that look like bubbling Pu
console.log('--- neighbors of from mentioning On before Pu');
let count = 0;
for (const rule of rules) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(from, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const expr of rewrites) {
    const n = normalizeSpacing(expr);
    if (n === from) continue;
    if (!n.includes('i_1 \\Pu')) continue;
    const pu = n.indexOf('i_1 \\Pu');
    const on = n.indexOf('i \\On');
    if (on >= 0 && on < pu) {
      console.log(rule.id, n.slice(0, 100));
      count++;
      if (count > 15) break;
    }
  }
  if (count > 15) break;
}
console.log('count', count);
