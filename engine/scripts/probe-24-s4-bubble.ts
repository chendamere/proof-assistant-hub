/** After pulling both R via r-17, can we bubble to goal? */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';

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
  let t = normalizeSpacing(fromOperatorFirst(s).replace(/R_\(/g, 'R\\_(').replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')).trim();
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({ ...r, pos: posOf(r.id) }));
const pos = 13 * 100000 + 24;
const prior = allRules.filter((r) => r.pos < pos);
const index = buildRuleIndex(prior, new Map());
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (/error-code|equiv-code|identical-4/.test(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs.readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8').trim().split(/\n/).map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 4);
let cur = ensure(stripDisplayIfConditions(f.left));
const goal = ensure(stripDisplayIfConditions(f.right));
const r17 = prior.find((r) => r.id.includes('recursive-function-r-17'))!;

for (let i = 0; i < 2; i++) {
  const rw = oneStepRewrites(cur, r17.leftSide, r17.rightSide);
  const next = rw.map(ensure).find((e) => e !== cur && checkInferenceRules(cur, e, r17.leftSide, r17.rightSide).match);
  console.log('pull', i, !!next);
  if (!next) break;
  cur = next;
  console.log(cur.slice(0, 200));
}
console.log('\nafter pulls vs goal');
console.log('cur items', topItems(cur).map((x) => x.slice(0, 40)));
console.log('goal items', topItems(goal).map((x) => x.slice(0, 40)));
console.log('direct', justify(cur, goal));

// try adjacent swaps
const items = topItems(cur);
for (let i = 0; i < items.length - 1; i++) {
  const sw = items.slice();
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  const e = ensure(',' + sw.join(',') + ',');
  const id = justify(cur, e);
  if (id) console.log('swap', i, id, sw.map((x) => x.slice(0, 20)).join(' | '));
}
