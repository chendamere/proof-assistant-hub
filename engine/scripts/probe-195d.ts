/** Can we introduce R via reverse release? */
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
function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
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
const dag = new Map();
const pos = 13 * 100000 + 195;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  dag
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, i_1 \\Ps j_1, j \\Ps i_1, R(i_1), i_1 \\Os, j_1 \\Os,'
);
const R = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, R(i_1), R(j_1), i_1 \\Ps j_1, i_1 \\Os, j_1 \\Os,'
);

// Reverse release: insert R(j_1) before j_1 Os
const s1 = ensure(L.replace('j_1 \\Os', 'R(j_1),j_1 \\Os'));
console.log('rev-release insert R(j_1)', justify(L, s1));
console.log('s1→R', justify(s1, R));
console.log('s1', s1);
console.log('R ', R);

// After insert, drop j Ps i_1 and reorder
const s2 = ensure(s1.replace(',j \\Ps i_1,', ','));
console.log('drop jPsi1', justify(s1, s2));
console.log('s2→R', justify(s2, R));
console.log('s2', s2);

// Tiny tests for release both ways
console.log('release fwd', justify(',R(j_1),j_1 \\Os,', ',j_1 \\Os,'));
console.log('release rev', justify(',j_1 \\Os,', ',R(j_1),j_1 \\Os,'));

// Full path: insert R, bubble, drop Ps
let cur = L;
const path: string[] = [];
function hop(nextRaw: string, label: string) {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j);
  if (!j) return false;
  path.push(next);
  cur = next;
  return true;
}

hop(L.replace('i_1 \\Os,j_1 \\Os', 'i_1 \\Os,R(j_1),j_1 \\Os'), 'insert R before j1Os');
hop(cur.replace(',j \\Ps i_1,', ','), 'drop jPsi1');
// now: i Ps j, i Oc i_1, j Oc j_1, i_1 Ps j_1, R(i_1), i_1 Os, R(j_1), j_1 Os
// want: i Ps j, i Oc i_1, j Oc j_1, R(i_1), R(j_1), i_1 Ps j_1, i_1 Os, j_1 Os
console.log('cur', cur);
console.log('direct?', justify(cur, R));

// bubble R(j_1) left and i_1 Ps j_1 right of R pair
{
  const items = cur
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/);
  console.log('items', items);
}
