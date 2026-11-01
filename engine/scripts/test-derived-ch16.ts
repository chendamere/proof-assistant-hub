import {
  matchesOsIntoOrFalseArm,
  matchesNestedNullFocus,
  matchesDerivedBbTransition,
} from '../src/inferenceRules/caseFocus';

const L144 = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const R144 = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
console.log('144 osInto', matchesOsIntoOrFalseArm(L144, R144));
console.log('144 derived', matchesDerivedBbTransition(L144, R144));

const L143 =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,\\Bb{i \\Pu}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},},';
const R143 =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},';
console.log('143 nested', matchesNestedNullFocus(L143, R143));
console.log('143 derived', matchesDerivedBbTransition(L143, R143));

// s11: drop Ob t0 sandwich keeping Or — not nested null focus
const L11 =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t \\Ps t_0,\\Or,t_0 \\Os,},';
const R11 = ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,\\Or,},';
console.log('143 s11 nested', matchesNestedNullFocus(L11, R11));
console.log('143 s11 derived', matchesDerivedBbTransition(L11, R11));
