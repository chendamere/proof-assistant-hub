/** Step-by-step 195 with identical-73. */
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

const L = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, i_1 \\Ps j_1, j \\Ps i_1, R(i_1), i_1 \\Os, j_1 \\Os,'
);
const R = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, R(i_1), R(j_1), i_1 \\Ps j_1, i_1 \\Os, j_1 \\Os,'
);

let cur = L;
const mids: string[] = [];
function hop(nextRaw: string, label: string) {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL');
  if (!j) {
    console.log(' from', cur);
    console.log(' to  ', next);
    throw new Error(label);
  }
  if (next !== R) mids.push(next);
  cur = next;
  console.log('   ', topItems(cur).join(' | '));
}

hop(cur.replace('i_1 \\Os,j_1 \\Os', 'i_1 \\Os,R(j_1),j_1 \\Os'), '1 rev-release');
hop(cur.replace('j \\Oc j_1,', 'j \\Oc j_1,j \\Ps j_1,'), '2 copy-identical');
hop(cur.replace('j \\Ps i_1', 'i_1 \\Ps j'), '3 flip');
// Now: j Ps j_1, i_1 Ps j_1, i_1 Ps j
// Bubble i_1 Ps j left next to j Ps j_1: want j Ps j_1, i_1 Ps j, i_1 Ps j_1
hop(cur.replace('j \\Ps j_1,i_1 \\Ps j_1,i_1 \\Ps j', 'j \\Ps j_1,i_1 \\Ps j,i_1 \\Ps j_1'), '4 bubble');
// identical-73: j Ps j_1, i_1 Ps j → wait, 73 is i Ps j, j Ps m → i Ps j, i Ps m
// So need i_1 Ps j, j Ps j_1 (order: i_1 Ps j BEFORE j Ps j_1)
hop(cur.replace('j \\Ps j_1,i_1 \\Ps j', 'i_1 \\Ps j,j \\Ps j_1'), '5 swap for 73');
// Now: i_1 Ps j, j Ps j_1, i_1 Ps j_1
// Apply 73: i_1 Ps j, j Ps j_1 → i_1 Ps j, i_1 Ps j_1
hop(cur.replace('i_1 \\Ps j,j \\Ps j_1', 'i_1 \\Ps j,i_1 \\Ps j_1'), '6 identical-73');
// Now: i_1 Ps j, i_1 Ps j_1, i_1 Ps j_1
console.log('after 73', topItems(cur));

// Drop i_1 Ps j somehow - wrap+? Or flip to j Ps i_1 and ... 
// We still have i_1 Ps j to eliminate. Use def-identical reverse after making it useless?
// Drop one duplicate i_1 Ps j_1 first via adjacent same?
{
  const items = topItems(cur);
  const i = items.indexOf('i_1 \\Ps j_1');
  if (i >= 0 && items[i + 1] === 'i_1 \\Ps j_1') {
    const dr = items.slice();
    dr.splice(i, 1);
    hop(joinItems(dr), '7 drop dup i1Psj1');
  } else {
    console.log('no adjacent dup', items);
  }
}

// Drop i_1 Ps j: try reverse of something. Flip to j Ps i_1, then?
hop(cur.replace('i_1 \\Ps j', 'j \\Ps i_1'), '8 flip back');
// Drop j Ps i_1 - still stuck?

// Alternative after 73: drop i_1 Ps j via... having i Ps j and i_1 related?
console.log('cur→R', justify(cur, R));

// Try drop i_1 Ps j directly
console.log('drop i1Psj', justify(cur, ensure(cur.replace(',i_1 \\Ps j,', ','))));
console.log('drop jPsi1', justify(cur, ensure(cur.replace(',j \\Ps i_1,', ','))));

// r-27 reverse: need X Ps Y, R(X), R(Y), X Ps Y → drop one
// Bubble to get i_1 Ps j_1, R(i_1), R(j_1), i_1 Ps j_1
{
  const items = topItems(cur);
  console.log('items now', items);
}
