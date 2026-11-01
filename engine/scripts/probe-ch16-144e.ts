import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
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
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}
function chk(a: string, b: string, lab: string) {
  const hits = j(a, b);
  console.log(lab, hits.length ? hits.join(',') : 'FAIL');
  return hits.length > 0;
}

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const bothOr = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';

const ok =
  chk(L, bothOr, '1 ecd') &&
  chk(bothOr, both, '2 reorder true') &&
  chk(both, R, '3 error-release');
console.log(ok ? 'PATH OK' : 'PATH FAIL');

// Also check if we can go L -> bothOr -> R directly (error-code soft?)
chk(bothOr, R, 'bothOr->R direct');

// For s7 of 144: big jump to i nPb t - look at book
const L7 =
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const R7 = ',i \\Pu,i \\nPb t,';
chk(L7, R7, 's7 direct');
// Book: after both-arms scaffolding, jump via subnode expand reverse / thm
const mid7a =
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},},';
chk(L7, mid7a, 's7 nest');
chk(mid7a, R7, 'nest->R7');
