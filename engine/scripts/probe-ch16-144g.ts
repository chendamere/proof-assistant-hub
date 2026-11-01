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

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const midOd = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,';
const midOdBoth = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
const midOdBoth2 = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},';
const midPull = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},'; // = bothOr
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';

console.log('L->midOd', j(L, midOd));
console.log('midOd->midOdBoth', j(midOd, midOdBoth));
console.log('midOdBoth->midOdBoth2', j(midOdBoth, midOdBoth2));
console.log('midOdBoth2 create-id true?', j(midOdBoth2, ',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,i \\Od n,n \\Os,},'));
console.log('after create true->', j(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,i \\Od n,n \\Os,},', ',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},')); // create false
console.log('midOdBoth2->Rish', j(midOdBoth2, R));
console.log('midOdBoth2->both', j(midOdBoth2, both));

// After create-id in both arms: Od+Os cancel
const afterCreate = ',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},';
console.log('midOdBoth2->afterCreate', j(midOdBoth2, afterCreate));

// Pull Od out of arms (rev null-10) from midOdBoth leaving Os in arms
const pulled = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},';
console.log('midOdBoth->pulled', j(midOdBoth, pulled));
console.log('midOdBoth2->both ext', j(midOdBoth2, both));

// reverse null-10
const n10 = all.find((r) => r.id.includes('null-comparison-10'))!;
console.log('n10', n10?.id, n10?.leftSide, '=>', n10?.rightSide);

// Key: from midOdBoth2, create-id drops Od+Os in true leaving Or, and in false leaving empty - bad
// From midOdBoth2: create-id only in true: Bb{Or,}{i Od n, n Os} then create-id false to Bb{Or,}{} - loses Os
// From midOdBoth2: create-id only in false first?
console.log(
  'create false first',
  j(midOdBoth2, ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,},')
);

// What if true is i Od n, n Os, Or - create-id leaves Or; false i Od n, n Os - create leaves empty
// = Bb{Or,}{} = afterCreate. Then need to get to R by adding Os to false - reverse of something with outer Od Os
console.log('afterCreate + Od Os', j(afterCreate, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,'));
console.log('afterCreate -> R', j(afterCreate, R));

// Try R via: L -> midOd -> midOdBoth (ecd) -> pull Od out -> bothOr. Still stuck on bothOr->R
console.log('full to bothOr', j(L, midOd), j(midOd, midOdBoth), j(midOdBoth, pulled));

// Is there null-comparison that pushes Os from AFTER?
const afterOs = all.filter(
  (r) =>
    r.pos < pos &&
    /\\B[bl]b/.test(r.leftSide) &&
    /\\Os/.test(r.leftSide) &&
    r.leftSide.length < 90 &&
    (r.leftSide.lastIndexOf('\\Os') > r.leftSide.indexOf('\\B') ||
      r.rightSide.indexOf('\\Os') > 0)
);
console.log('\nrules with Bb and Os', afterOs.length);
for (const r of afterOs.slice(0, 25)) {
  console.log(r.id);
  console.log(' L', r.leftSide);
  console.log(' R', r.rightSide);
}
