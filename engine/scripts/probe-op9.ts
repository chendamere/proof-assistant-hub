import { checkInferenceRules } from '../src/inferenceRules';

const ruleL = ',i \\Op, i \\Os,';
const ruleR = ',i \\Os,';

const L =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const m1 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const m2 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},';
const m3 =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},';
const R =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,},';

console.log('L→m1 one arm i1', checkInferenceRules(L, m1, ruleR, ruleL).match);
console.log('m1→m2 other arm i1', checkInferenceRules(m1, m2, ruleR, ruleL).match);
console.log('m2→m3 one arm j1', checkInferenceRules(m2, m3, ruleR, ruleL).match);
console.log('m3→R other arm j1', checkInferenceRules(m3, R, ruleR, ruleL).match);

// both arms at once for i1 Op?
const both =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},';
console.log('L→both i1 both arms', checkInferenceRules(L, both, ruleR, ruleL).match);

// via identical-17 reverse then forward? 
const out =
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,i_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const id17L = ',m \\Op, \\Blb{if(i \\Ps j)}{,}{,},';
const id17R = ',\\Blb{if(i \\Ps j)}{, m \\Op,}{, m \\Op,},';
console.log('out→both id17', checkInferenceRules(out, both, id17L, id17R).match);
console.log('L→out rev op9 outside?', checkInferenceRules(L, out, ruleR, ruleL).match);
