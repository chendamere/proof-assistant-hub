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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 0)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
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

// Assume we have empty Bb1 state a4 from prior probe
const a4 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
const b1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,},i \\Ob t_2,t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('a4→b1', j(a4, b1));

const c1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,i \\Ob t_2,}{,i \\Ob t_2,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('b1 push Ob2 into empty Bb', j(b1, c1));
const c2 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('c1 pull Ob2 left', j(c1, c2));

// How to get to a4 from L?
const L = ensure(f.left);
// Try reverse create-temp at TOP level then push s1 Os into Bb
const t0 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,s_1 \\Os,'
);
console.log('\nL add Ot s1 Os top', j(L, t0));
// Maybe only insert s1 Os next to existing Ot via a different rule
const t1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
// Use create-temp matching only the Ot fragment - try from expression that is JUST Ot?
console.log('L→t1 direct', j(L, t1));

// Check: does create-temp match when Ot already present without Os?
// Rule: , ↔ Ot m, m Os. Reverse: Ot m, m Os ↔ ,
// Forward insert into empty site: need empty context in arm. Arm has Ot s1 already - can't insert Ot s1, s1 Os when Ot s1 exists.
// So insert only s1 Os: is there a rule Ot m ↔ Ot m, m Os?
console.log(
  'rules Ot→Ot Os',
  all
    .filter((r) => /\\Ot/.test(r.leftSide) && /\\Ot/.test(r.rightSide) && /\\Os/.test(r.rightSide + r.leftSide))
    .slice(0, 10)
    .map((r) => r.id + ' | ' + r.leftSide + ' ⟺ ' + r.rightSide)
);

// operators-3 was Ot i ↔ Ot i, i Pu. Is there Ot i ↔ Ot i, i Os?
const r = all.find((x) => /\\Ot i/.test(x.leftSide) && /\\Os/.test(x.rightSide));
console.log('Ot i Os rule', r?.id, r?.leftSide, r?.rightSide);
