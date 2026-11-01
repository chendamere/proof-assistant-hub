/**
 * s21: merged form, bubble Pe before Bb, push into arms, drop Pe, add s2 Os, collapse t1.
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
function show(name: string, a: string, b: string) {
  const r = j(a, b);
  console.log(name, r ?? 'NULL');
  return !!r;
}

const L = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,'
);
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');
const merged = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},s_1 \\Pe s_2,t_1 \\Os,t_2 \\Os,'
);
show('L->merged', L, merged);

// bubble Pe before Bb: Ob Ob Pe Bb Os Os
const m1 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},t_1 \\Os,t_2 \\Os,'
);
show('merged->m1 Pe before Bb', merged, m1);

// check adjacent swaps
const m0 = merged.replace(
  ',\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},s_1 \\Pe s_2,',
  ',s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},'
);
show('merged->m0 swap Bb/Pe', merged, m0);

const peIn = m0.replace(
  ',s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},',
  ',\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,},'
);
show('m0->peIn', m0, peIn);

const peIn2 = m0.replace(
  ',s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},',
  ',\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,},'
);
show('m0->peIn2 Pe at end of arms', m0, peIn2);

const dropTrue = peIn2.replace(
  '{,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}',
  '{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}'
);
show('peIn2->dropTrue', peIn2, dropTrue);

// From L: create-temp s2, then try to get Ot s1 next to Ot s2 and Pe at top
const L1 = ensure(L.replace(/,$/, ',\\Ot s_2,s_2 \\Os,'));
show('L->L1', L, L1);

// Also create-temp s1
const L2 = ensure(L1.replace(/,$/, ',\\Ot s_1,s_1 \\Os,'));
show('L1->L2 add Ot s1', L1, L2);
console.log('L2', L2);

// From L2: Ot s1, s1 Os at end, Pe, Ot s2, s2 Os — rearrange to Ot s1, Ot s2, Pe, s2 Os, s1 Os
const want = ensure(
  L.replace(
    /,s_1 \\Pe s_2,$/,
    ',\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,'
  )
);
// stepwise bubble
let cur = L2;
const targets = [
  // bubble Ot s1 next to Pe and Ot s2
  L2.replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',\\Ot s_1,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,s_1 \\Os,'),
  L2.replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',s_1 \\Pe s_2,\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,'),
  L2.replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',s_1 \\Pe s_2,\\Ot s_2,\\Ot s_1,s_2 \\Os,s_1 \\Os,'),
];
for (let i = 0; i < targets.length; i++) {
  show(`L2->t${i}`, L2, targets[i]!);
}

// Drop Pe when Ot s1, Ot s2, Pe contiguous at end
const contig = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,'
);
const contigDrop = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,'
);
show('contig->dropPe', contig, contigDrop);

// After drop: cancel Ot s1 + s1 Os
const afterCancelS1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,'
);
show('contigDrop->cancel s1', contigDrop, afterCancelS1);

// Now we have EXTRA Ot s2,s2 Os AND first sandwich. Cancel first sandwich's content:
// Push s1 Os into first bb — but we already cancelled s1 Os!
// Need to cancel first sandwich BEFORE cancelling the create-temp s1 pair.
// Order:
// 1. L + Ot s2,s2 Os + Ot s1,s1 Os
// 2. Push s1 Os into first Bb arms (keep Ot s1 at top for Pe drop later? or use arm Ot s1)

// Push s1 Os into first Bb from L2
const pushOs = L2.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,},t_1 \\Os,'
).replace(',\\Ot s_1,s_1 \\Os,', ',\\Ot s_1,'); // consume one s1 Os from end? 
console.log('\n--- push variants ---');
const push1 = L2.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,}'
).replace(/,\\Ot s_1,s_1 \\Os,$/, ',\\Ot s_1,');
show('L2->push1 (Os into arms, leave Ot s1)', L2, push1);
console.log('push1', push1.slice(0, 200));

// Direct code-dist style: atom s1 Os before Bb into arms — need Os before Bb
const before = L2.replace(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}',
  ',i \\Ob t_1,s_1 \\Os,\\Bb{t_1 \\Pc j}'
).replace(/,\\Ot s_1,s_1 \\Os,$/, ',\\Ot s_1,');
show('L2->before Os after Ob', L2, before);

// List connectivity rules that move release into Bb
console.log('\n--- rewrites create-temp from empty on R-like ---');
const nearR = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,');
show('dropFirst only', L, nearR);
const nearR2 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,');
show('nearR->nearR2', nearR, nearR2);
show('nearR2->R drop Pe+Ot?', nearR2, R);

// Can we drop Pe+Ot s2 keeping s2 Os? = temp-value with only one Ot?
const only = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,s_1 \\Pe s_2,s_2 \\Os,');
const only2 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,s_2 \\Os,');
show('only->dropPe need 2 Ot', only, only2);

// Pull Ot s2 out of Bb next to Pe?
const pull = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,'
);
show('nearR2->pull Ot from arm', nearR2, pull);

// operators-3 style on fragment Ot s2, Pe, s2 Os with missing Ot s1
console.log('\nfragment checks');
show(
  'frag Ot Ot Pe Os -> Ot Ot Os',
  ',\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,',
  ',\\Ot s_1,\\Ot s_2,s_2 \\Os,'
);
show(
  'frag Ot Ot Os -> Ot',
  ',\\Ot s_1,\\Ot s_2,s_2 \\Os,',
  ',\\Ot s_1,'
);
show(
  'frag Ot Ot Os -> Ot s2 Os keep?',
  ',\\Ot s_1,\\Ot s_2,s_2 \\Os,',
  ',\\Ot s_2,s_2 \\Os,'
);
show('frag that keep s2 Os cancel s1', ',\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,', ',\\Ot s_2,s_2 \\Os,');
