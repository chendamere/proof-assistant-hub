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
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const POS = 13 * 100000 + 100;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < POS),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => String(x.key).includes('::100::'));

for (const f of fails) {
  console.log('\n=== s' + f.step + ' ===');
  const L = ensure(f.left);
  const R = ensure(f.right);
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const mL = L.match(re);
  const mR = R.match(re);
  console.log('conds', mL?.[0], '→', mR?.[0]);
  if (mL && mR && mL[2] === mR[2] && mL[3] !== mR[3]) {
    const a = mL[2]!;
    const b = mL[3]!;
    const c = mR[3]!;
    const kind = mL[1]!;
    const flip1 = L.replace(`\\B${kind}{${a} \\Ps ${b}}`, `\\B${kind}{${b} \\Ps ${a}}`);
    console.log('flip1', justify(L, flip1));
    const via72 = flip1.replace(`\\B${kind}{${b} \\Ps ${a}}`, `\\B${kind}{${c} \\Ps ${a}}`);
    console.log('via72', justify(flip1, via72));
    const flip2 = via72.replace(`\\B${kind}{${c} \\Ps ${a}}`, `\\B${kind}{${a} \\Ps ${c}}`);
    console.log('flip2', justify(via72, flip2), '=R', ensure(flip2) === R);
  }

  // try R(j1) push
  for (const atom of ['R(j_1)', 'j \\Oc j_1', 'R(i_1)', 'i \\Oc i_1', 'j_2 \\Os', 'i_2 \\Os']) {
    if (!L.includes(atom)) continue;
    // construct adjacent mid then push
    const items = (() => {
      const s = L;
      const out: string[] = [];
      let depth = 0,
        start = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') depth--;
        else if (s[i] === ',' && depth === 0) {
          const p = s.slice(start, i).trim();
          if (p) out.push(p);
          start = i + 1;
        }
      }
      const t = s.slice(start).trim();
      if (t) out.push(t);
      return out;
    })();
    if (!items.includes(atom)) continue;
  }
}
