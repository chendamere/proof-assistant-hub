import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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

const pos = 13 * 100000 + 124;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  dag
);
function just(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::124::') && x.step === 181)!;
const L = ensure(f.left);
const R = ensure(f.right);

const rule9 = allRules.find((r) => r.id.includes('null-comparison-9'))!;
console.log('rule9', rule9.leftSide, '⟺', rule9.rightSide);
const rw = oneStepRewrites(L, rule9.leftSide, rule9.rightSide);
for (const raw of rw) {
  const e = ensure(raw);
  if (!checkInferenceRules(L, e, rule9.leftSide, rule9.rightSide, { dagCache: index.dagCache }).match)
    continue;
  console.log('mid1', e);
  console.log('just', just(L, e));

  // drop empty Bb{i Pu}{,}{,}
  const dropCandidates = [
    e.replace('\\Bb{i \\Pu}{,}{,},', ''),
    e.replace(',\\Bb{i \\Pu}{,}{,},', ','),
  ];
  for (const d of dropCandidates) {
    const ed = ensure(d);
    console.log('drop empty?', just(e, ed), ed);
    if (just(e, ed)) {
      console.log('→R?', ed === R, just(ed, R));
      // bubble j Oc past i On if needed
      let cur = ed;
      if (cur !== R) {
        const swapped = ensure(cur.replace('i \\On, i \\Oc i_2, j \\Oc j_1,', 'i \\On, i \\Oc i_2, j \\Oc j_1,'.replace(
          'i \\On,i \\Oc i_2,j \\Oc j_1',
          'i \\On,i \\Oc i_2,j \\Oc j_1'
        )));
        // R is: i On, i Oc i_2, j Oc j_1, R(i_2), ...
        // ed might be: j Oc j_1, i On, i Oc i_2, ...
        const s1 = ensure(cur.replace(/^,j \\Oc j_1,i \\On,/, ',i \\On,j \\Oc j_1,'));
        console.log('swap jOc with iOn', just(cur, s1), s1);
        if (just(cur, s1)) cur = s1;
        const s2 = ensure(cur.replace(',j \\Oc j_1,i \\Oc i_2,', ',i \\Oc i_2,j \\Oc j_1,'));
        console.log('swap jOc with iOc', just(cur, s2), s2 === R, just(s2, R));
      }
    }
  }

  // try oneStep to drop empty Bb
  for (const rule of allRules.filter((r) => r.pos < pos && /empty-branch|null-comparison|thm-empty|def-null|create-branch|flag/.test(r.id))) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(e, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const r2 of rewrites) {
      const e2 = ensure(r2);
      if (!checkInferenceRules(e, e2, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      if (!(e2.includes('\\Bb{i \\Pu}') || e2 === R || e2.length < e.length)) continue;
      console.log('from mid1', rule.id, e2.slice(0, 140), e2 === R ? 'GOAL' : '');
    }
  }
}
