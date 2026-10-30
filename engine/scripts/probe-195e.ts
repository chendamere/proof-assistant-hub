/** Complete 195 path: reverse-release R(j_1), then clear j Ps i_1, reorder. */
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
const path: string[] = [];
function hop(nextRaw: string, label: string): boolean {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL', next === R ? 'GOAL' : '');
  if (!j) return false;
  if (next !== R) path.push(next);
  cur = next;
  return true;
}

hop(cur.replace('i_1 \\Os,j_1 \\Os', 'i_1 \\Os,R(j_1),j_1 \\Os'), '1 insert R(j_1)');

// flip j Ps i_1 → i_1 Ps j
hop(cur.replace('j \\Ps i_1', 'i_1 \\Ps j'), '2 flip');

// Try wrap/drop via empty Or Bb (as in book 1720)
{
  const wrapped = cur.replace(
    'i_1 \\Ps j,',
    '\\Bb{i_1 \\Ps j}{,}{,\\Or,},'
  );
  console.log('wrap try', justify(cur, ensure(wrapped)));
}

// Try drop i_1 Ps j when i Ps j present via identical?
console.log(
  'drop i1Psj',
  justify(cur, ensure(cur.replace(',i_1 \\Ps j,', ',')))
);

// identical-72: i Ps j, i_1 Ps j → ?
for (const r of allRules) {
  if (r.pos >= pos) continue;
  if (/identical-72|identical-7|def-identical/.test(r.id)) {
    console.log(r.id, r.leftSide.slice(0, 80), '=>', r.rightSide.slice(0, 80));
  }
}

// BFS from cur (after insert+flip) with swaps, drop i_1 Ps j, empty-bb collapse
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
      // drop this Ps
      const dr = items.slice();
      dr.splice(i, 1);
      out.push(joinItems(dr));
    }
  }
  // wrap Ps as empty Or Bb
  {
    const re = /([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(e))) {
      out.push(
        ensure(
          e.slice(0, m.index) +
            `\\Bb{${m[1]} \\Ps ${m[2]}}{,}{,\\Or,},` +
            e.slice(m.index + m[0].length)
        )
      );
    }
  }
  // collapse empty Or Bb
  {
    const next = e.replace(/\\Bb\{[^}]*\}\{,\}\{,\\Or,\},?/g, '');
    if (next !== e) out.push(ensure(next));
  }
  return out;
}

const start = cur;
type Node = { e: string; path: string[] };
const q: Node[] = [{ e: start, path: [] }];
const seen = new Set([L, start]);
const t0 = Date.now();
let found: string[] | null = null;
while (q.length && Date.now() - t0 < 30000) {
  const { e, path: p } = q.shift()!;
  if (p.length >= 8) continue;
  for (const cand of neighbors(e)) {
    if (seen.has(cand)) continue;
    if (!justify(e, cand)) continue;
    const np = [...p, cand];
    if (cand === R || justify(cand, R)) {
      found = cand === R ? np.slice(0, -1) : np;
      console.log('FOUND', found.length, justify(e, cand), cand === R ? 'exact' : 'almost');
      break;
    }
    seen.add(cand);
    q.push({ e: cand, path: np });
  }
  if (found) break;
}
console.log(found ? 'yes' : 'no', 'seen', seen.size, Date.now() - t0 + 'ms');
if (found) {
  let c = start;
  for (const m of found) {
    console.log(' ', justify(c, m), m.replace(/\s+/g, ' ').slice(0, 120));
    c = m;
  }
  console.log('→R', justify(c, R));
}
