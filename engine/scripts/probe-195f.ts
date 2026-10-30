/** 195 path using def-identical-prop wrap then Or-collapse. */
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

// Show empty-branch / Or rules
for (const r of allRules) {
  if (r.pos >= pos) continue;
  if (/empty-branch|\\\\Or|Or,/.test(r.id + r.leftSide + r.rightSide)) {
    if (/\\Or/.test(r.leftSide + r.rightSide) && /\\Bb|\\Blb/.test(r.leftSide + r.rightSide)) {
      console.log(r.id);
      console.log(' L', r.leftSide);
      console.log(' R', r.rightSide);
    }
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
  if (!j) throw new Error(label);
  if (next !== R) mids.push(next);
  cur = next;
}

hop(cur.replace('i_1 \\Os,j_1 \\Os', 'i_1 \\Os,R(j_1),j_1 \\Os'), 'insert R');
hop(cur.replace('j \\Ps i_1', 'i_1 \\Ps j'), 'flip');
hop(cur.replace('i_1 \\Ps j,', '\\Bb{i_1 \\Ps j}{,}{,\\Or,},'), 'wrap identical-prop');

// Try collapsing empty Or Bb to nothing
{
  const collapsed = ensure(cur.replace(/\\Bb\{i_1 \\Ps j\}\{,\}\{,\\Or,\},/, ''));
  console.log('collapse empty Or', justify(cur, collapsed));
  if (justify(cur, collapsed)) {
    mids.push(collapsed);
    cur = collapsed;
  }
}

console.log('cur', cur);
console.log('→R?', justify(cur, R));

// bubble sort to R
const goalItems = topItems(R);
for (let step = 0; step < 20 && cur !== R; step++) {
  if (justify(cur, R)) {
    console.log('direct to R at step', step);
    break;
  }
  const items = topItems(cur);
  let best: { e: string; d: number } | null = null;
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    const e = joinItems(sw);
    if (!justify(cur, e)) continue;
    let d = 0;
    for (let k = 0; k < sw.length; k++) {
      const gi = goalItems.indexOf(sw[k]!);
      d += gi < 0 ? 10 : Math.abs(k - gi);
    }
    if (!best || d < best.d) best = { e, d };
  }
  if (!best) {
    console.log('stuck bubble', topItems(cur));
    break;
  }
  console.log('bubble', justify(cur, best.e), 'd', best.d);
  mids.push(best.e);
  cur = best.e;
}
console.log('done', cur === R || !!justify(cur, R), 'mids', mids.length);
if (cur === R || justify(cur, R)) {
  const out = cur === R ? mids : mids; // keep all; last may equal R
  const final = out.filter((x, i) => ensure(x) !== R || i < out.length);
  console.log(
    'CHAIN',
    JSON.stringify(final.filter((x) => ensure(x) !== R).map((x) => ensure(x).slice(0, 60)))
  );
}
