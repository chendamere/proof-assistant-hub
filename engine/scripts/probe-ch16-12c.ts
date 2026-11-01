import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';

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
const f7 = fails.find((x: { key: string; step: number }) => x.key.includes('::12::') && x.step === 7)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 12;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
const L = ensure(f7.left);
const R = ensure(f7.right);
const a = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('drop true Ot+Os', j(L, a));
const b = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Os,}{,},t \\Os,},'
);
console.log('drop false Od+Os', j(L, b));
console.log('a→R', j(a, R));
console.log('b→R', j(b, R));

// pull Ot n, n Os out of true then drop
const c1 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,n \\Os,\\Bb{t \\Pc j}{,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('pull true pair', j(L, c1));
const c1b = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,n \\Os,}{,i \\Od n,n \\Os,},\\Ot n,t \\Os,},'
);
console.log('pull Ot only', j(L, c1b));

// create-copy: Ot n + n Os outside Bb cancels
const d1 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,\\Bb{t \\Pc j}{,n \\Os,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('bubble Ot out of true', j(L, d1));

// Show rule operators-3
const r = all.find((x) => x.id.includes('operators-and-relationships-3'));
console.log('\nrule3', r?.id, r?.leftSide, '⟺', r?.rightSide);
