/**
 * 144: error-release in true arm; find path to bare i Pu then cite earlier ~ nPb.
 */
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
function j(a: string, b: string): string | null {
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

const L = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R = ensure(',i \\Pu,i \\nPb t,');
const t1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
const a1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},');
const a2 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},');
const a3 = ensure(',i \\Pu,i \\Od n,n \\nPu,');
const a4 = ensure(',i \\Pu,i \\Od n,');
const tPu = ensure(',i \\Pu,');

console.log('L->t1', j(L, t1));
console.log('t1->a1 error-release true', j(t1, a1));
console.log('a1->a2 drop false Os', j(a1, a2));
console.log('a2->a3 def-null-neg', j(a2, a3));
console.log('a3->a4 drop nPu', j(a3, a4));
console.log('a4->tPu drop Od', j(a4, tPu));
console.log('tPu->R', j(tPu, R));

// a1: false has n Os, true has Or — null-3?
console.log('a1->a3alt', j(a1, a3));
// pull n Os from false next to Od then create-id, leave Bb{n Pu}{Or}{}
const b1 = ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},');
console.log('a1->b1', j(a1, b1));
console.log('b1->t1d', j(b1, ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},')));

// From a2 = i Pu, i Od n, Bb{n Pu}{Or}{}
console.log('a2->t1d', j(a2, ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},')));
// drop i Od n somehow - create-id needs n Os
const b2 = ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},');
console.log('a2->b2 add Os?', j(a2, b2));

// Full proposed chain if t1->a1 works
const chain = [L, t1, a1, b1, ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},'), ensure(',i \\Pu,n \\nPu,'), tPu, R];
console.log('\nFull chain attempt:');
for (let i = 0; i < chain.length - 1; i++) {
  console.log(`  [${i}]->[${i + 1}]`, j(chain[i]!, chain[i + 1]!), '::', chain[i + 1]!.slice(0, 70));
}

// How does book get n nPu drop? Maybe don't need bare tPu - check t1d->R with ~ 
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
const tNn = ensure(',i \\Pu,n \\nPu,');
console.log('tNn->R', j(tNn, R));
// n nPu with i Pu - swap and drop?
console.log('tNn->tPu search');
for (const rule of getRulesForTransition(index, tNn, tPu).slice(0, 20)) {
  if (
    checkInferenceRules(tNn, tPu, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
  ) {
    console.log(' ', rule.id);
  }
}
