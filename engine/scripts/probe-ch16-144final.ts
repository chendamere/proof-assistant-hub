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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
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

const peOnly = ensure(',\\Ot n,i \\Pe n,');
const peTemp = ensure(',\\Ot n,i \\Pe n,\\Ot n,n \\Os,');
const arranged = ensure(',\\Ot n,i \\Pe n,n \\Os,\\Ot n,');
const after3 = ensure(',\\Ot n,i \\Pe n,n \\Os,');
const withPu = ensure(',i \\Pu,\\Ot n,');
const tPu = ensure(',i \\Pu,');
const R = ensure(',i \\Pu,i \\nPb t,');

console.log('peOnly->peTemp', j(peOnly, peTemp));
console.log('peTemp->arranged', j(peTemp, arranged));
console.log('arranged->after3+Ot via null-0?', j(arranged, withPu));
console.log('arranged->tPu+Ot', j(arranged, ensure(',i \\Pu,\\Ot n,')));
console.log('after3->tPu', j(after3, tPu));

// arranged = after3 + Ot n. null-0 on prefix:
console.log('arranged->iPu,Ot', j(arranged, ensure(',i \\Pu,\\Ot n,')));
const iPuOt = ensure(',i \\Pu,\\Ot n,');
console.log('iPuOt->tPu', j(iPuOt, tPu));
console.log('iPuOt->R', j(iPuOt, R));

// Drop Ot n next to i Pu: operators-3 reverse? Ot n, n Pu <- Ot n; or null-0
const iPuOtPu = ensure(',i \\Pu,\\Ot n,n \\Pu,');
console.log('iPuOt->iPuOtPu', j(iPuOt, iPuOtPu));
console.log('iPuOtPu->?', j(iPuOtPu, tPu));

// swap Ot before i Pu then null-0 style
const OtPu = ensure(',\\Ot n,i \\Pu,');
console.log('iPuOt->OtPu', j(iPuOt, OtPu));
console.log('OtPu->op3', j(OtPu, ensure(',\\Ot n,n \\Pu,i \\Pu,')));

// Full chain from a4
const a4 = ensure(',i \\Pu,i \\Od n,');
const n0 = ensure(',\\Ot n,i \\Pe n,n \\Os,i \\Od n,');
const n0b = ensure(',\\Ot n,i \\Pe n,i \\Od n,n \\Os,');
const chain = [a4, n0, n0b, peOnly, peTemp, arranged, iPuOt];
for (let i = 0; i < chain.length - 1; i++) {
  console.log(`c${i}`, j(chain[i]!, chain[i + 1]!), '->', chain[i + 1]!.slice(0, 50));
}

// Can arranged go directly to tPu?
console.log('arranged->tPu', j(arranged, tPu));
console.log('arranged->R', j(arranged, R));
console.log('peTemp->arranged alts');
const alt1 = ensure(',\\Ot n,\\Ot n,i \\Pe n,n \\Os,');
console.log('peTemp->alt1', j(peTemp, alt1));
console.log('alt1->after3', j(alt1, after3));
console.log('alt1->tPu', j(alt1, tPu));
