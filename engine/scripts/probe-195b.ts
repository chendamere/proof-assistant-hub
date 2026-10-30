/** Justify consecutive steps in thm 195 around the fail. */
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

const steps = [
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, j \\Ps i_1, i_1 \\Ps j_1, R(i_1), i_1 \\Os, j_1 \\Os,', // 1724
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, i_1 \\Ps j_1, j \\Ps i_1, R(i_1), i_1 \\Os, j_1 \\Os,', // 1725 fail L
  ', i \\Ps j, i \\Oc i_1, j \\Oc j_1, R(i_1), R(j_1), i_1 \\Ps j_1, i_1 \\Os, j_1 \\Os,', // 1726 fail R
];

console.log('1724→1725', justify(steps[0]!, steps[1]!));
console.log('1725→1726', justify(steps[1]!, steps[2]!));

// Try path via adding j Ps j_1 then using known patterns
const L = ensure(steps[1]!);
const R = ensure(steps[2]!);

const mids = [
  L.replace('j \\Oc j_1,i_1 \\Ps j_1,j \\Ps i_1', 'j \\Oc j_1,j \\Ps j_1,i_1 \\Ps j_1,j \\Ps i_1'),
  L.replace('j \\Oc j_1,i_1 \\Ps j_1,j \\Ps i_1,R(i_1)', 'j \\Oc j_1,j \\Ps j_1,i_1 \\Ps j_1,j \\Ps i_1,R(i_1)'),
  L.replace('j \\Ps i_1,R(i_1)', 'j \\Ps i_1,R(i_1),R(j_1)'),
  L.replace('j \\Oc j_1,', 'j \\Oc j_1,R(j_1),'),
  // via r-27 reverse style: have i_1 Ps j_1, R(i_1) and want R(j_1)
  // Try: i_1 Ps j_1, j Ps i_1, R(i_1) → i_1 Ps j_1, R(i_1), R(j_1) somehow
];

for (const m of mids) {
  const e = ensure(m);
  console.log('cand', justify(L, e), '→R', justify(e, R), e.slice(0, 100));
}

// Search rules that match substring patterns involving Ps and R intro
let shown = 0;
for (const r of allRules) {
  if (r.pos >= pos) continue;
  const Lhas = /\\Ps/.test(r.leftSide) && /R\(/.test(r.rightSide);
  const Rmore = (r.rightSide.match(/R\(/g) || []).length > (r.leftSide.match(/R\(/g) || []).length;
  if (Lhas && Rmore) {
    console.log('rule', r.id);
    console.log(' ', r.leftSide);
    console.log(' ', r.rightSide);
    shown++;
    if (shown > 25) break;
  }
}

// Also: j Oc j_1 → j Oc j_1, j Ps j_1
console.log(
  'add jPsj1',
  justify(
    ',j \\Oc j_1,',
    ',j \\Oc j_1,j \\Ps j_1,'
  )
);
console.log(
  'add Rj1 from Oc',
  justify(',j \\Oc j_1,', ',j \\Oc j_1,R(j_1),')
);
console.log(
  'Oc+Psj1→Oc+R',
  justify(',j \\Oc j_1,j \\Ps j_1,', ',j \\Oc j_1,R(j_1),')
);
console.log(
  'Oc+Psj1→Oc+Psj1+R',
  justify(',j \\Oc j_1,j \\Ps j_1,', ',j \\Oc j_1,j \\Ps j_1,R(j_1),')
);
