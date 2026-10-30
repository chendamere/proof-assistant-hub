/** After drop-dup, eliminate i_1 Ps j then reorder to goal. */
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
function topItems(expr: string): string[] {
  const e = ensure(expr);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = e.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = e.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
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

// State after step 7
const cur0 = ensure(
  ',i \\Ps j,i \\Oc i_1,j \\Oc j_1,i_1 \\Ps j,i_1 \\Ps j_1,R(i_1),i_1 \\Os,R(j_1),j_1 \\Os,'
);
const R = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, R(i_1), R(j_1), i_1 \\Ps j_1, i_1 \\Os, j_1 \\Os,'
);

console.log('drop i1Psj', justify(cur0, ensure(cur0.replace(',i_1 \\Ps j,', ','))));

// Use 73 reverse? i_1 Ps j, i_1 Ps j_1 → i_1 Ps j, j Ps j_1 then drop j Ps j_1 via rev copy-identical
console.log(
  '73rev',
  justify(cur0, ensure(cur0.replace('i_1 \\Ps j,i_1 \\Ps j_1', 'i_1 \\Ps j,j \\Ps j_1')))
);

// Wrap i_1 Ps j as Bb Or then collapse with empty-branch when true arm empty and we consider it false?
// Book uses Bb{i_1 Ps j}{,}{,Or,} which is def-identical-prop - equals the Ps itself, not empty.
// To get rid of it: maybe use that i_1 Ps j with i Oc i_1 and i Ps j somehow yields contradiction Or?

// identical-68: i Ps j, Bb{if(i Ps j)}{Tc c1}{Tc c2} → i Ps j, Tc c1
// Not quite.

// Try: bubble R's and use r-27 reverse on i_1 Ps j_1 with R pair - doesn't remove i_1 Ps j

// Search rules that REMOVE a Ps (fewer Ps on right)
let n = 0;
for (const r of allRules) {
  if (r.pos >= pos) continue;
  const lp = (r.leftSide.match(/\\Ps/g) || []).length;
  const rp = (r.rightSide.match(/\\Ps/g) || []).length;
  if (lp > rp && lp <= 2) {
    console.log(r.id, 'Ps', lp, '→', rp);
    console.log(' L', r.leftSide);
    console.log(' R', r.rightSide);
    n++;
    if (n > 30) break;
  }
}

// Practical: after having i_1 Ps j, apply reverse copy-identical on i Oc i_1, i_1 Ps j? 
// copy-identical: i Oc j → i Oc j, i Ps j. Reverse: i Oc i_1, i_1 Ps j → wait that's i Oc i_1, i Ps i_1 style
// For i Oc i_1 → i Oc i_1, i Ps i_1. We have i_1 Ps j not i Ps i_1.
console.log(
  'rev-copy i Oc i_1 + i Ps i_1',
  justify(',i \\Oc i_1,i \\Ps i_1,', ',i \\Oc i_1,')
);
console.log(
  'rev-copy with i1Psj',
  justify(cur0, ensure(cur0.replace(',i_1 \\Ps j,', ',')))
);

// Maybe flip i_1 Ps j to j Ps i_1, then use with i Ps j via 73?
// i Ps j, j Ps i_1 → i Ps j, i Ps i_1 then drop i Ps i_1?
const flipped = ensure(cur0.replace('i_1 \\Ps j', 'j \\Ps i_1'));
console.log('flip', justify(cur0, flipped));
const via73 = ensure(flipped.replace('i \\Ps j,i \\Oc i_1,j \\Oc j_1,j \\Ps i_1', 'i \\Ps j,i \\Oc i_1,j \\Oc j_1,i \\Ps i_1'));
console.log('73 on iPsj,jPsi1', justify(flipped, via73));
