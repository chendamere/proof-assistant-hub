import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const CO = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison',
  'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand',
  'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction',
  'Recursive_Function_R',
  'Previous_Order_Induction',
  'Recursive_Function_R_Prev',
  'Rules_of_Node_Ring',
  'Rules_of_Node_Connectivity',
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f43 = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 43)!;
const L = ensure(f43.left);
const R = ensure(f43.right);

// Micro: Pe + Bb{s1 Pu} → Pe + Bb{s2 Pu}
const microL = ensure(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,\\Tc c_3,}{,\\Tc c_2,},');
const microR = ensure(',s_1 \\Pe s_2,\\Bb{s_2 \\Pu}{,\\Tc c_3,}{,\\Tc c_2,},');
console.log('micro Pe subst Pu', j(microL, microR));

// Nested as in fail: Pe outside nested Bb
const nestL = ensure(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},');
const nestR = ensure(',s_1 \\Pe s_2,\\Bb{s_2 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},');
console.log('nest Pe subst', j(nestL, nestR));

// Search Pe+Pu subst rules
const cands = all.filter(
  (r) =>
    r.pos < pos &&
    r.leftSide.includes('\\Pe') &&
    r.leftSide.includes('\\Pu') &&
    r.rightSide.includes('\\Pu')
);
console.log(
  'Pe+Pu rules',
  cands.slice(0, 25).map((r) => r.id + ' :: ' + r.leftSide.slice(0, 70) + ' => ' + r.rightSide.slice(0, 70))
);

// Step 44: drop Pe from both arms
const f44 = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 44)!;
console.log('44 direct', j(f44.left, f44.right));
const peDropL = ensure(',\\Bb{s_1 \\Pu}{,s_1 \\Pe s_2,\\Tc c_1,}{,s_1 \\Pe s_2,\\Tc c_2,},');
const peDropR = ensure(',\\Bb{s_1 \\Pu}{,\\Tc c_1,}{,\\Tc c_2,},');
console.log('Pe drop both arms', j(peDropL, peDropR));
const peOut = ensure(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,\\Tc c_1,}{,\\Tc c_2,},');
console.log('Pe out of both', j(peDropL, peOut));

// Full 43 with mid via Pe subst only on nested
const mid43 = ensure(
  L.replace('\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}', '\\Bb{s_2 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}')
);
console.log('L->mid43 only nested cond', j(L, mid43));
console.log('mid43==R', mid43 === R);
console.log('L->R', j(L, R));
