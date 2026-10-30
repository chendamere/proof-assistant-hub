/** Continue 195: after copy-identical adds j Ps j_1, reach R(j_1). */
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

const L0 = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, i_1 \\Ps j_1, j \\Ps i_1, R(i_1), i_1 \\Os, j_1 \\Os,'
);
const R = ensure(
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, R(i_1), R(j_1), i_1 \\Ps j_1, i_1 \\Os, j_1 \\Os,'
);

// Step1: copy-identical add j Ps j_1
const s1 = ensure(
  L0.replace('j \\Oc j_1,i_1 \\Ps j_1,j \\Ps i_1', 'j \\Oc j_1,j \\Ps j_1,i_1 \\Ps j_1,j \\Ps i_1')
);
console.log('s1', justify(L0, s1));

// Look at copy-identical rule
for (const r of allRules) {
  if (r.id.includes('copy-identical') || r.id.includes('create-copy') || r.id.includes('identical')) {
    if (/\\Ps/.test(r.leftSide + r.rightSide) && r.pos < pos) {
      // skip noise
    }
  }
}
const ci = allRules.filter((r) => r.id.includes('copy-identical') && r.pos < pos);
for (const r of ci.slice(0, 10)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}

// BFS from s1 with: swaps, flip Ps, drop j Ps j_1, drop j Ps i_1, add R(j_1) near j Ps j_1
type Node = { e: string; path: string[] };
const q: Node[] = [{ e: s1, path: [s1] }];
const seen = new Set([L0, s1]);
const t0 = Date.now();
let found: string[] | null = null;

function neighbors(e: string): string[] {
  const out: string[] = [];
  const items = topItems(e);
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    out.push(joinItems(sw));
  }
  for (let i = 0; i < items.length; i++) {
    const pm = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
    if (pm) {
      const fl = items.slice();
      fl[i] = `${pm[2]} \\Ps ${pm[1]}`;
      out.push(joinItems(fl));
    }
  }
  // drop a Ps that goal lacks
  for (let i = 0; i < items.length; i++) {
    if (!/ \\Ps /.test(items[i]!)) continue;
    if (topItems(R).includes(items[i]!)) continue;
    const dr = items.slice();
    dr.splice(i, 1);
    out.push(joinItems(dr));
  }
  // dup Ps via r-27 pattern: X Ps Y, R(X), R(Y) → add X Ps Y
  // add R(j_1) if j Ps j_1 present (hypothesis)
  if (e.includes('j \\Ps j_1') && !e.includes('R(j_1)')) {
    out.push(ensure(e.replace('j \\Ps j_1,', 'j \\Ps j_1,R(j_1),')));
    out.push(ensure(e.replace('j \\Ps j_1,', 'R(j_1),')));
  }
  // drop j Ps j_1 if R(j_1) present
  if (e.includes('R(j_1)') && e.includes('j \\Ps j_1')) {
    out.push(ensure(e.replace(',j \\Ps j_1,', ',')));
  }
  return out;
}

while (q.length && Date.now() - t0 < 45000) {
  const { e, path } = q.shift()!;
  if (path.length > 10) continue;
  for (const cand of neighbors(e)) {
    if (seen.has(cand)) continue;
    const rule = justify(e, cand);
    if (!rule) continue;
    const np = [...path, cand];
    if (cand === R) {
      found = np.slice(0, -1); // mids exclude goal
      console.log('FOUND exact', np.length - 1, 'via', rule);
      break;
    }
    if (justify(cand, R)) {
      found = np; // last mid, then direct to R
      console.log('FOUND almost', np.length, 'via', rule, 'then', justify(cand, R));
      break;
    }
    seen.add(cand);
    q.push({ e: cand, path: np });
  }
  if (found) break;
}
console.log(found ? `chain +${found.length}` : 'no', 'seen', seen.size, Date.now() - t0 + 'ms');
if (found) {
  let cur = L0;
  for (const m of found) {
    console.log(' ', justify(cur, m), '→', m.replace(/\s+/g, ' ').slice(0, 110));
    cur = m;
  }
  console.log(' final', justify(cur, R));
}
