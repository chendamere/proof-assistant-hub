/** Probe dropping i1 Pu after copy-identical for thm200 s14. */
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
function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const L = ensure(
  ',j \\Oc j_1,R(j_1),\\Ot i,i \\Oc i_1,i_1 \\Pu,R(i_1),i_1 \\nPs j_1,i_1 \\Os,j_1 \\Os,'
);
const R = ensure(',j \\Oc j_1,R(j_1),\\Ot i,i \\Oc i_1,R(i_1),i_1 \\nPs j_1,i_1 \\Os,j_1 \\Os,');
const pos = 13 * 100000 + 200;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos)
  .filter((r) => /Pu|null|create|release|R\(|identical|Oc|Os|flag|thm/i.test(r.id + r.leftSide + r.rightSide));

console.log('L', L);
console.log('R', R);
console.log('rules', rules.length);

let hits = 0;
const closer: Array<{ id: string; expr: string; d: number }> = [];
function dist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}
const startD = dist(L, R);
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
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide).match) continue;
    hits++;
    const d = dist(e, R);
    if (e === R || d < startD) {
      closer.push({ id: rule.id, expr: e, d });
      console.log('HIT', rule.id, 'd', d, e === R ? 'GOAL' : e.slice(0, 140));
    }
  }
}
console.log('total justified rewrites', hits, 'closer', closer.length);
closer.sort((a, b) => a.d - b.d);
for (const c of closer.slice(0, 20)) console.log(c.d, c.id, c.expr.slice(0, 120));

// Also try bubbling Pu next to Oc / R first
const cands = [
  L.replace(',i \\Oc i_1,i_1 \\Pu,R(i_1),', ',i \\Oc i_1,R(i_1),i_1 \\Pu,'),
  L.replace(',i \\Oc i_1,i_1 \\Pu,R(i_1),', ',i_1 \\Pu,i \\Oc i_1,R(i_1),'),
  L.replace(',i \\Oc i_1,i_1 \\Pu,R(i_1),', ',i \\Oc i_1,i_1 \\Pu,i_1 \\Os,R(i_1),').replace(
    /,i_1 \\Os,j_1 \\Os,$/,
    ',j_1 \\Os,'
  ),
  ensure(',j \\Oc j_1,R(j_1),\\Ot i,i \\Oc i_1,R(i_1),i_1 \\Pu,i_1 \\nPs j_1,i_1 \\Os,j_1 \\Os,'),
  ensure(',j \\Oc j_1,R(j_1),\\Ot i,i \\Oc i_1,i_1 \\Pu,i_1 \\Os,R(i_1),i_1 \\nPs j_1,j_1 \\Os,'),
];
console.log('\nmanual cands:');
for (const c of cands) {
  // find any rule
  let found = null;
  for (const rule of rules) {
    if (checkInferenceRules(L, c, rule.leftSide, rule.rightSide).match) {
      found = rule.id;
      break;
    }
  }
  console.log(found ?? 'NO', c.slice(0, 130));
}
