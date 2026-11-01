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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 150;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function chk(a: string, b: string) {
  const r = j(a, b);
  console.log((r ? 'OK ' + r : 'FAIL').padEnd(55), a.slice(0, 55), '=>', b.slice(0, 55));
  return r;
}

const p0 = ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const p1 = ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const p2 = ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const p3 = ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const p4 = ',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';

chk(p0, p1);
chk(p1, p2);
chk(p2, p3);
chk(p3, p4);

// alt: drop Pc while Ps not adjacent - already failed
// alt path: bubble Pc left to Ps
const p1b = ',i \\Oc i_0,i \\Ps i_0,i \\Pc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const p1c = ',i \\Oc i_0,i \\Ps i_0,i_1 \\Pb i,i \\Oc i_1,i_1 \\Os,i_0 \\Os,'; // nonsense
chk(p1, p1b);
chk(p1b, ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,');
chk(',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,', p4);
