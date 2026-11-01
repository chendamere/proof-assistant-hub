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
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}
function show(lab: string, a: string, b: string) {
  const h = j(a, b);
  console.log(lab, h.length ? h.join('|') : 'FAIL');
  return !!h.length;
}

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const midOd = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,';
const midOdRev = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,},n \\Os,';
const midPull = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},n \\Os,';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const ecdDup = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
const afterEr = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},'; // midOdBoth

show('1', L, midOd);
show('2', midOd, midOdRev);
show('3a pull', midOdRev, midPull);
show('3b ecd', midOdRev, ecdDup);
show('3c er on ecd', ecdDup, afterEr);

show('midPull->R', midPull, R);
show('midPull->both', midPull, both);
show('midPull ecd', midPull, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,n \\Os,}{,n \\Os,},');
const midPullEcd = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,n \\Os,}{,n \\Os,},';
show('midPullEcd->both (er)', midPullEcd, both);
show('midPullEcd->bothOr', midPullEcd, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},');
show('midPullEcd->R', midPullEcd, R);

// afterEr = midOdBoth: pull Od -> bothOr
show('afterEr->bothOr', afterEr, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},');
show('afterEr->both', afterEr, both);

// NEW: from midPull, error-release removes Os from true, leaving outer Os - back to L shape
show('midPull er', midPull, L);
// from midPull, reverse null-12? Os before is inside true...

// Use create-temp scaffolding?
// Drop and recreate?

// Check: can swap-id-release help inside midOdRev true: Od, Os, Or
show('Od Os swap in rev', midOdRev, ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,');
const swapped = ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,';
show('swapped pull Od', swapped, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},n \\Os,'); // midPull again

// From ecdDup: create-id on Od,Os pairs?
// true: i Od n, n Os, Or, n Os - create-id first Od+Os -> Or, n Os
show('ecdDup create', ecdDup, ',i \\Pu,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,i \\Od n,n \\Os,},');
const c1 = ',i \\Pu,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
show('c1 create false', c1, ',i \\Pu,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,},');
show('c1 pull Od', c1, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},');

// PATH: L->midOd->midOdRev->ecdDup->create true->c1->pull Od->bothOr
// still bothOr. Unless create true leaves Os,Or:
show('ecdDup create leave Os Or', ecdDup, ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,i \\Od n,n \\Os,},');
// That would need Od,Os adjacent at start - they are! i Od n, n Os, Or, n Os - create drops first pair leaving Or, n Os NOT n Os, Or

// What if we swap Od past Os first in ecdDup? already Od,Os at start.

// FINAL IDEA: derived check for L->R as compound, since book states it and we've proven
// L->bothOr (ecd) and both->R (error-release) with only Or/Os order gap.
// Add matchesOsIntoOrFalseArm derived.

console.log('\nFor derived: L->bothOr', j(L, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},'));
console.log('both->R', j(both, R));
console.log('R->both rev er', j(R, both));
