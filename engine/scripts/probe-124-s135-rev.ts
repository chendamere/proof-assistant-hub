/** Work backward from R to L for s135. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const CHAPTER_ORDER = [
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
];
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const POS = 13 * 100000 + 124;
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < POS),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const f = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
    .trim()
    .split(/\n/)
    .find((l) => JSON.parse(l).step === 135)!
);
const L = ensure(f.left);
const R = ensure(f.right);

// From R: reverse null-12 pull i1 Os out of arms (Os lands before Bb)
const pulledOs = ensure(
  R.replace(
    '\\Bb{i \\Pu}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    'i_1 \\Os,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
console.log('R→pullOs', justify(R, pulledOs)); // this is reverse direction - check pullOs→R
console.log('pullOs→R', justify(pulledOs, R));

// From pulledOs: push Ps into arms (identical-29)
const withPsIn = ensure(
  pulledOs.replace(
    ',i \\Oc i_1,i \\Ps i_1,j \\Oc j_1,i_1 \\Os,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},i_2 \\Os,j_1 \\Os,',
    ',i \\Oc i_1,j \\Oc j_1,i_1 \\Os,\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},i_2 \\Os,j_1 \\Os,'
  )
);
console.log('push Ps into arms from pulledOs?', justify(
  ensure(pulledOs.replace(',i \\Ps i_1,j \\Oc j_1,i_1 \\Os,', ',j \\Oc j_1,i_1 \\Os,')),
  withPsIn
));

// Better forward from L:
// After pull Ps: ..., i Ps i1, Bb, i2 Os, i1 Os, j1 Os
// Bubble i1 Os left to after Bb by swapping with i2 Os only — already adjacent to j1
// Can we apply null-12 with Os AFTER Bb? No.
//
// Try: bubble j Oc j1 right into position, push BOTH Oc into Bb, then Os can swap with nothing...
//
// Check: after pull Ps, is there justify to R directly via multi-site? already no.
//
// Try mid: pull Ps AND have Os order i1 Os, i2 Os, j1 Os then... still after Bb.

const midPull = ensure(
  L.replace(
    '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    'i \\Ps i_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
const midOrd = ensure(midPull.replace(',i \\Oc i_1,j \\Oc j_1,i \\Ps i_1,', ',i \\Oc i_1,i \\Ps i_1,j \\Oc j_1,'));
console.log('L→midOrd', justify(L, midPull), justify(midPull, midOrd));

// From midOrd push i1 Os: need Os before Bb. Swap i2 Os with Bb using... 
// Try rule null-12 on a COPY: first identical-70 style? no.
//
// Put i1 Os into arms by matching R construction with justify midOrd→R if we build exact R:
console.log('midOrd→R', justify(midOrd, R));

// Construct: swap i1 Os left past i2 Os, then try swap-release-branch style with Bb{i Pu}
const midOs = ensure(midOrd.replace(',i_2 \\Os,i_1 \\Os,j_1 \\Os,', ',i_1 \\Os,i_2 \\Os,j_1 \\Os,'));
console.log('swap Os', justify(midOrd, midOs));
// Now i1 Os is still after Bb. Try moving j Oc past Bb? 
const midJ = ensure(midOs.replace(',j \\Oc j_1,\\Bb{', ',\\Bb{').replace(',i_2 \\Os,j_1 \\Os,', ',j \\Oc j_1,i_2 \\Os,j_1 \\Os,'));
// too hacky

// Check pullOs → midOrd path (should be bubble Os right + bubble Ps)
console.log('pulledOs', pulledOs.slice(0, 120));
console.log('midOrd  ', midOrd.slice(0, 120));
console.log('pulledOs→midOrd', justify(pulledOs, midOrd));
console.log('midOrd→pulledOs', justify(midOrd, pulledOs));
