/**
 * s21 endgame: from c3 drop first sandwich; from c3drop absorb extra Ot keep s2 Os.
 * Also continue 144: take-true is derived.
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
  const r = j(a, b);
  console.log(n, r ?? 'NULL');
  return r;
}

const c3 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,'
);
const c3drop = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');

console.log('=== retest c3drop -> R ===');
show('c3drop->R', c3drop, R);
show('c3drop->R strip Ot only', c3drop, ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'));

// Absorb endgame from c3drop
const e1 = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,\\Ot s_2,'
);
show('c3drop->e1 push s2 Os into arms', c3drop, e1);

const e1b = c3drop.replace(',t_2 \\Os,\\Ot s_2,s_2 \\Os,', ',s_2 \\Os,t_2 \\Os,\\Ot s_2,');
show('c3drop->e1b Os before t2 Os', c3drop, e1b);
const e1c = ensure(e1b).replace(',s_2 \\Os,t_2 \\Os,\\Ot s_2,', ',t_2 \\Os,\\Ot s_2,').replace(
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}'
);
show('e1b->e1c into arms', e1b, e1c);

// swap Ot s2 before Bb then? 
const e2 = c3drop.replace(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,',
  ',i \\Ob t_2,\\Ot s_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
show('c3drop->e2 Ot before Bb', c3drop, e2);

const e3 = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
show('c3drop->e3 Ot into true only', c3drop, e3);

// Collapse first sandwich from c3 by adding s1 Os again
console.log('\n=== collapse first sandwich ===');
const c3a = ensure(c3.replace(/,$/, ',\\Ot s_1,s_1 \\Os,'));
show('c3->c3a create-temp s1', c3, c3a);

// Push s1 Os into first Bb: put Os next to Bb
const c3b = c3a.replace(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  ',i \\Ob t_1,s_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,'
).replace(/,\\Ot s_1,s_1 \\Os,$/, ',\\Ot s_1,');
show('c3a->c3b Os after Ob', c3a, ensure(c3b));

const c3c = ensure(c3b).replace(
  ',s_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
  ',\\Bb{t_1 \\Pc j}{,s_1 \\Os,\\Ot s_1,}{,s_1 \\Os,i \\Od s_1,},'
);
show('c3b->c3c Os into arms', ensure(c3b), c3c);

const c3d = c3c.replace(
  '\\Bb{t_1 \\Pc j}{,s_1 \\Os,\\Ot s_1,}{,s_1 \\Os,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,}'
);
show('c3c->c3d reorder arms', c3c, ensure(c3d));

const c3e = ensure(c3d).replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,}',
  '\\Bb{t_1 \\Pc j}{,}{,i \\Od s_1,s_1 \\Os,}'
);
show('c3d->c3e create-temp empty true', ensure(c3d), c3e);

const c3f = c3e.replace(
  '\\Bb{t_1 \\Pc j}{,}{,i \\Od s_1,s_1 \\Os,}',
  '\\Bb{t_1 \\Pc j}{,}{,}'
);
show('c3e->c3f create-id empty false', c3e, ensure(c3f));

const c3g = ensure(c3f).replace(',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,', ',i \\Ob t_1,t_1 \\Os,');
show('c3f->c3g drop empty Bb', ensure(c3f), c3g);

const c3h = ensure(c3g).replace(',i \\Ob t_1,t_1 \\Os,', '');
show('c3g->c3h create-subnode drop', c3g, c3h);
console.log('c3h', c3h);
console.log('c3h==c3drop?', c3h === c3drop);
show('c3h->R', c3h, R);

// 144 continue from take-true
console.log('\n=== 144 from take-true ===');
const pos144 = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
const index144 = buildRuleIndex(
  all.filter((r) => r.pos < pos144),
  new Map()
);
function j144(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index144, ensure(a), ensure(b))) {
    if (BLOCK.has(rule.id)) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index144.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}
const L144 = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R144 = ensure(',i \\Pu,i \\nPb t,');
const t1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
console.log('L->t1', j144(L144, t1));
// collapse nPu with Or in true → n Os, Or via focus? or error
const t2 = ensure(',i \\Pu,i \\Od n,n \\Os,\\Or,');
console.log('t1->t2', j144(t1, t2));
const t2b = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},');
console.log('t1->t2b pull Os equal?', j144(t1, t2b));
const t3 = ensure(',i \\Pu,i \\Od n,n \\nPu,n \\Os,');
console.log('t1->t3', j144(t1, t3));
// create-id reverse cancel i Od n, n Os
const t4 = ensure(',i \\Pu,\\Or,');
console.log('t2->t4', j144(t2, t4));
const t5 = ensure(',i \\Pu,i \\nPb t,');
console.log('t4->R via thm?', j144(t4, R144));
console.log('t1->R', j144(t1, R144));

// subnode-7: i nPb j ↔ Bb{i Pu}{}{i Ob t, t nPc j, t Os}
// with i Pu known, true arm empty of Bb{i Pu} means take true → empty, so nPb from false? 
const s7 = ensure(',i \\Pu,\\Bb{i \\Pu}{,}{,i \\Ob t,t \\nPc t,t \\Os,},');
console.log('R->s7 expand nPb', j144(R144, s7));
const s7b = ensure(',i \\Pu,\\Bb{i \\Pu}{,}{,},');
console.log('s7->s7b?', j144(s7, s7b));

// From t1: i Pu, i Od n, Bb{n Pu}{n Os Or}{n Os}
// null-0: i Pu ↔ Ot m, i Pe m, m Os — different
// Maybe: use create-id reverse after getting n Os next to i Od n
const t1c = ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},');
console.log('t1->t1c pull Os', j144(t1, t1c));
console.log('t1c->cancel id', j144(t1c, ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},')));
