import { checkInferenceRules } from '../src/inferenceRules';

const L =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,i_1 \\Op,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const R =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,},';
const ruleL = ',i \\Op , j \\Op, \\Blb{if(i \\Ps j)}{,}{,},';
const ruleR = ',\\Blb{if(i \\Ps j)}{,i \\Op , j \\Op,}{,i \\Op , j \\Op,},';
console.log('match R book order', checkInferenceRules(L, R, ruleL, ruleR));
const R2 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,j_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,j_1 \\Op,i_1 \\Os,j_1 \\Os,},';
console.log('match Op Op then Os', checkInferenceRules(L, R2, ruleL, ruleR));

const rule15L = ',m \\Op, \\Blb{if(i \\Ps j)}{,}{,},';
const rule15R = ',\\Blb{if(i \\Ps j)}{, m \\Op,}{, m \\Op,},';
const L1 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,i_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const R1 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},';
console.log('single Op push', checkInferenceRules(L1, R1, rule15L, rule15R));

// create-copy reverse: drop i Oc i1, i1 Os from both arms
const L20 =
  ',j \\Oc j_1,j_1 \\Op,\\Blb{i \\Ps j_1}{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,}{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,},';
const mid =
  ',j \\Oc j_1,j_1 \\Op,i \\Oc i_1,i_1 \\Os,\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,},';
const R20 = ',j \\Oc j_1,j_1 \\Op,\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,},';
const id15L = ',m \\Os, \\Blb{if(i \\Ps j)}{,}{,},';
const id15R = ',\\Blb{if(i \\Ps j)}{, m \\Os,}{, m \\Os,},';
// reverse identical-15 pull j1 Os? arms have more than Os
console.log('pull Oc/Os via reverse create-copy outer');
console.log(
  'L20→mid reverse create?',
  checkInferenceRules(L20, mid, ',i \\Oc m, m \\Os,', ',')
);
console.log(
  'mid→R20 reverse create?',
  checkInferenceRules(mid, R20, ',i \\Oc m, m \\Os,', ',')
);
// pull using reverse identical with Oc? 
// Try: reverse of create-copy as rule L=rightSide R=leftSide of axiom
console.log(
  'L20→R20 reverse create-copy axiom sides',
  checkInferenceRules(L20, R20, ',i \\Oc m, m \\Os,', ',')
);
// Factor: identical-12 mc n lb - pull Oc?
const id12L = ',m \\Oc n, \\Blb{if(i \\Ps j)}{,}{,},';
const id12R = ',\\Blb{if(i \\Ps j)}{, m \\Oc n,}{, m \\Oc n,},';
const midA =
  ',j \\Oc j_1,j_1 \\Op,i \\Oc i_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
console.log('L20→midA reverse id12', checkInferenceRules(L20, midA, id12R, id12L));
const midB =
  ',j \\Oc j_1,j_1 \\Op,i \\Oc i_1,i_1 \\Os,\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,},';
console.log('midA→midB reverse id15', checkInferenceRules(midA, midB, id15R, id15L));
console.log('midB→R20 reverse create', checkInferenceRules(midB, R20, ',i \\Oc m, m \\Os,', ','));
