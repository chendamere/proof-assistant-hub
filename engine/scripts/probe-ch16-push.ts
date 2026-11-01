import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';

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
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f6 = fails.find((x: { key: string; step: number }) => x.key.includes('::6::') && x.step === 13)!;
const pos6 = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 6;
const index6 = buildRuleIndex(
  all.filter((r) => r.pos < pos6),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index6, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index6.dagCache }).match)
      return rule.id;
  }
  return null;
}
const L = ensure(f6.left);
const R = ensure(f6.right);
const s1 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},n \\Pu,t \\Os,n \\Os,'
);
const s2 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},n \\Pu,n \\Os,t \\Os,'
);
console.log('1 bubble Pu', j(L, s1));
console.log('2 bubble Os past tOs', j(s1, s2));
const s3 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,n \\Pu,n \\Os,\\Ot n,}{,n \\Pu,n \\Os,i \\Od n,},t \\Os,'
);
console.log('3 push Pu+Os', j(s2, s3));
const s3b = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,n \\Os,}{,i \\Od n,n \\Pu,n \\Os,},t \\Os,'
);
console.log('3b push to end of arms', j(s2, s3b), '==R', s3b === R);
console.log('2→R', j(s2, R));

// try connectivity-20 / null-12 style for Os only after Pu pushed somehow
const t1 = ensure(
  ',i \\nPu,i \\Ob t,n \\Pu,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},t \\Os,n \\Os,'
);
console.log('alt bubble Pu before Bb', j(L, t1));
const t2 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,n \\Pu,\\Ot n,}{,n \\Pu,i \\Od n,},t \\Os,n \\Os,'
);
console.log('alt push Pu from before Bb', j(t1, t2));

// List rules that mention Pu and Bb
console.log(
  'pu-bb rules',
  all
    .filter((r) => r.pos < pos6 && /Pu/.test(r.leftSide + r.rightSide) && /\\B/.test(r.leftSide + r.rightSide))
    .slice(0, 15)
    .map((r) => r.id)
);
