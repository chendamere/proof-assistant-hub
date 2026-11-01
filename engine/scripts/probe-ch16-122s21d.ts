/**
 * Continue s21: create-temp add Ot s2,s2 Os then search path to R.
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

const L = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,'
);
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');

const L1 = ensure(L.replace(/,$/, ',\\Ot s_2,s_2 \\Os,'));
console.log('L->L1 create-temp', j(L, L1));
console.log('L1', L1);
console.log('L1->R', j(L1, R));

// From L1: drop Pe using Ot s1 (in arm) + Ot s2 (new) — push both together
const L1b = L1.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,}'
)
  .replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,', ',s_2 \\Os,')
  .replace(',\\Ot s_2,s_2 \\Os,', ',s_2 \\Os,'); // if pe already consumed Ot
console.log('\ntry L1b', L1b.slice(0, 180));

// Cleaner stepwise from L1:
// 1) bubble Pe next to new Ot s2
const sA = L1.replace(',t_2 \\Os,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,', ',t_2 \\Os,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,');
console.log('L1->sA bubble Pe past Ot?', j(L1, sA));
const sA2 = L1.replace(',t_2 \\Os,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,', ',t_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,\\Ot s_2,');
console.log('L1->sA2 Ot after Os', j(L1, sA2));

// unzip L1
const unzip1 = L1.replace(
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,',
  'i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,'
);
console.log('L1->unzip', j(L1, unzip1));

// From merged form + create-temp
const merged = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},s_1 \\Pe s_2,t_1 \\Os,t_2 \\Os,'
);
console.log('L->merged', j(L, merged));
const merged1 = ensure(merged.replace(/,$/, ',\\Ot s_2,s_2 \\Os,'));
console.log('merged->merged1', j(merged, merged1));

// pe into merged Bb
const mergedPeIn = merged.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},s_1 \\Pe s_2,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,},'
);
console.log('merged->peIn', j(merged, mergedPeIn));

// drop Pe in true only via temp-value-equal
const mergedPeDropTrue = mergedPeIn.replace(
  '{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}',
  '{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}'
);
console.log('peIn->dropTruePe', j(mergedPeIn, mergedPeDropTrue));

// drop Pe both arms
const mergedPeDrop = mergedPeIn.replace(
  '{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}',
  '{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,}'
);
console.log('peIn->dropBothPe', j(mergedPeIn, mergedPeDrop));

// BFS shallow from L1 toward R using create*/swap/temp-value/derived
const RULE_IDS = [
  'create-temp',
  'create-id',
  'create-subnode',
  'create-empty',
  'temp-value-equal',
  'id-value-equal',
  'thm-Pe-symmetric',
  'swap-temp-release',
  'swap-release-release',
  'swap-subnode-release',
  'swap-id-release',
  'swap-temp-temp',
  'rules-of-node-continuity-320-tiini',
  'theorems-of-operators-and-relationships-4-idtidt',
  'theorems-of-relationship-of-node-value-comparison-24-iejms',
];

function score(e: string) {
  const a = ensure(e);
  let d = Math.abs(a.length - R.length);
  for (let i = 0; i < Math.min(a.length, R.length); i++) if (a[i] !== R[i]) d++;
  if (!a.includes('t_1')) d -= 50;
  if (a.includes('s_2 \\Os')) d -= 25;
  if (!a.includes('Pe')) d -= 20;
  if ((a.match(/\\Ot s_2/g) || []).length === 1) d -= 10;
  return d;
}

type N = { e: string; via: string[]; depth: number };
const seen = new Set([L]);
const q: N[] = [{ e: L, via: [], depth: 0 }];
let best: N = q[0]!;
let bestSc = score(L);
let found: N | null = null;
const MAX = 2500;

console.log('\nBFS from L, start score', bestSc);
let explored = 0;
while (q.length && explored < MAX && !found) {
  const cur = q.shift()!;
  explored++;
  const neigh: Array<{ e: string; rule: string }> = [];
  // derived neighbors via unzip etc — try known transforms
  const unzip = cur.e.replace(
    /i \\Ob t_1,\\Bb\{t_1 \\Pc j\}\{([^}]*)\}\{([^}]*)\},t_1 \\Os,i \\Ob t_2,\\Bb\{t_2 \\Pc j\}\{([^}]*)\}\{([^}]*)\},t_2 \\Os/,
    'i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{$1}{$2},\\Bb{t_2 \\Pc j}{$3}{$4},t_1 \\Os,t_2 \\Os'
  );
  if (unzip !== cur.e && j(cur.e, unzip)) neigh.push({ e: ensure(unzip), rule: 'derived-unzip' });
  for (const id of RULE_IDS) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    for (const o of oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 12)) {
      neigh.push({ e: ensure(o), rule: id });
    }
  }
  for (const nb of neigh) {
    if (seen.has(nb.e)) continue;
    seen.add(nb.e);
    const sc = score(nb.e);
    const node: N = { e: nb.e, via: [...cur.via, nb.rule], depth: cur.depth + 1 };
    if (sc < bestSc) {
      bestSc = sc;
      best = node;
      console.log('improv', bestSc, 'd', node.depth, nb.rule, nb.e.slice(0, 120));
    }
    if (nb.e === R) {
      found = node;
      break;
    }
    if (node.depth < 7 && sc < bestSc + 100) q.push(node);
  }
}
console.log('explored', explored, 'seen', seen.size, 'bestSc', bestSc);
console.log('best via', best.via.join(' > '));
console.log('best', best.e.slice(0, 220));
console.log('best->R', j(best.e, R));
if (found) {
  console.log('FOUND', found.via.join(' > '));
  console.log(found.e);
}
