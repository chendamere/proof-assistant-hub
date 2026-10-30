import { axioms } from '../../../src/data/axioms';
import { definitions } from '../../../src/data/definitions';
import { theorems } from '../../../src/data/theorems';
import { earlyRulePosition } from '../../../src/data/rulePosition';

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

const pos = 13 * 100000 + 195;
const all = [...axioms, ...definitions, ...theorems];
let n = 0;
for (const r of all) {
  if (posOf(r.id) >= pos) continue;
  const lc = (r.leftSide.match(/R\(/g) || []).length;
  const rc = (r.rightSide.match(/R\(/g) || []).length;
  if (rc > lc && /\\Oc|\\Ps/.test(r.leftSide + r.rightSide)) {
    console.log(r.id, 'R', lc, '→', rc);
    console.log(' L', r.leftSide.slice(0, 140));
    console.log(' R', r.rightSide.slice(0, 140));
    n++;
    if (n > 40) break;
  }
}
console.log('total shown', n);
