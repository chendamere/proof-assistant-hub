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

// Verify suspicious matches with more detail
const pairs: [string, string, string][] = [
  [
    'L->s1',
    ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,',
    ',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},',
  ],
  [
    's1->both',
    ',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},',
    ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},',
  ],
  [
    'both->R',
    ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},',
    ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},',
  ],
  [
    'L->Blb then?',
    ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,',
    ',i \\Pu,i \\Od n,\\Blb{n \\Pu}{,\\Or,}{,},n \\Os,',
  ],
];

for (const [lab, a, b] of pairs) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    const r = checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
    if (r.match) hits.push(rule.id);
  }
  console.log(lab, hits);

  // Also check exact empty-branch-null sides
  const ebn = all.find((r) => r.id === 'thm-empty-branch-null')!;
  console.log(
    '  ebn check',
    checkInferenceRules(A, B, ebn.leftSide, ebn.rightSide, { dagCache: index.dagCache })
  );
}

// Find ALL rules that match L->s1
{
  const A = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,');
  const B = ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},');
  console.log('\nAll matching L->s1:');
  for (const rule of all.filter((r) => r.pos < pos)) {
    const r = checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
    if (r.match) console.log(' ', rule.id, '|', rule.leftSide.slice(0, 60), '=>', rule.rightSide.slice(0, 60));
  }
}

// Bb version of null-12?
const osBb = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Os/.test(r.leftSide) &&
    /\\B[bl]b/.test(r.leftSide) &&
    /\\Os/.test(r.rightSide) &&
    r.leftSide.length < 100
);
console.log('\nOs+Bb rules', osBb.length);
for (const r of osBb.slice(0, 20)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}
