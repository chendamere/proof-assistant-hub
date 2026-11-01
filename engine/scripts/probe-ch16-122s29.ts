import fs from 'fs';
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
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 29)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

console.log('L', f.left);
console.log('R', f.right);
console.log('direct', j(f.left, f.right));

const L = f.left as string;
const R = f.right as string;

// Similar: drop Pn via Ot, add Pe via temp or id
// L has s1 Pn s1 in t1 Bb true, s2 Pn s2 in t2 Bb true
// R drops those Pn and adds s1 Pe s2 in both Pu true and false arms

const dropS1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
console.log('L->dropS1', j(L, dropS1));
const dropS2 = dropS1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
console.log('dropS1->dropS2', j(dropS1, dropS2));

// Add Pe in true arm of outer Bb (Pu true): after Od s1 Od s2
const peTrue = dropS2.replace(
  '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('dropS2->peTrue', j(dropS2, peTrue));
console.log('peTrue->R', j(peTrue, R));

// Maybe id-value-equal needs Od adjacent without Os between
const peTrue2 = dropS2.replace(
  '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,s_1 \\Pe s_2,}'
);
console.log('dropS2->peTrue2', j(dropS2, peTrue2));

// Add Pe via id first then move
const peMid = dropS2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
console.log('dropS2->peMid (both arms?)', j(dropS2, peMid));
console.log('peMid', peMid);
console.log('peMid->R', j(peMid, R));
