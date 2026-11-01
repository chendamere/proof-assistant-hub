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
const L = ensure(f.left);
const R = ensure(f.right);

const s1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,t_1 \\Os,}{,i \\Od s_1,t_1 \\Os,},i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('1 push Os1 into Bb1', j(L, s1));
const s2 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,i \\Od s_1,t_1 \\Os,},i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('2 create-temp drop Ot+Os true', j(s1, s2));
const s3 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,},i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('3 create-id drop Od+Os false', j(s2, s3));

// Now Ob1, emptyBb1, Ob2, Bb2, Os2 — missing Os1 (absorbed). Need restore later.
const s4 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,}{,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('4 Bb1↔Ob2', j(s3, s4));

// Also try push Os into Bb BEFORE swapping with Ob2 path from original
const t1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},i \\Ob t_2,t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('\nalt swap first', j(L, t1));
const t2 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,t_1 \\Os,}{,i \\Od s_1,t_1 \\Os,},i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('alt push Os from between Ob2', j(t1, t2));

// connectivity-19 pull: empty Bb with Ob in arms
const u1 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
// Can we get Ob2 into empty Bb1 arms then pull?
const v1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,i \\Ob t_2,}{,i \\Ob t_2,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('from s3 push Ob2 into empty Bb1', j(s3, v1));
console.log('pull Ob2 left of Bb', j(v1, u1));

// Direct: from s3 use connectivity-19 reverse? Ob outside empty Bb
console.log('s3→u1 direct Ob past empty Bb', j(s3, u1));
