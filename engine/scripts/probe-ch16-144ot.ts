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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
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

const iPuOt = ensure(',i \\Pu,\\Ot n,');
const tPu = ensure(',i \\Pu,');
const R = ensure(',i \\Pu,i \\nPb t,');
console.log('direct', j(iPuOt, tPu));
console.log('toR', j(iPuOt, R));

// Exhaustive: any short rule
let hits = 0;
for (const rule of all) {
  if (rule.pos >= pos) continue;
  if (rule.leftSide.length > 80) continue;
  if (
    checkInferenceRules(iPuOt, tPu, rule.leftSide, rule.rightSide, { dagCache: index.dagCache })
      .match
  ) {
    console.log('HIT', rule.id, rule.leftSide, '↔', rule.rightSide);
    hits++;
  }
}
console.log('hits', hits);

// BFS with create-temp to add Os then cancel both Ot+Os
const a = ensure(',i \\Pu,\\Ot n,\\Ot x,x \\Os,');
const b = ensure(',i \\Pu,\\Ot n,n \\Os,');
console.log('iPuOt->b create-temp same n', j(iPuOt, b));
console.log('b->tPu', j(b, tPu));
const c = ensure(',i \\Pu,\\Ot n,\\Ot n,n \\Os,');
console.log('iPuOt->c', j(iPuOt, c));
console.log('c->tPu', j(c, tPu));
console.log('c->iPuOt', j(c, iPuOt));

// iPuOt -> R via 142 leaving Ot?
const withBoth = ensure(',i \\Pu,i \\nPb t,\\Ot n,');
console.log('iPuOt->withBoth', j(iPuOt, withBoth));
console.log('withBoth->R', j(withBoth, R));

// From arranged, null-0 might consume Ot+Pe+Os leaving i Pu AND the trailing Ot - we got iPuOt
// What if arranged is Ot n, i Pe n, n Os, Ot n and we cancel trailing Ot first? can't without Os
const arranged = ensure(',\\Ot n,i \\Pe n,n \\Os,\\Ot n,');
const d = ensure(',\\Ot n,i \\Pe n,n \\Os,\\Ot n,n \\Os,'); // create-temp on trailing
console.log('arranged->d', j(arranged, d));
console.log('d->after3', j(d, ensure(',\\Ot n,i \\Pe n,n \\Os,')));
console.log('d->tPu', j(d, tPu));
// d cancel trailing create-temp: Ot n, i Pe n, n Os
console.log('d->after3 cancel', j(d, ensure(',\\Ot n,i \\Pe n,n \\Os,')));
