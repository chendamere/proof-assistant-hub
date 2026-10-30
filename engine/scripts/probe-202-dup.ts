/** Probe how to add/drop j2 Ps j1 next to R(j2), R_(j1). */
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
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 202;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

// Print candidate dup rules
for (const r of allRules) {
  if (r.pos >= pos) continue;
  const lps = (r.leftSide.match(/\\Ps/g) || []).length;
  const rps = (r.rightSide.match(/\\Ps/g) || []).length;
  if (lps >= 1 && rps > lps && /R/.test(r.leftSide)) {
    console.log('DUP', r.id, '|', r.leftSide, '⟺', r.rightSide);
  }
}

const L = ensure(
  ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
);
const R = ensure(
  ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
);

// Try: convert R_ to R via some rule? Or add R(j1)?
const paths: Array<[string, string[]]> = [
  [
    'add via r-27 after R_(j1)→R(j1)',
    [
      L.replace('R\\_(j_1)', 'R(j_1)'),
      L.replace('R\\_(j_1)', 'R(j_1)').replace(
        ',j_2 \\Ps j_1,R(j_2),R(j_1),\\Blb',
        ',j_2 \\Ps j_1,R(j_2),R(j_1),j_2 \\Ps j_1,\\Blb'
      ),
      R.replace('R\\_(j_1)', 'R(j_1)'), // then convert back?
    ],
  ],
  [
    'add R(j1) beside R_',
    [L.replace('R\\_(j_1)', 'R(j_1),R\\_(j_1)')],
  ],
  [
    'flip Ps then r-27',
    [
      L.replace('j_2 \\Ps j_1', 'j_1 \\Ps j_2'),
    ],
  ],
  [
    'bubble R(j2) next to j Oc and copy-identical j Ps j2?',
    [
      L.replace(',j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,', ',j \\Oc j_2,j_2 \\Ps j_1,j \\Oc j_1,'),
      L.replace(',j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,', ',j \\Oc j_2,j \\Ps j_2,j \\Oc j_1,j_2 \\Ps j_1,'),
    ],
  ],
];

for (const [label, steps] of paths) {
  console.log('\n===', label);
  let cur = L;
  for (let i = 0; i < steps.length; i++) {
    const next = ensure(steps[i]!);
    const j = justify(cur, next);
    console.log(i + 1, j ?? 'FAIL', next.slice(40, 120));
    if (!j) break;
    cur = next;
  }
}

// Brute: try every rule that mentions Ps and R against L→R directly with create-copy skip
console.log('\ndirect', justify(L, R) ?? 'FAIL');

// What if we allow empty-LHS create-copy? already skipped identical-4 only
const L2 = L;
const withCopy = ensure(L.replace(',j \\Oc j_2,', ',j \\Oc j_2,j \\Ps j_2,'));
console.log('copy-id j Ps j2', justify(L2, withCopy) ?? 'FAIL');
