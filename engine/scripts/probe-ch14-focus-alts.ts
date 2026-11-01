/**
 * Search short library mid-paths for the 5 soft hops in connectivity 124.
 */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const CHAPTER = 'Rules_of_Node_Connectivity';
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
function fp(s: string) {
  return ensure(s).replace(/\s+/g, '');
}

const table = JSON.parse(fs.readFileSync('proof-steps-table.json', 'utf8')) as Record<string, string[]>;
const key = Object.keys(table).find(
  (k) =>
    k.startsWith(CHAPTER + '::') &&
    k.includes('i \\Pc j, i \\On') &&
    k.includes('i \\On, i \\Pc j')
)!;
const steps = table[key]!;
const thmNum = parseInt(key.split('::')[1]!, 10);
const theoremPos = CO.indexOf(CHAPTER) * 100000 + thmNum;
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const prior = all.filter((r) => r.pos < theoremPos);
const index = buildRuleIndex(prior, new Map());

function justify(a: string, b: string): string | null {
  const A = ensure(a);
  const B = ensure(b);
  if (fp(A) === fp(B)) return 'identity';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

/** Manual candidates for focus 24→25 */
const L24 = steps[24]!;
const R25 = steps[25]!;
console.log('=== Focus 24→25 ===');
console.log('L', ensure(L24));
console.log('R', ensure(R25));

// Candidate mids keeping shell then applying 54
const BODY = ',i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),';
const BODYF = ',i \\nPu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),';

const cands: [string, string][] = [
  [
    'keepShell+outerPu',
    `,i \\Pu, i \\Oc i_1, j \\Oc j_1, \\Bb{if(i \\Pu)}{,i \\Pu,${BODY.slice(1)}}{${BODYF.slice(1)}}, i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'outerPu+Bb focus mid',
    `,i \\Pu, i \\Oc i_1, j \\Oc j_1, i \\Pu, ${BODY.slice(1)} i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'after54 keep shell',
    `,i \\Pu, i \\Oc i_1, j \\Oc j_1, i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2), i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'drop i1 pair',
    `,i \\Pu, j \\Oc j_1, i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2), i_2 \\Os, j_1 \\Os,`,
  ],
  [
    'drop j1 pair',
    `,i \\Pu, i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2), i_2 \\Os,`,
  ],
  [
    'drop i2 Os only via R release?',
    `,i \\Pu, i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),`,
  ],
  [
    'dedupe Pu',
    `,i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),`,
  ],
  // Bb{if} form of L24
  [
    'L24 if-form',
    `,i \\Oc i_1, j \\Oc j_1, \\Bb{if(i \\Pu)}{,i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),}{,i \\nPu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),}, i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
];

for (const [name, expr] of cands) {
  console.log('\n--', name);
  console.log('  from L24', justify(L24, expr));
  console.log('  to R25', justify(expr, R25));
}

// Chain: L24 -> if-form -> ? 
const ifForm = cands.find((c) => c[0] === 'L24 if-form')![1];
console.log('\nL24 -> ifForm', justify(L24, ifForm));

// Try: push nothing; apply reverse create to cancel pairs around Bb by first pushing Os into Bb then...
// Check swap-65 reverse for redistribute
const L136 = steps[136]!;
const R137 = steps[137]!;
console.log('\n=== Redistribute 136→137 ===');
console.log('L', ensure(L136));
console.log('R', ensure(R137));

const redMids: [string, string][] = [
  [
    'pullPs',
    `,i \\Oc i_1, j \\Oc j_1, i \\Ps i_1, \\Bb{i \\Pu}{,i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'pullPs if-form',
    `,i \\Oc i_1, j \\Oc j_1, i \\Ps i_1, \\Bb{if(i \\Pu)}{,i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'reorder Ps',
    `,i \\Oc i_1, i \\Ps i_1, j \\Oc j_1, \\Bb{i \\Pu}{,i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, i_1 \\Os, j_1 \\Os,`,
  ],
  [
    'Os before Bb',
    `,i \\Oc i_1, i \\Ps i_1, j \\Oc j_1, i_1 \\Os, \\Bb{i \\Pu}{,i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, j_1 \\Os,`,
  ],
  [
    'pushOs front',
    `,i \\Oc i_1, i \\Ps i_1, j \\Oc j_1, \\Bb{i \\Pu}{,i_1 \\Os, i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,i_1 \\Os, R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, j_1 \\Os,`,
  ],
  [
    'swap false Os past R',
    `,i \\Oc i_1, i \\Ps i_1, j \\Oc j_1, \\Bb{i \\Pu}{,i_1 \\Os, i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}{,R(i_1), i_1 \\Os, i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,}, i_2 \\Os, j_1 \\Os,`,
  ],
];

let prev = L136;
for (const [name, expr] of redMids) {
  const j = justify(prev, expr);
  console.log(name, j, '| to R', justify(expr, R137));
  if (j) prev = expr;
}

// Also check direct hops from L136
console.log('\nDirect L136 checks:');
for (const [name, expr] of redMids) {
  console.log(name, justify(L136, expr));
}
