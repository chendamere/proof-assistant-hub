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

const dropTrue = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const exp1 = ensure(
  dropTrue.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
const tempIn = ensure(exp1.replace('\\Bb{t_2 \\Pc j}{,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,}'));
console.log('exp1->tempIn', j(exp1, tempIn));

// Pull Os from true to after Bb (next to t2 Os)
const pullOs = ensure(tempIn.replace('\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,},s_2 \\Os,'));
console.log('tempIn->pullOs', j(tempIn, pullOs));

// Move Od into false: Ob, Bb{Ot}{}, Os, Od → Ob, Bb{Ot}{Od}, Os
const odIn = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,'
  )
);
console.log('exp1->odIn', j(exp1, odIn));

// Swap Os and Od: Ob, Bb, Os, Od → Ob, Bb, Od, Os
const swapOsOd = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,t_2 \\Os,s_2 \\Os,'
  )
);
console.log('exp1->swapOsOd', j(exp1, swapOsOd));

const swapOsOd2 = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,s_2 \\Os,t_2 \\Os,'
  )
);
console.log('exp1->swapOsOd2', j(exp1, swapOsOd2));

// From tempIn: Bb{Ot, Os}{}, t2 Os, Od, s2 Os
// Move Od into false arm of Bb
const tempOdIn = ensure(
  tempIn.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,},t_2 \\Os,i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,'
  )
);
console.log('tempIn->tempOdIn', j(tempIn, tempOdIn));

// cancel Os in true with create-temp reverse leaving Ot; need Os next to Ot only in true
const cancelTemp = ensure(
  tempIn.replace('\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,}', '\\Bb{t_2 \\Pc j}{,}{,}')
);
console.log('tempIn->cancelTemp', j(tempIn, cancelTemp));

// BFS with create-temp, create-id, null-10/11/12, swap-id*, connectivity-9, swap-release
const RULE_IDS = [
  'create-temp',
  'create-id',
  'create-subnode',
  'theorems-of-node-null-comparison-10-mdnlbif',
  'theorems-of-node-null-comparison-11-mbnlbif',
  'theorems-of-node-null-comparison-12-mslbifi',
  'swap-id-1',
  'swap-id-2',
  'swap-id-release',
  'swap-release-release',
  'swap-id-temp',
  'swap-temp-release',
  'rules-of-node-connectivity-9-sificj',
  'swap-theorems-of-same-operand-55-idmbifi',
  'swap-theorems-of-same-operand-57-ibmbifi',
];
const goalFrag = '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}';
const seen = new Set([exp1]);
const q: { e: string; via: string[] }[] = [{ e: exp1, via: [] }];
let n = 0;
let found: string[] | null = null;
while (q.length && n < 2000 && !found) {
  const cur = q.shift()!;
  n++;
  for (const id of RULE_IDS) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    let outs: string[] = [];
    try {
      outs = oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 12);
    } catch {
      continue;
    }
    for (const o of outs) {
      const e = ensure(o);
      if (seen.has(e)) continue;
      seen.add(e);
      const via = [...cur.via, id.replace(/.*-(\d+).*/, '$1').slice(0, 12)];
      if (e.includes(goalFrag)) {
        found = via;
        console.log('FOUND', via.join('>'));
        console.log(e.slice(e.indexOf('i \\Ob t_2'), e.indexOf('i \\Ob t_2') + 180));
        break;
      }
      if (via.length < 5) q.push({ e, via });
    }
    if (found) break;
  }
}
console.log('bfs n', n, 'seen', seen.size, 'found', !!found);

// Also try goal: filled sandwich then extra Os at end of false before closing
const goal2 = ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,';
let found2 = false;
for (const e of seen) {
  if (e.includes(goal2)) {
    console.log('seen has goal2');
    found2 = true;
    break;
  }
}
console.log('goal2 in seen', found2);
