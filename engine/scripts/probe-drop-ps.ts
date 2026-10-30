import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const start = normalizeSpacing(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps i_2,i_2 \\Ps j_1,'
);
const goal = normalizeSpacing(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_2 \\Ps j_1,'
);

const rules = [...axioms, ...definitions, ...theorems];
const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),/g;
const matches = [...start.matchAll(re)];
console.log('Ps atoms', matches.length, matches.map((m) => m[0]));

for (const m of matches) {
  const cand = normalizeSpacing(start.slice(0, m.index!) + ',' + start.slice(m.index! + m[0].length));
  console.log('\ntry drop', m[0], '->', cand.slice(0, 100));
  let hit = false;
  for (const rule of rules) {
    if (checkInferenceRules(start, cand, rule.leftSide, rule.rightSide).match) {
      console.log('  YES', rule.id, rule.leftSide, '=>', rule.rightSide);
      hit = true;
      break;
    }
  }
  if (!hit) console.log('  no');
}

// Also try dropping the two mid atoms as a block: ",i \Ps i_1,i_1 \Ps i_2,"
const block = ',i \\Ps i_1,i_1 \\Ps i_2,';
const idx = start.indexOf(block);
if (idx >= 0) {
  const cand = normalizeSpacing(start.slice(0, idx) + ',' + start.slice(idx + block.length));
  console.log('\ntry drop block', block);
  console.log(' cand', cand);
  for (const rule of rules) {
    if (checkInferenceRules(start, cand, rule.leftSide, rule.rightSide).match) {
      console.log('  YES', rule.id);
      break;
    }
  }
}

// Try going start -> goal directly
console.log('\ndirect start->goal');
for (const rule of rules) {
  if (checkInferenceRules(start, goal, rule.leftSide, rule.rightSide).match) {
    console.log('  YES', rule.id);
    break;
  }
}
console.log('done');
