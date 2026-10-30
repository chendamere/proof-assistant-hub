/**
 * Find a rule that changes Blb{i Ps j_1} → Blb{i Ps j} with j Ps j_1 present.
 */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function dist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const f = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .find((x) => x.key.includes('::197::') && /\\\\Blb\{i \\\\Ps j_1\}/.test(x.left));
if (!f) {
  // fallback: construct from known fail
  console.log('using constructed');
}
const L = ensure(
  f?.left ??
    ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const R = ensure(
  f?.right ??
    ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('L', L);
console.log('R', R);
console.log('direct?', checkInferenceRules(L, R, L, R).match);
const pos = 13 * 100000 + 197;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const startD = dist(L, R);
let best: { id: string; d: number; e: string } | null = null;
let hits = 0;
for (const rule of rules) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (e === L) continue;
    const d = dist(e, R);
    if (d >= startD && e !== R) continue;
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide).match) continue;
    hits++;
    if (!best || d < best.d || e === R) {
      best = { id: rule.id, d, e };
      console.log('better', rule.id, d, e.slice(0, 140));
    }
    if (e === R) {
      console.log('GOAL', rule.id);
      process.exit(0);
    }
  }
}
console.log('hits', hits, 'best', best?.id, best?.d);
