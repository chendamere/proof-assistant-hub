import { checkInferenceRules } from '../src/inferenceRules';
import { theorems } from '../../src/data/theorems';

const id29 = theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-29-msnbifi')!;
console.log(id29.leftSide, '=>', id29.rightSide);
const a = ',i \\Ps j,\\Bb{if(j \\Pu)}{,\\Tc c_1,}{,\\Tc c_2,},';
const b = ',\\Bb{if(j \\Pu)}{,i \\Ps j,\\Tc c_1,}{,i \\Ps j,\\Tc c_2,},';
console.log('with if', checkInferenceRules(a, b, id29.leftSide, id29.rightSide).match);
const a2 = ',i \\Ps j,\\Bb{j \\Pu}{,\\Tc c_1,}{,\\Tc c_2,},';
const b2 = ',\\Bb{j \\Pu}{,i \\Ps j,\\Tc c_1,}{,i \\Ps j,\\Tc c_2,},';
console.log('no if', checkInferenceRules(a2, b2, id29.leftSide, id29.rightSide).match);
const a3 = ',i \\Ps j,\\Bb{if(i \\Pu)}{,\\Tc c_1,}{,\\Tc c_2,},';
const b3 = ',\\Bb{if(i \\Pu)}{,i \\Ps j,\\Tc c_1,}{,i \\Ps j,\\Tc c_2,},';
console.log('Pu on i', checkInferenceRules(a3, b3, id29.leftSide, id29.rightSide).match);
