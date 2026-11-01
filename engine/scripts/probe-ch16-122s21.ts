import fs from 'fs';
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
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 21)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string) {
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const id of ['create-temp', 'create-subnode', 'temp-value-equal', 'id-value-equal']) {
    const rule = all.find((r) => r.id === id)!;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return id;
  }
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (BLOCK.has(rule.id)) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);
console.log('direct', j(L, R));

// Drop first sandwich via create-temp then create-subnode reverse?
// L: Ob t1, Bb{t1}{Ot s1}{Od s1}, Os t1, Ob t2, Bb{t2}{Ot s2}{Od s2}, Os t2, Pe
// R: Ob t2, Bb{t2}{Ot s2}{Od s2}, Os t2, Os s2

// Collapse first Bb via create-temp drop Ot+Os then create-id drop Od?
const dropOt = L.replace('{,\\Ot s_1,}{,i \\Od s_1,}', '{,}{,i \\Od s_1,s_1 \\Os,}');
console.log('scaffold Os in false', j(L, dropOt));

// Empty Bb then drop
const emptyBb = L.replace(
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  ''
);
console.log('L->drop first sandwich', j(L, emptyBb));
const withS2Os = emptyBb.replace(',s_1 \\Pe s_2,', ',s_2 \\Os,s_1 \\Pe s_2,');
console.log('empty->withS2Os', j(emptyBb, withS2Os));
console.log('withS2Os', withS2Os);
console.log('R       ', R);

// Pe drop via temp-value reverse then create-temp?
const dropPe = emptyBb.replace(',s_1 \\Pe s_2,', ',');
console.log('empty->dropPe', j(emptyBb, dropPe));
const addS2Os = dropPe.replace(/,$/, ',s_2 \\Os,');
console.log('dropPe->addS2Os', j(dropPe, addS2Os));
console.log('addS2Os==R', ensure(addS2Os) === R);
