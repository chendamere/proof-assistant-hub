/**
 * Isolate why create-temp cancel fails on c3drop; finish 144 to Or then nPb.
 */
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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  const rule = all.find((r) => r.id === 'create-temp')!;
  if (
    checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    }).match
  )
    return 'create-temp';
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
function show(n: string, a: string, b: string) {
  console.log(n, j(a, b) ?? 'NULL');
}

const variants: Array<[string, string, string]> = [
  ['no Ob', ',\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Ot s_2,s_2 \\Os,', ',\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},'],
  ['Ob no Os', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Ot s_2,s_2 \\Os,', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},'],
  ['full c3drop', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'],
  ['Os after pair', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Ot s_2,s_2 \\Os,t_2 \\Os,', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'],
  ['diff names', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_9,s_9 \\Os,', ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'],
];
for (const [n, a, b] of variants) show(n, a, b);

// Workaround: reorder Os after the create-temp pair
const c3drop = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
const reordered = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Ot s_2,s_2 \\Os,t_2 \\Os,');
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');
const mid = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,');
show('c3drop->reordered', c3drop, reordered);
show('reordered->mid cancel', reordered, mid);
show('mid->R add Os only?', mid, R);

// 144: t1d -> Or worked; Or + i Pu -> nPb t via ~ of thm 142 itself? can't use self
// i Pu, Or → i Pu (error absorbs?) then need nPb
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
const tOr = ensure(',i \\Pu,\\Or,');
const tPu = ensure(',i \\Pu,');
const R144 = ensure(',i \\Pu,i \\nPb t,');
show('t1d->Or', t1d, tOr);
show('tOr->tPu', tOr, tPu);
show('tPu->R144', tPu, R144);
show('tOr->R144', tOr, R144);

// null-4: Bb{n Pu}{Or}{} → Or? already have t1d->Or via null-4
// From i Pu, Or: error-code / thm?
for (const id of [
  'error-release',
  'thm-empty-branch-null',
  'rules-of-relationship-of-subnode-13-inbjr',
  'rules-of-relationship-of-subnode-12-ibjr',
  'theorems-of-node-null-comparison-13-iur',
]) {
  const rule = all.find((r) => r.id === id);
  if (!rule) continue;
  console.log(id, rule.leftSide, '↔', rule.rightSide);
  console.log(
    '  on tOr',
    checkInferenceRules(tOr, tPu, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
  );
  console.log(
    '  on tOr->R',
    checkInferenceRules(tOr, R144, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
  );
}

// Expand R144 via subnode-7 then collapse false arm because i Pu takes true (empty) 
const s7 = ensure(',i \\Pu,\\Bb{i \\Pu}{,}{,i \\Ob t,t \\nPc t,t \\Os,},');
show('R144->s7', R144, s7);
const s7true = ensure(',i \\Pu,');
show('s7->s7true take true empty', s7, s7true);
// So R144 ↔ i Pu via expand nPb + take true! Reverse: i Pu → R144
show('tPu->R144 reverse path?', tPu, R144);
show('tPu->s7', tPu, s7);
