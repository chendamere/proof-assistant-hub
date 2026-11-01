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
function step(a: string, b: string, label: string) {
  const r = j(a, b);
  console.log(label, r ? 'OK ' + r : 'FAIL');
  return !!r;
}

const path = [
  ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  // insert Ps next to Pc
  ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  // drop Pc via 193
  ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  // drop Ps
  ',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
];

// First try insert Ps - may need different position
const inserts = [
  ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Ps i_0,i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
];
const L = path[0]!;
const R = path[3]!;
for (const mid of inserts) {
  console.log('\n--- try insert', mid.slice(0, 60));
  if (!step(L, mid, 'L->mid')) continue;
  // drop Pc
  const afterDropPc = mid
    .replace(',i \\Pc i_0,', ',')
    .replace('i \\Pc i_0,', '');
  // normalize
  const variants = [
    mid.replace(/,i \\Pc i_0,/, ','),
    mid.replace(/i \\Pc i_0,/, ''),
  ].map((s) => ensure(s));
  // explicit
  const drops = [
    ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
    ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
    ',i \\Ps i_0,i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
    ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ];
  for (const d of drops) {
    if (!step(mid, d, 'mid->dropPc ' + d.slice(0, 50))) continue;
    if (step(d, R, 'dropPc->R')) {
      console.log('FULL PATH:');
      console.log('1', L);
      console.log('2', mid);
      console.log('3', d);
      console.log('4', R);
    }
  }
}

// Also check 193 semantics
const r193 = all.find((x) => x.id === 'rules-of-node-connectivity-193-isjicj')!;
console.log('\n193', r193.leftSide, '=>', r193.rightSide);
console.log('193 fwd Ps->Pc only', j(',i \\Ps j,', ',i \\Pc j,'));
console.log('193 rev Pc->Ps', j(',i \\Pc j,', ',i \\Ps j,'));
console.log('193 Ps+Pc -> Ps', j(',i \\Ps j,i \\Pc j,', ',i \\Ps j,'));
console.log('193 Ps+Pc -> Pc', j(',i \\Ps j,i \\Pc j,', ',i \\Pc j,'));
console.log('193 Ps -> Ps+Pc', j(',i \\Ps j,', ',i \\Ps j,i \\Pc j,'));
console.log('193 Pc -> Ps+Pc', j(',i \\Pc j,', ',i \\Ps j,i \\Pc j,'));
