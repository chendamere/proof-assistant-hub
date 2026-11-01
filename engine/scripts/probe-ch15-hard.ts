import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';

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
  'Rules_of_Node_Continuity',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(id) || definitionIds.has(id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const cache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = cache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  cache.set(pos, i);
  return i;
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const focus = process.argv[2]; // e.g. 306

for (const f of fails) {
  const thm = f.key.split('::')[1];
  if (focus && thm !== focus) continue;
  const pos = keyPos(f.key);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log(`\n==== ${thm} s${f.step} ====`);
  console.log('direct', justify(L, R, pos));

  // Try create-next-prev / create-copy / release-next / continuity / identical-73 / Pc rules
  const ids = [
    'create-next-prev',
    'create-copy',
    'release-next',
    'copy-identical',
    'rules-of-operators-9-ipisi',
    'theorems-of-operators-and-relationships-14-ipjp',
    'theorems-of-identical-node-comparison-12-mcnlbif',
    'theorems-of-identical-node-comparison-15-mslbifi',
    'theorems-of-identical-node-comparison-18-bifisj',
    'theorems-of-identical-node-comparison-73-isjjsm',
    'theorems-of-identical-node-comparison-70-isjisj',
    'rules-of-node-continuity-0-lbifinj',
    'rules-of-node-continuity-8-lbifinj',
  ];
  // also any Pc subst
  const pcRules = allRules.filter(
    (r) => r.pos < pos && /\\Pc/.test(r.leftSide + r.rightSide) && /\\Ps/.test(r.leftSide + r.rightSide)
  );
  console.log(
    'Pc+Ps rules',
    pcRules.slice(0, 12).map((r) => r.id)
  );

  let hits = 0;
  for (const id of [...ids, ...pcRules.slice(0, 20).map((r) => r.id)]) {
    const rule = allRules.find((r) => r.id === id);
    if (!rule || rule.pos >= pos) continue;
    for (const [a, b] of [
      [rule.leftSide, rule.rightSide],
      [rule.rightSide, rule.leftSide],
    ] as const) {
      let rws: string[];
      try {
        rws = oneStepRewrites(L, a, b);
      } catch {
        continue;
      }
      for (const raw of rws) {
        const e = ensure(raw);
        if (!checkInferenceRules(L, e, a, b, { dagCache: indexBefore(pos).dagCache }).match) continue;
        const closer =
          Math.abs(e.length - R.length) < Math.abs(L.length - R.length) ||
          e.includes('\\Pn') !== L.includes('\\Pn') ||
          (R.includes('\\Op') && e.includes('\\Op') && !L.includes('\\Op'));
        if (e === R || closer || (R.includes('\\Pc j') && e.includes('\\Pc j'))) {
          console.log(`  ${id} (${a === rule.leftSide ? 'fwd' : 'rev'}) → ${e.slice(0, 140)}`);
          hits++;
          if (hits > 12) break;
        }
      }
      if (hits > 12) break;
    }
    if (hits > 12) break;
  }
  if (hits === 0) console.log('  no hits');
}
