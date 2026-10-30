/** 195: reverse-release → copy-identical → flip → identical-72 → r-27-rev → reorder */
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

// Find identical-72
for (const r of allRules) {
  if (r.pos < pos && /identical.*72|72.*identical|identical-node-comparison-.*72/.test(r.id)) {
    console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
  }
}
for (const r of allRules) {
  if (r.pos < pos && /72/.test(r.id) && /identical|Ps/.test(r.id + r.leftSide)) {
    console.log('72?', r.id, r.leftSide.slice(0, 100));
  }
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
    console.log('  from', cur);
    console.log('  to  ', next);
    throw new Error(label);
  }
  if (next !== R) mids.push(next);
  cur = next;
}

hop(cur.replace('i_1 \\Os,j_1 \\Os', 'i_1 \\Os,R(j_1),j_1 \\Os'), '1 rev-release R(j_1)');
hop(cur.replace('j \\Oc j_1,', 'j \\Oc j_1,j \\Ps j_1,'), '2 copy-identical j Ps j_1');
hop(cur.replace('j \\Ps i_1', 'i_1 \\Ps j'), '3 flip to i_1 Ps j');

// identical-72: typically i Ps j, j Ps k ↔ i Ps k, j Ps k or similar
// Try rewrite i_1 Ps j → i_1 Ps j_1 given j Ps j_1
{
  const next = ensure(cur.replace('i_1 \\Ps j,', 'i_1 \\Ps j_1,'));
  console.log('4a rewrite i1Psj→i1Psj1', justify(cur, next));
}
{
  // Need both j Ps j_1 and i_1 Ps j adjacent for 72
  console.log('cur items', topItems(cur));
}

// Try: after having i_1 Ps j and j Ps j_1, apply 72 to get i_1 Ps j_1
hop(
  (() => {
    // bubble i_1 Ps j next to j Ps j_1 if needed - currently:
    // i Ps j, i Oc i_1, j Oc j_1, j Ps j_1, i_1 Ps j_1, i_1 Ps j, R(i_1), i_1 Os, R(j_1), j_1 Os
    return cur;
  })(),
  'noop check'
);

// Manual: replace i_1 Ps j with i_1 Ps j_1 using 72 (may need j Ps j_1 present)
{
  const try72 = ensure(cur.replace(',i_1 \\Ps j,', ',i_1 \\Ps j_1,'));
  console.log('72 replace', justify(cur, try72));
}

// Show theorems of identical with 3 variables
for (const r of allRules) {
  if (r.pos >= pos) continue;
  if (!/identical-node-comparison/.test(r.id)) continue;
  const vars = new Set((r.leftSide + r.rightSide).match(/\b[ijk]\b/g) || []);
  if (/\\Ps/.test(r.leftSide) && (r.leftSide.match(/\\Ps/g) || []).length >= 2) {
    console.log(r.id);
    console.log(' L', r.leftSide);
    console.log(' R', r.rightSide);
  }
}
