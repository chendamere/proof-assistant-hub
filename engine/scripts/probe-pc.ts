import { checkInferenceRules } from "../src/inferenceRules";
const L = ",i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc i_1,i_1 \\Os,";
const R = ",i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc j,i_1 \\Os,";
const r110L = ",i \\Ps j, j \\Pc m,";
const r110R = ",i \\Ps j, i \\Pc m,";
console.log("110 fwd", checkInferenceRules(L,R,r110L,r110R).match);
console.log("110 rev", checkInferenceRules(L,R,r110R,r110L).match);
// After flipping Pc: i1 Pc i with i1 Ps j → apply 110 → i1 Pc? 
const mid = ",i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i_1 \\Pc i,i_1 \\Os,";
console.log("flip Pc?", checkInferenceRules(L, mid, ",i \\Pc j,", ",j \\Pc i,").match);
console.log("sym?", checkInferenceRules(L, mid, ",i \\Pc j,", ",j \\Pc i,").match);
