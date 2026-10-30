import fs from 'fs';
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
function ensure(s: string) {
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  ).trim();
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

const pos = 13 * 100000 + 100;
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < pos),
  new Map()
);
function just(a: string, b: string) {
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (rule.id.includes('equiv-code')) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::100::') && x.step === 38)!;
const L = ensure(f.left);
const R = ensure(f.right);
const a = topItems(L);
// path: bubble Ps left past R(i_2), then past R(i_1), then swap R's
const iPs = a.findIndex((x) => x === 'i_1 \\Ps i_2');
const s1 = a.slice();
[s1[iPs - 1], s1[iPs]] = [s1[iPs]!, s1[iPs - 1]!];
console.log('step1', just(joinItems(a), joinItems(s1)));
const iPs2 = s1.findIndex((x) => x === 'i_1 \\Ps i_2');
const s2 = s1.slice();
[s2[iPs2 - 1], s2[iPs2]] = [s2[iPs2]!, s2[iPs2 - 1]!];
console.log('step2', just(joinItems(s1), joinItems(s2)));
const iR1 = s2.findIndex((x) => x === 'R(i_1)');
const iR2 = s2.findIndex((x) => x === 'R(i_2)');
const s3 = s2.slice();
if (iR1 + 1 === iR2) {
  [s3[iR1], s3[iR2]] = [s3[iR2]!, s3[iR1]!];
}
console.log('step3', just(joinItems(s2), joinItems(s3)));
console.log('==R', joinItems(s3) === R);

// 34
const f34 = fails.find((x) => x.key.includes('::124::') && x.step === 34)!;
const L34 = ensure(f34.left);
const R34 = ensure(f34.right);
const flip = ensure(L34.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
const reord = ensure(flip.replace('i \\Ps i_1,i_1 \\Pu,', 'i_1 \\Pu,i \\Ps i_1,'));
console.log('\n34 flip', just(L34, flip));
console.log('34 reord', just(flip, reord), reord === R34);
