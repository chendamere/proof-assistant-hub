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

const a4 = ensure(',i \\Pu,i \\Od n,');
const tPu = ensure(',i \\Pu,');
const R = ensure(',i \\Pu,i \\nPb t,');
const n0 = ensure(',\\Ot n,i \\Pe n,n \\Os,i \\Od n,');
const n0b = ensure(',\\Ot n,i \\Pe n,i \\Od n,n \\Os,');
const n0c = ensure(',i \\Pu,\\Ot n,i \\Pe n,n \\Os,i \\Od n,'); // keep Pu?
console.log('a4->n0 null-0 same n', j(a4, n0));
console.log('a4->n0b', j(a4, n0b));
const n0fresh = ensure(',\\Ot m,i \\Pe m,m \\Os,i \\Od n,');
console.log('a4->n0fresh', j(a4, n0fresh));
console.log('n0->create-id', j(n0, ensure(',\\Ot n,i \\Pe n,')));
console.log('n0b->create-id', j(n0b, ensure(',\\Ot n,i \\Pe n,')));

// From a4b: i Pu, i Od n, Ot n, n Os — create-id first
const a4b = ensure(',i \\Pu,i \\Od n,\\Ot n,n \\Os,');
const afterId = ensure(',i \\Pu,\\Ot n,');
console.log('a4b->afterId', j(a4b, afterId));
console.log('afterId->tPu', j(afterId, tPu));
// afterId: add Pe and Os via null-0 reverse pieces?
const after2 = ensure(',i \\Pu,\\Ot n,i \\Pe n,n \\Os,');
console.log('afterId->after2', j(afterId, after2));
console.log('after2->tPu null-0', j(after2, tPu));
// drop i Pu first from after2? 
const after3 = ensure(',\\Ot n,i \\Pe n,n \\Os,');
console.log('after2->after3', j(after2, after3));
console.log('after3->tPu', j(after3, tPu));

// Complete chain from a4:
console.log('\n=== a4 chain ===');
const c = [a4, a4b, afterId, after2, after3, tPu, R];
for (let i = 0; i < c.length - 1; i++) console.log(i, j(c[i]!, c[i + 1]!), c[i + 1]!.slice(0, 60));
