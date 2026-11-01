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

const intoOd = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const R = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// Bubble Od s1 left in true arm: Od s2, Os, Od s1 → Od s2, Od s1, Os → Od s1, Od s2, Os
const s1 = intoOd.replace('{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}', '{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}');
console.log('intoOd->s1', j(intoOd, ensure(s1)));
const s2 = ensure(s1).replace('{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}', '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}');
console.log('s1->s2', j(ensure(s1), s2));

// Add sandwich via create-subnode + create-temp at false arm end
const sand = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
const withSand = ensure(s2).replace(
  ',t_1 \\Os,},\\Bb{s_1 \\Pu}',
  `,t_1 \\Os,${sand.slice(1)},},\\Bb{s_1 \\Pu}`
);
console.log('s2->withSand', j(s2, withSand));
console.log('create-subnode at false end from s2');
const onlyOb = ensure(s2).replace(
  ',t_1 \\Os,},\\Bb{s_1 \\Pu}',
  ',t_1 \\Os,i \\Ob t_2,t_2 \\Os,},\\Bb{s_1 \\Pu}'
);
console.log('s2->onlyOb', j(s2, onlyOb));

// Derived: whole intoOd → R?
console.log('intoOd->R', j(intoOd, R));

// BFS reorder true arm only
const RULES = ['swap-id-1', 'swap-id-2', 'swap-id-release', 'swap-release-release', 'swap-id-temp', 'swap-temp-release'];
const goal = ensure(s2);
const seen = new Set([intoOd]);
const q = [{ e: intoOd, via: [] as string[] }];
let n = 0;
let found = false;
while (q.length && n < 500 && !found) {
  const cur = q.shift()!;
  n++;
  for (const id of RULES) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    for (const o of oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 8)) {
      const e = ensure(o);
      if (seen.has(e)) continue;
      seen.add(e);
      const via = [...cur.via, id];
      if (e === goal || e.includes('{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}')) {
        console.log('FOUND reorder', via.join('>'), e.slice(40, 100));
        found = true;
        break;
      }
      if (via.length < 4) q.push({ e, via });
    }
    if (found) break;
  }
}
console.log('bfs', n, 'seen', seen.size);
