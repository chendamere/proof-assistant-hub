/**
 * Hand-chain probes for 122 flat:0 s21.
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

function tryPair(name: string, a: string, b: string) {
  const r = j(a, b);
  console.log(name, r ?? 'NULL');
  return r;
}

// A: swap Pe before t2 Os
const a1 = L.replace(',t_2 \\Os,s_1 \\Pe s_2,', ',s_1 \\Pe s_2,t_2 \\Os,');
tryPair('A swap Pe/Os', L, a1);

// B: pe into t2 bb (Pe before Bb? or after Ob)
const b1 = a1.replace(
  ',s_1 \\Pe s_2,t_2 \\Os,',
  ',t_2 \\Os,'
).replace(
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  '\\Bb{t_2 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_2,}'
);
tryPair('B pe into t2 from a1', a1, b1);
tryPair('B direct from L', L, b1);

// C: pe into first bb
const c1 = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Pe s_2,}{,i \\Od s_1,s_1 \\Pe s_2,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
tryPair('C pe into t1', L, c1);

// D: create-temp add at end
const d1 = L.replace(/,$/, ',\\Ot s_x,s_x \\Os,');
tryPair('D create-temp fresh', L, d1);
const d2 = L.replace(/,$/, ',\\Ot s_2,s_2 \\Os,');
tryPair('D create-temp s2', L, d2);

// E: collapse first sandwich like book 573-578 style on first sandwich only
// E1: reorder t1 Os before? push s1 Os into arms — need Os first
const e0 = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,},t_1 \\Os,'
);
tryPair('E0 scaffold s1 Os both arms', L, e0);

// F: drop Pe via temp-value when Ot s1 and Ot s2 co-located
const f0 = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,}'
);
tryPair('F add Ot s2 in t1 true', L, f0);

// G: unzip both then work
const g0 = L.replace(
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,',
  'i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,s_1 \\Pe s_2,'
);
tryPair('G unzip', L, g0);

// H: from unzipped (step 570 style) which we already passed going TO L — reverse?
const h0 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},s_1 \\Pe s_2,t_1 \\Os,t_2 \\Os,'
);
tryPair('H reverse merged zip L<-h0', h0, L);

// I: oneStepRewrites with create-temp / create-subnode / create-id / temp-value-equal
const prefer = ['create-temp', 'create-id', 'create-subnode', 'temp-value-equal', 'id-value-equal', 'swap-release-release', 'swap-temp-release', 'swap-subnode-release'];
console.log('\n--- oneStep from L (prefer create*) ---');
let hits = 0;
for (const id of prefer) {
  const rule = all.find((r) => r.id === id);
  if (!rule) continue;
  const outs = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  for (const o of outs.slice(0, 8)) {
    hits++;
    const toR = j(o, R);
    const sc =
      (o.includes('s_2 \\Os') ? 1 : 0) +
      (!o.includes('t_1') ? 2 : 0) +
      (!o.includes('Pe') ? 1 : 0);
    if (sc > 0 || toR || hits <= 3) {
      console.log(id, 'sc', sc, '->R', toR, o.slice(0, 140));
    }
  }
}
console.log('total rewrite hits', hits);

// J: collapse first sandwich step by step matching 24-27 pattern on t1
// From L: need s1 Os in arms. Get s1 Os from Pe somehow?
// create-temp reverse on TRUE arm only: Ot s1, s1 Os -> empty, IF we have s1 Os
// What if Pe + create gives Os?
// Look at null-comp def: Blb Pu <-> Ot j, Blb{i Pe j}{j Os}{j Os}
// Not applicable.

// K: Drop first sandwich via create-subnode reverse if Bb is empty
const k1 = L.replace(
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,'
);
tryPair('K empty arms keep ObOs', L, k1);
tryPair('K empty -> drop sandwich', k1, L.replace(/i \\Ob t_1,\\Bb\{t_1 \\Pc j\}\{,\\Ot s_1,\}\{,i \\Od s_1,\},t_1 \\Os,/, ''));

// L path: add s2 Os first (create-temp with existing Ot s2 in arm — duplicate?)
// Push s2 Os into t2 arms then create-temp cancel Ot leaving empty true — that's steps 23-25 on R side already.

// M: replace Pe with s1 Os via ? then rename?
const m1 = L.replace(',s_1 \\Pe s_2,', ',s_1 \\Os,');
tryPair('M Pe->s1 Os', L, m1);
const m2 = L.replace(',s_1 \\Pe s_2,', ',s_1 \\Os,s_2 \\Os,');
tryPair('M Pe->both Os', L, m2);

// N: use thm-Pe-symmetric then something
const n1 = L.replace(',s_1 \\Pe s_2,', ',s_2 \\Pe s_1,');
tryPair('N Pe sym', L, n1);

console.log('\nR', R);
