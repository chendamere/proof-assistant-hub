/** 100 s3: after c_2a fix, insert R(i2) via reverse thm-R-i-release. */
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
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string): string {
  return ensure(expr).replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 100;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
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

const L = ensure(
  ',i \\Oc i_1,i \\Oc i_2,i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
);
const R = ensure(
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
);
console.log('s3', justify(L, R) ?? 'FAIL');

if (justify(L, R)) {
  // nothing to insert — direct! But wait, if direct works after c_2a fix, verify will pass without insert
  console.log('direct OK — no insert needed');
} else {
  const mid = ensure(L.replace(',i \\Oc i_2,i_2 \\Os,', ',i \\Oc i_2,R(i_2),i_2 \\Os,'));
  console.log('insert R', justify(L, mid) ?? 'FAIL', mid === R);
}

// Also check s4 distribute
const L4 = ensure(
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
);
const R4 = ensure(
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
);
console.log('s4 direct', justify(L4, R4) ?? 'FAIL');
const mid4 = ensure(
  L4.replace(
    ',R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}',
    ',R(i_2),j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}'
  ).replace(
    '\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,}',
    '\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,}'
  )
);
console.log('s4 mid', justify(L4, mid4) ?? 'FAIL', mid4 === R4);

// Find connectivity / identical rule for distributing Os into outer Bb arms
const mid4b = ensure(
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),j \\Oc j_1,R(i_1),R(j_1),i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
);
console.log('s4 bubble Os to Bb', justify(L4, mid4b) ?? 'FAIL');
console.log('s4 then push in', justify(mid4b, R4) ?? 'FAIL');
