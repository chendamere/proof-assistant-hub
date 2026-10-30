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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
console.log('indexing…');
const bigIndex = buildRuleIndex(
  allRules.filter((r) => r.pos < 14 * 100000),
  dag
);
console.log('ready');

function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  const rules = allRules.filter((r) => r.pos < pos);
  const index = buildRuleIndex(rules, dag);
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

function get(thm: number, step: number) {
  return fails.find((x) => x.key.includes(`::${thm}::`) && x.step === step)!;
}

// --- 100 s101: drop Or-empty Bb ---
{
  const f = get(100, 101);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const pos = 13 * 100000 + 100;
  console.log('\n100 s101 direct', justify(L, R, pos));
  const mid = L.replace(/\\Bb\{j_2 \\Ps j_1\}\{,\}\{,\\Or,\},/, '');
  console.log('drop Or-Bb', mid !== L, justify(L, mid, pos));
  console.log('mid→R', justify(mid, R, pos));
  // reorder Os in remaining Bb after drop?
  console.log('L len', L.length, 'mid', mid.length, 'R', R.length);
}

// --- 124 s144: drop Pu/nPu ---
{
  const f = get(124, 144);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const pos = 13 * 100000 + 124;
  console.log('\n124 s144 direct', justify(L, R, pos));
  let cur = L;
  // drop i Pu inside first arm (after cond)
  const mids: string[] = [];
  const tryDrop = (re: RegExp, label: string) => {
    const next = cur.replace(re, ',');
    if (next === cur) {
      console.log(label, 'no change');
      return;
    }
    const id = justify(cur, ensure(next), pos);
    console.log(label, id);
    if (id) {
      cur = ensure(next);
      mids.push(cur);
    }
  };
  tryDrop(/,i \\Pu,/, 'drop i Pu');
  tryDrop(/,i \\nPu,/, 'drop i nPu');
  console.log('after drops ==R?', cur === R, justify(cur, R, pos));
  // try oneStep on flag/null rules
  const flagRules = allRules.filter((r) => r.pos < pos && /flag|null-comparison|Pu|nPu|identical-node-comparison-79|empty-branch-2/.test(r.id));
  let hits = 0;
  for (const rule of flagRules.slice(0, 40)) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: bigIndex.dagCache }).match)
        continue;
      if (!e.includes('i \\Pu') || !e.includes('i \\nPu') || e.length < L.length) {
        console.log('144 rw', rule.id, e.slice(0, 120));
        hits++;
        if (hits > 6) break;
      }
    }
    if (hits > 6) break;
  }
}

// --- 124 s34: flip+reorder in Pu arm ---
{
  const f = get(124, 34);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const pos = 13 * 100000 + 124;
  console.log('\n124 s34 direct', justify(L, R, pos));
  // L arm has i_1 Ps i, i_1 Pu → R has i_1 Pu, i Ps i_1
  const flip = L.replace('i_1 \\Ps i, i_1 \\Pu', 'i \\Ps i_1, i_1 \\Pu');
  console.log('flip Ps', justify(L, ensure(flip), pos));
  const flip2 = L.replace('i_1 \\Ps i,', 'i \\Ps i_1,');
  console.log('flip Ps only', justify(L, ensure(flip2), pos));
  const reord = ensure(flip2).replace('i \\Ps i_1, i_1 \\Pu', 'i_1 \\Pu, i \\Ps i_1');
  console.log('then reorder', justify(ensure(flip2), reord, pos), '==R?', reord === R);
}

// --- 124 s181 ---
{
  const f = get(124, 181);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const pos = 13 * 100000 + 124;
  console.log('\n124 s181 direct', justify(L, R, pos));
  // Try empty-branch-1 style pull with Bb
  const rules = allRules.filter((r) => r.pos < pos && /empty-branch|equiv-code-dist|identical-node-comparison-1/.test(r.id));
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: bigIndex.dagCache }).match)
        continue;
      console.log('181', rule.id, '→', e.slice(0, 140));
    }
  }
  // syntactic collapse then justify
  const collapsed = L.replace(/\\Bb\{i \\Pu\}\{,j \\Oc j_1,\}\{,j \\Oc j_1,\},/, 'j \\Oc j_1,');
  console.log('collapse', justify(L, ensure(collapsed), pos));
  console.log('collapsed→R', justify(ensure(collapsed), R, pos), ensure(collapsed) === R);
}

// --- 100 s59 path with dup ---
{
  const f = get(100, 59);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const pos = 13 * 100000 + 100;
  console.log('\n100 s59 direct', justify(L, R, pos));
  const drop = L.replace('j_1 \\Ps j_2, j_1 \\Ps j_2,', 'j_1 \\Ps j_2,');
  console.log('drop dup', justify(L, ensure(drop), pos));
  const addTrail = ensure(drop).replace(
    'j_1 \\Ps j_2, R(j_1), R(j_2),',
    'j_1 \\Ps j_2, R(j_1), R(j_2), j_1 \\Ps j_2,'
  );
  console.log('r27', justify(ensure(drop), addTrail, pos));
  const swapR = addTrail.replace('R(j_1), R(j_2)', 'R(j_2), R(j_1)');
  console.log('swapR', justify(addTrail, ensure(swapR), pos));
  // goal has R(j_2), R(j_1), j_1 Ps j_2 — so from addTrail after swap: Ps, R(j_2), R(j_1), Ps
  // need drop leading
  const dropLead = ensure(swapR).replace('j_1 \\Ps j_2, R(j_2), R(j_1), j_1 \\Ps j_2,', 'R(j_2), R(j_1), j_1 \\Ps j_2,');
  console.log('dropLead', justify(ensure(swapR), dropLead, pos), dropLead === R || justify(dropLead, R, pos));
}
