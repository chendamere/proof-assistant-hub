import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const CO = [
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
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
// after s14 fill, step numbers shifted — find by left fingerprint fragment
const f =
  fails.find(
    (x: { key: string; left: string }) =>
      x.key.includes('::122::') &&
      x.left.includes('s_1 \\Pn s_1') &&
      x.left.includes('s_2 \\Pn s_2') &&
      x.right.includes('s_1 \\Pe s_2')
  ) || fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 29);
console.log('fail step', f?.step, f?.key?.slice(0, 80));
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(f.left);
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
// Pe outside Bb then push
const peOut = drop2.replace(
  ',\\Bb{i \\Pu}',
  ',s_1 \\Pe s_2,\\Bb{i \\Pu}'
);
console.log('drop2->peOut', j(drop2, peOut));
console.log('peOut->R via null17?', j(peOut, R));

// peOut then distribute
const peBoth = peOut.replace(
  '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
).replace(
  't_2 \\Os,s_2 \\Os,}',
  't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('peOut->peBoth', j(peOut, peBoth));
console.log('peBoth==R', ensure(peBoth) === R, j(peBoth, R));

// From peMid: pull Pe out (true only has it) — try mid with Pe before Bb and without in true
const peOutFromMid = peMid
  .replace('i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,', 'i \\Od s_1,i \\Od s_2,')
  .replace(',\\Bb{i \\Pu}', ',s_1 \\Pe s_2,\\Bb{i \\Pu}');
console.log('peMid->peOutFromMid', j(peMid, peOutFromMid));
console.log('peOutFromMid->peBoth', j(peOutFromMid, peBoth));

// Try peMid -> R with Pe also in false (construct R from peMid)
console.log('peMid->R', j(peMid, R));

// false-arm: gather Ot via unzip then temp-value-equal
const falseOt = drop2.replace(
  '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}',
  '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,\\Ot s_2,}{,i \\Od s_1,i \\Od s_2,},t_1 \\Os,i \\Ob t_2,t_2 \\Os,s_2 \\Os,}'
);
console.log('drop2->falseOt gather?', j(drop2, falseOt));

// peMid then add Pe to false only
const peFalse = peMid.replace('t_2 \\Os,s_2 \\Os,}', 't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}');
console.log('peMid->peFalse', j(peMid, peFalse));
console.log('peFalse->R', j(peFalse, R), 'eq', ensure(peFalse) === R);

// Try null-17 reverse direction as rule match peBoth -> peOut
console.log('null17 id', j(peOut, peBoth));

// Check hop chain if peOut obtainable another way: id-value on a copy of Od outside
const withOdOut = drop2.replace(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  ',i \\Od s_1,i \\Od s_2,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
);
console.log('drop2->withOdOut', j(drop2, withOdOut));
