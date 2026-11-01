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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 20)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string) {
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
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

// Split merged Bb into two Bbs (same cond t1 Pc j)
const split = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_1 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}'
);
console.log('L->split', j(L, split));

// Change second cond to t2 Pc j
const cond2 = split.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}'
);
console.log('split->cond2', j(split, cond2));

// Zip: Ob Ob Bb Bb Os Os Pe → Ob Bb Os Ob Bb Os Pe
const zipped = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,'
);
console.log('cond2->zipped', j(cond2, zipped));
console.log('zipped==R', zipped === R, j(zipped, R));

// Pe position: L has Pe before Os; R has Pe after
const peAfter = L.replace(
  ',s_1 \\Pe s_2,t_1 \\Os,t_2 \\Os,',
  ',t_1 \\Os,t_2 \\Os,s_1 \\Pe s_2,'
);
console.log('L->peAfter', j(L, peAfter));
