/**
 * Complete 144: avoid Or-drop gap.
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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
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

const L = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R = ensure(',i \\Pu,i \\nPb t,');
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
const tPu = ensure(',i \\Pu,');
const tNn = ensure(',i \\Pu,n \\nPu,');
const tOr = ensure(',i \\Pu,\\Or,');

console.log('t1d->tNn', j(t1d, tNn));
console.log('tNn->tPu', j(tNn, tPu));
console.log('tNn->R', j(tNn, R));
console.log('t1d->R', j(t1d, R));

// Which rule is 142?
const r142 = all.find((r) => r.id.includes('142-iuinbt'))!;
console.log('rule142 pos', r142.pos, 'thm pos', pos, 'allowed', r142.pos < pos);
console.log('rule142', r142.leftSide, r142.rightSide);

// Direct L->R?
console.log('L->R', j(L, R));
console.log('L->tPu', j(L, tPu));
console.log('L->R via tPu steps');

// From t1: maybe fold differently toward nPb without Or
const t1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
// Use null-3: Bb{n Pu}{Or}{Tc} 
const t1x = ensure(',i \\Pu,i \\Od n,n \\nPu,n \\Os,');
console.log('t1->t1x', j(t1, t1x));
console.log('t1x->tPu create-id', j(t1x, tPu));

// error absorbs: i Od n, n Os already cancelled path
// Try: skip to tPu from L via taking true then aggressively cancel
const chain2 = [L, t1, t1x, tPu, R];
for (let i = 0; i < chain2.length - 1; i++) {
  console.log(`c2[${i}]->[${i + 1}]`, j(chain2[i]!, chain2[i + 1]!));
}

// Or: tOr -> R somehow with nPb and Or cancelled
console.log('tOr->R', j(tOr, R));
// null-5: i Pu, Or → Or
console.log('tOr->Or', j(tOr, ensure(',\\Or,')));
// Then Or → nPb? no

// Check if identical-4 or soft rules sneak
for (const rule of getRulesForTransition(index, tOr, tPu)) {
  const m = checkInferenceRules(tOr, tPu, rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  });
  if (m.match) console.log('tOr->tPu via', rule.id);
}
