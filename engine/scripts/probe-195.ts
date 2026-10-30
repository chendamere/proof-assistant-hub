/** Probe 195 s32: j Ps i_1 ↔ R(j_1) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const f = fs
  .readFileSync(path.join(__dirname, 'out/proof-step-failures.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes('::195::') && x.step === 32)!;

const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);

// Candidate rewrites
const cands: Array<[string, string]> = [];
// flip j Ps i_1
cands.push(['flip', L.replace('j \\Ps i_1', 'i_1 \\Ps j')]);
// drop j Ps i_1
cands.push(['dropPs', L.replace(',j \\Ps i_1,', ',')]);
// add R(j_1) after j Oc j_1
cands.push(['addR', L.replace('j \\Oc j_1,', 'j \\Oc j_1,R(j_1),')]);
// replace j Ps i_1 with R(j_1)
cands.push(['repl', L.replace('j \\Ps i_1', 'R(j_1)')]);
// bubble j Ps next to j Oc
{
  const items = topItems(L);
  const ji = items.indexOf('j \\Ps i_1');
  const oi = items.indexOf('j \\Oc j_1');
  console.log('idx Ps', ji, 'Oc', oi);
  if (ji > 0) {
    const sw = items.slice();
    [sw[ji - 1], sw[ji]] = [sw[ji]!, sw[ji - 1]!];
    cands.push(['bubbleLeft', joinItems(sw)]);
  }
}
// Via: j Oc j_1, j Ps i_1 → j Oc j_1, R(j_1), i_1 Ps j_1? or j Ps j_1?
cands.push([
  'oc+ps→R',
  L.replace('j \\Oc j_1,i_1 \\Ps j_1,j \\Ps i_1', 'j \\Oc j_1,R(j_1),i_1 \\Ps j_1'),
]);
cands.push([
  'oc+ps→R2',
  L.replace('j \\Oc j_1,i_1 \\Ps j_1,j \\Ps i_1,R(i_1)', 'j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1'),
]);
cands.push([
  'pathA',
  L.replace(
    'i_1 \\Ps j_1,j \\Ps i_1,R(i_1)',
    'R(i_1),R(j_1),i_1 \\Ps j_1'
  ),
]);

for (const [label, raw] of cands) {
  const e = ensure(raw);
  console.log(label, justify(L, e), e === R ? 'IS_GOAL' : '');
}

// BFS shallow: adjacent swaps + flip Ps + drop/add R
type Node = { e: string; path: string[] };
const q: Node[] = [{ e: L, path: [] }];
const seen = new Set([L]);
let found: string[] | null = null;
const t0 = Date.now();
while (q.length && Date.now() - t0 < 20000) {
  const { e, path } = q.shift()!;
  if (path.length >= 6) continue;
  const items = topItems(e);
  const local: string[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    local.push(joinItems(sw));
  }
  for (let i = 0; i < items.length; i++) {
    const pm = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
    if (pm) {
      const fl = items.slice();
      fl[i] = `${pm[2]} \\Ps ${pm[1]}`;
      local.push(joinItems(fl));
    }
  }
  // try introducing R(j_1) next to j Oc j_1
  if (e.includes('j \\Oc j_1') && !e.includes('R(j_1)')) {
    local.push(ensure(e.replace('j \\Oc j_1,', 'j \\Oc j_1,R(j_1),')));
  }
  // try dropping j Ps i_1
  if (e.includes('j \\Ps i_1')) {
    local.push(ensure(e.replace(',j \\Ps i_1,', ',')));
    local.push(ensure(e.replace('j \\Ps i_1,', 'R(j_1),')));
  }
  // try drop i_1 Ps j_1 dup paths
  for (const cand of local) {
    if (seen.has(cand)) continue;
    if (!justify(e, cand)) continue;
    const np = [...path, cand];
    if (cand === R || justify(cand, R)) {
      found = justify(cand, R) && cand !== R ? np : np.slice(0, -1);
      console.log('FOUND', found.length, 'last', justify(e, cand));
      break;
    }
    seen.add(cand);
    q.push({ e: cand, path: np });
  }
  if (found) break;
}
console.log('bfs', found ? `yes +${found.length}` : 'no', 'seen', seen.size, Date.now() - t0 + 'ms');
