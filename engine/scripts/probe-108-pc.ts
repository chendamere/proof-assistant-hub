/** Probe 108 s359 Pc-fold + pull j_2 Os from arms. */
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const f = JSON.parse(
  fs
    .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
    .trim()
    .split(/\n/)
    .find((l) => {
      const r = JSON.parse(l);
      return r.key.includes('::108::') && r.step === 359;
    })!
);

const L = ensure(f.left);
const R = ensure(f.right);
console.log('fold Pc', justify(
  L,
  ensure(L.replace(
    'i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
    'i \\Pc j,'
  ))
));

const folded = ensure(L.replace(
  'i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
  'i \\Pc j,'
));
console.log('folded', folded);
console.log('folded→R', justify(folded, R));

// From folded, pull j_2 Os out of both arms
const pull = ensure(
  folded
    .replace(
      '\\Bb{i_2 \\Ps m_2}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_2,}',
      'j_2 \\Os,\\Bb{i_2 \\Ps m_2}{,i_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,m_2 \\Os,\\Tc c_2,}'
    )
);
console.log('pull', justify(folded, pull));
console.log('pull→R', justify(pull, R));
console.log('pull', pull);
console.log('R   ', R);
