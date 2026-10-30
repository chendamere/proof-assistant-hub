/** Deep probe for non-reorder fails: 108 s345, 195 s32, 197 s86, 202 s67 */
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
import { armFactorStep, oneSiteToward, oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
function indexBefore(pos: number) {
  return buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const want = new Set(['108:345', '195:32', '197:86', '202:67']);
const fails = fs
  .readFileSync(path.join(__dirname, 'out/proof-step-failures.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

for (const f of fails) {
  const thm = f.key.split('::')[1];
  const key = `${thm}:${f.step}`;
  if (!want.has(key)) continue;
  const pos = 13 * 100000 + parseInt(thm, 10);
  console.log('\n====', key, '====');
  console.log('L items:', topItems(f.left));
  console.log('R items:', topItems(f.right));
  console.log('direct', justify(f.left, f.right, pos));

  const index = indexBefore(pos);
  const rules = allRules.filter((r) => r.pos < pos);

  // oneStepRewrites / armFactor / oneSite
  const t0 = Date.now();
  try {
    const steps = oneStepRewrites(ensure(f.left), rules, index.dagCache, { max: 40 });
    console.log('oneStep', steps?.length ?? 0, Date.now() - t0 + 'ms');
    for (const s of (steps ?? []).slice(0, 8)) {
      console.log('  →', s.ruleId, ensure(s.expr).slice(0, 120));
    }
  } catch (e) {
    console.log('oneStep err', e);
  }
  try {
    const af = armFactorStep(ensure(f.left), ensure(f.right), rules, index.dagCache);
    console.log('armFactor', af);
  } catch (e) {
    console.log('armFactor err', (e as Error).message);
  }
  try {
    const os = oneSiteToward(ensure(f.left), ensure(f.right), rules, index.dagCache);
    console.log('oneSite', os && { rule: os.ruleId, expr: ensure(os.expr).slice(0, 120) });
  } catch (e) {
    console.log('oneSite err', (e as Error).message);
  }

  // Manual candidates for 195: j Ps i_1 → R(j_1)
  if (key === '195:32') {
    let cur = ensure(f.left);
    const cands = [
      cur.replace('j \\Ps i_1,', 'R(j_1),'),
      cur.replace(',j \\Ps i_1,', ',R(j_1),'),
      cur.replace('j \\Ps i_1', 'R(j_1)'),
    ];
    for (const c of cands) {
      console.log('try replace', justify(cur, c, pos), ensure(c) === ensure(f.right));
    }
  }
  if (key === '202:67') {
    // drop j Oc j_2 from both arms
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('L', L);
    console.log('R', R);
  }
  if (key === '197:86') {
    console.log('L', ensure(f.left));
    console.log('R', ensure(f.right));
  }
  if (key === '108:345') {
    console.log('L', ensure(f.left));
    console.log('R', ensure(f.right));
  }
}
