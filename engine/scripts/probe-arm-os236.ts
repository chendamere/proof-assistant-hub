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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const pos = 13 * 100000 + 108;
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/proof-step-failures.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::108::') && x.step === 236)!;
const L = ensure(f.left);
const R = ensure(f.right);
console.log('L Bb region:', L.match(/\\Bb\{[^}]+\}\{[^}]+\}\{[^}]+\}/)?.[0]);
console.log('R Bb region:', R.match(/\\Bb\{[^}]+\}\{[^}]+\}\{[^}]+\}/)?.[0]);

// Try adjacent Os swap in true arm: i_2,j_2,m_2,j_1 → j_1,... need many swaps
// First swap i_2 Os with j_2 Os?
let cur = L;
const trueArm = 'i_2 \\Os,j_2 \\Os,m_2 \\Os,j_1 \\Os,\\Tc c_1';
const swaps = [
  ['i_2 \\Os,j_2 \\Os', 'j_2 \\Os,i_2 \\Os'],
  ['j_2 \\Os,m_2 \\Os', 'm_2 \\Os,j_2 \\Os'],
  ['m_2 \\Os,j_1 \\Os', 'j_1 \\Os,m_2 \\Os'],
];
for (const [a, b] of swaps) {
  if (!cur.includes(a)) {
    console.log('missing', a);
    continue;
  }
  const next = ensure(cur.replace(a, b));
  console.log('swap', a, '→', b, justify(cur, next));
}

// Maybe need to use display-if form Bb{if(...)} vs Bb{cond}
console.log('L has if?', /if\(/.test(L), 'R has if?', /if\(/.test(R));

// Try full true-arm replacement in one go
const Ltrue = L.match(/\\Bb\{i_2 \\Ps m_2\}\{,([^}]*)\}\{,([^}]*)\}/)!;
const Rtrue = R.match(/\\Bb\{i_2 \\Ps m_2\}\{,([^}]*)\}\{,([^}]*)\}/)!;
console.log('L arms', Ltrue[1], '|', Ltrue[2]);
console.log('R arms', Rtrue[1], '|', Rtrue[2]);

// Bubble sort true arm toward goal
const goalTrue = Rtrue[1]!.replace(/^\s*,?\s*/, '').replace(/\s*,?\s*$/, '');
let arm = Ltrue[1]!.replace(/^\s*,?\s*/, '').replace(/\s*,?\s*$/, '');
console.log('goal true', goalTrue);
for (let step = 0; step < 12 && arm !== goalTrue; step++) {
  const toks = arm.split(',');
  const goalToks = goalTrue.split(',');
  let moved = false;
  for (let i = 0; i < toks.length - 1; i++) {
    const sw = toks.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    const newArm = sw.join(',');
    const next = ensure(cur.replace(`{,${arm},}`, `{,${newArm},}`)); // may hit wrong arm
    // more precise: replace true arm only
    const next2 = ensure(
      cur.replace(`\\Bb{i_2 \\Ps m_2}{,${arm},}{`, `\\Bb{i_2 \\Ps m_2}{,${newArm},}{`)
    );
    const j = justify(cur, next2);
    if (!j) continue;
    let d = 0;
    for (let k = 0; k < sw.length; k++) {
      const gi = goalToks.indexOf(sw[k]!);
      d += gi < 0 ? 10 : Math.abs(k - gi);
    }
    console.log('step', step, 'swap', i, j, 'd', d, newArm.slice(0, 60));
    cur = next2;
    arm = newArm;
    moved = true;
    break;
  }
  if (!moved) {
    console.log('stuck at', arm);
    break;
  }
}
console.log('reached true?', arm === goalTrue);
console.log('cur==R?', cur === R, justify(cur, R));
