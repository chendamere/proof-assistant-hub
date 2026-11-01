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

const peOnly = ensure(',\\Ot n,i \\Pe n,');
const after3 = ensure(',\\Ot n,i \\Pe n,n \\Os,');
const tPu = ensure(',i \\Pu,');
const R = ensure(',i \\Pu,i \\nPb t,');
const peTemp = ensure(',\\Ot n,i \\Pe n,\\Ot n,n \\Os,');
const peRefl = ensure(',\\Ot n,i \\Pe n,n \\Pe n,\\Ot n,n \\Os,');
const peBoth = ensure(',\\Ot n,\\Ot n,n \\Pe n,n \\Os,');
const peSym = ensure(',\\Ot n,n \\Pe i,');
console.log('peOnly->peSym', j(peOnly, peSym));
console.log('peOnly->peTemp', j(peOnly, peTemp));
console.log('peTemp->peRefl', j(peTemp, peRefl));
console.log('peRefl->peBoth drop iPe', j(peRefl, peBoth));
console.log('peBoth->Ot', j(peBoth, ensure(',\\Ot n,')));

// BFS peOnly -> after3 or tPu
const RULES = [
  'create-temp',
  'create-id',
  'temp-value-equal',
  'thm-Pe-reflexive',
  'thm-Pe-symmetric',
  'thm-Pe-transitive',
  'swap-temp-temp',
  'swap-temp-release',
  'theorems-of-node-null-comparison-0-iutmi',
  'theorems-of-operators-and-relationships-4-idtidt',
];
const goal = new Set([after3, tPu, R]);
const seen = new Set([peOnly]);
const q = [{ e: peOnly, via: [] as string[] }];
let n = 0;
let found = false;
while (q.length && n < 2000 && !found) {
  const cur = q.shift()!;
  n++;
  for (const id of RULES) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    for (const o of oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 10)) {
      const e = ensure(o);
      if (seen.has(e)) continue;
      seen.add(e);
      const via = [...cur.via, id];
      if (goal.has(e)) {
        console.log('FOUND', e.slice(0, 80), via.join('>'));
        found = true;
        break;
      }
      if (via.length < 6) q.push({ e, via });
    }
    if (found) break;
  }
}
console.log('bfs', n, 'seen', seen.size, 'found', found);

// operators-3: Ot n -> Ot n, n Pu
const op3 = ensure(',\\Ot n,n \\Pu,');
console.log('peOnly-> drop Pe keep Ot', j(peOnly, ensure(',\\Ot n,')));
console.log('Ot->op3', j(ensure(',\\Ot n,'), op3));
console.log('op3->tPu?', j(op3, tPu));
