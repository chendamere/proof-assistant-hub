/**
 * Can we justify thm24 step5 expand when using goal's fresh names m_1,n_1?
 */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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
function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  const axiomIds = new Set(axioms.map((r) => r.id));
  const definitionIds = new Set(definitions.map((r) => r.id));
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}
function ensure(s: string) {
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const rule = theorems.find((r) => r.id === 'rules-of-node-connectivity-0-lbificj')!;
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
// Prefer latest fail for thm24 with Bb m Pc n pattern
const candidates = fails.filter(
  (f: { key: string; left: string }) =>
    f.key.includes('::24::') && /\\Bb\{m \\Pc n\}/.test(f.left) && /m \\Oc m_1/.test(f.right)
);
const f = candidates[0] ?? fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 5);
console.log('using step', f.step, 'key thm', f.key.split('::')[1]);
const L = ensure(f.left);
const R = ensure(f.right);

// Manual mid: expand TOP arm only with m_1,n_1
const midTop =
  ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,m \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,}{,i_1 \\Os,j_1 \\Os,\\Tc c_4,},},';
const midBoth = R; // full goal

const pos = 13 * 100000 + 24;
const allRules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: getPositionForRule(r) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(allRules, new Map());

function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const r of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, r.leftSide, r.rightSide, { dagCache: index.dagCache }).match) return r.id;
  }
  // also try connectivity-0 directly
  if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
    return rule.id + '(direct)';
  }
  return null;
}

console.log('L→midTop', justify(L, midTop));
console.log('midTop→R', justify(midTop, R));
console.log('L→R', justify(L, R));

// What does oneStepRewrites actually produce?
const rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
console.log('rewrite count', rewrites.length);
for (const raw of rewrites.slice(0, 6)) {
  const e = ensure(raw);
  const ok = checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match;
  console.log(ok ? 'OK' : 'no', e.slice(0, 180));
}
