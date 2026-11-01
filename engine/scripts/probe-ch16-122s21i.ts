/**
 * Diagnose create-temp cancel with Ot also inside Bb; finish collapse without orphan Ot.
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
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
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
function show(n: string, a: string, b: string) {
  console.log(n, j(a, b) ?? 'NULL');
}

const rule = all.find((r) => r.id === 'create-temp')!;
console.log('create-temp', rule.leftSide, '↔', rule.rightSide);

const simple = ensure(',\\Ot s_2,s_2 \\Os,');
show('simple cancel', simple, ',');
show('simple add', ',', simple);

const withBb = ensure(',\\Bb{t \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Ot s_2,s_2 \\Os,');
const withBbR = ensure(',\\Bb{t \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},');
show('withBb cancel top', withBb, withBbR);

const c3drop = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');
show('c3drop->R', c3drop, R);

// Direct checkInferenceRules
const r1 = checkInferenceRules(c3drop, R, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
console.log('direct check match', r1.match, r1.matchPosition);

const outs = oneStepRewrites(c3drop, rule.leftSide, rule.rightSide);
console.log('oneStep from c3drop count', outs.length);
for (const o of outs.slice(0, 10)) console.log(' ', ensure(o).slice(0, 140));

// Try cancel when Ot s2 only at top (empty true arm first)
const emptyTrue = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
const emptyTrueR = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,');
show('emptyTrue cancel', emptyTrue, emptyTrueR);

// Reorder Ot s2, s2 Os to be adjacent away from Bb's Ot - already are at end
// Maybe need Ot s2, s2 Os without Bb containing Ot s2 - rename?
const renamed = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_x,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
const renamedR = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_x,}{,i \\Od s_2,},t_2 \\Os,');
show('renamed cancel', renamed, renamedR);

// 144: after t1c cancel id
const L144 = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const t1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
const t1c = ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},');
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
const R144 = ensure(',i \\Pu,i \\nPb t,');
console.log('\n144 chain');
show('L->t1', L144, t1);
show('t1->t1c', t1, t1c);
show('t1c->t1d', t1c, t1d);
// Bb{n Pu}{Or}{} → n nPu or nPb?
show('t1d->nPu?', t1d, ensure(',i \\Pu,n \\nPu,'));
show('t1d->Or', t1d, ensure(',i \\Pu,\\Or,'));
show('t1d->R', t1d, R144);
// null-comp: Bb{n Pu}{Or}{} ↔ n nPu?
for (const r of all) {
  if (r.pos >= pos) continue;
  if (
    /\\Bb\{[^}]*\\Pu/.test(r.leftSide + r.rightSide) &&
    /\\Or/.test(r.leftSide + r.rightSide) &&
    r.leftSide.length < 70
  ) {
    console.log(r.id, r.leftSide, '↔', r.rightSide);
  }
}
