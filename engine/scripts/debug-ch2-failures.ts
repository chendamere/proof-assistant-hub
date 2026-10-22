import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { theorems } from '../../src/data/theorems';

const cases = [
  {
    name: 't17 step2 insert empty Bb before Or',
    L: ',\\Bb{ m \\Pe n}{,\\Bb{i \\Pe j}{,\\Tc c_1,}{,\\Tc c_2,},}{,\\Or,},',
    R: ',\\Bb{ m \\Pe n}{,\\Bb{i \\Pe j}{,\\Tc c_1,}{,\\Tc c_2,},}{,\\Bb{i \\Pe j}{,}{,},\\Or,},',
  },
  {
    name: 't38 step3 fold to nPe',
    L: ',\\Bb{m \\Pe n}{,\\Bb{i \\Pe j}{,\\Or,}{,},}{,\\Bb{i \\Pe j}{,}{,},},',
    R: ',\\Bb{m \\Pe n}{,i \\nPe j,}{,},',
  },
  {
    name: 't46 step1',
    L: ',i \\Pe j,',
    R: ',i \\Pe j,\\Bb{i \\Oe j}{,}{,\\Or,},',
  },
];

const create = axioms.find((a) => a.id === 'create-branch')!;
const candidates = [
  create,
  ...axioms.filter((a) => a.id.includes('equiv') || a.id.includes('create')),
  ...theorems.filter((t) => t.id.includes('relationship-of-node-value-comparison')).slice(0, 20),
];

for (const c of cases) {
  console.log('\n====', c.name, '====');
  for (const rule of candidates) {
    const r = checkInferenceRules(c.L, c.R, rule.leftSide, rule.rightSide);
    if (r.match) console.log('MATCH', rule.id, r.inferenceRule);
  }
}
