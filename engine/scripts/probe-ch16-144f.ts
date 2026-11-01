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

const bothOr = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const falseOnlyOrOs = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,},'; // nonsense

console.log('bothOr->both', j(bothOr, both));
console.log('both->R', j(both, R));
console.log('bare Or,Os -> Os,Or', j(',\\Or,n \\Os,', ',n \\Os,\\Or,'));
console.log('Bb arm only', j('\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,}', '\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,}'));

// error-release variants
console.log('Os,Or -> Or', j(',n \\Os,\\Or,', ',\\Or,'));
console.log('Or,Os -> Or', j(',\\Or,n \\Os,', ',\\Or,'));
console.log('error-release id', all.find((r) => r.id === 'error-release')?.leftSide, '=>', all.find((r) => r.id === 'error-release')?.rightSide);

// Can ecd produce both (Os before Or) from L?
const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
console.log('L->both', j(L, both));

// Jump L to both via ecd with different Or position - already failed
// After bothOr, use error-release on Or,Os if there's a rule for that order
const er2 = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Or/.test(r.leftSide) &&
    /\\Os/.test(r.leftSide) &&
    /\\Or/.test(r.rightSide) &&
    !/\\Os/.test(r.rightSide) &&
    r.leftSide.length < 60
);
console.log('Or+Os absorb rules');
for (const r of er2) console.log(r.id, r.leftSide, '=>', r.rightSide);

// Maybe skip false-only: replace book path by going L -> bothOr, and also need bothOr -> book next (false only)
// If we INSERT both as final before book's both line...
// Book after R is both. So if we insert: L -> bothOr -> both, and both fingerprints as book line 933,
// then we need bothOr -> false-only (932) still for the existing line OR we need the existing 932 to match something.

// Better approach: insert intermediates so:
// 931 L -> bothOr (ecd) -> both (reorder) -> and BOTH equals book 933, while 932 becomes a side problem...
// Can't skip 932.

// Unless 932 can be justified from bothOr via a real rule.
console.log('bothOr->R', j(bothOr, R));
console.log('both->bothOr', j(both, bothOr));

// Try: L -> R direct with more candidates involving create
const via = [
  ',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},',
  ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},',
];
for (const v of via) console.log('L->', v.slice(0, 50), j(L, v));
