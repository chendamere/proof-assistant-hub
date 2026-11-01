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
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x: { key: string; step: number; part?: string }) =>
    x.key.includes('::122::') && x.step === 2 && String(x.part || '').includes('1')
)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
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
const b1 = ensure(',i \\Od s_2,s_2 \\Os,' + L.slice(1));
const intoOs = ensure(
  b1.replace(
    ',i \\Od s_2,s_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,}{,i \\Ob t_1,',
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('L->b1', j(L, b1));
console.log('b1->intoOs', j(b1, intoOs));
console.log('intoOs', intoOs.slice(0, 160));

const intoOd = ensure(
  intoOs.replace(
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,',
    ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('intoOs->intoOd', j(intoOs, intoOd));
console.log('intoOd', intoOd.slice(0, 180));
console.log('intoOd->R', j(intoOd, R));

// Reorder Os after Od in true arm to match R
const ord = ensure(
  intoOd.replace(
    '{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}',
    '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
  )
);
console.log('intoOd->ord', j(intoOd, ord));
console.log('ord->R', j(ord, R));

// Still need second sandwich in false arm. From intoOd/ord false has Od s2, Os, Ob t1...
// Add create-subnode + create-temp for s2 in false arm only
const need = R;
console.log('diff ord vs R lengths', ord.length, R.length);
console.log('ord has t2?', ord.includes('t_2'));
console.log('R has t2', R.includes('t_2'));
