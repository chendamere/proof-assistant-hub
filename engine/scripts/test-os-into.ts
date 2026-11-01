import { matchesOsIntoOrFalseArm, matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
console.log('osInto', matchesOsIntoOrFalseArm(L, R));
console.log('derived', matchesDerivedBbTransition(L, R));
console.log('rev', matchesOsIntoOrFalseArm(R, L));
