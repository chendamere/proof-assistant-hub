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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::12::') && x.step === 6)!;
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
const L = ensure(f.left);
const R = ensure(f.right);
const s1 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,}{,i \\Od n,},n \\Os,t \\Os,},'
);
console.log('1 swap Os past tOs', j(L, s1));
const s2 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,n \\Os,\\Ot n,n \\Pu,}{,n \\Os,i \\Od n,},t \\Os,},'
);
console.log('2 push Os front', j(s1, s2));
const s2b = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,n \\Os,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('2b push Os back', j(s1, s2b));
console.log('2b→R', j(s2b, R));
const s3 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Os,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('2b drop Pu', j(s2b, s3), '==R', s3 === R);

// from s2 front-pushed
console.log('s2→R', j(s2, R));
const s2c = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,n \\Os,\\Ot n,n \\Os,}{,n \\Os,i \\Od n,},t \\Os,},'
);
console.log('s2 drop Pu keep front Os', j(s2, s2c));

// s7: try pull then create-copy
const f7 = fails.find((x: { key: string; step: number }) => x.key.includes('::12::') && x.step === 7)!;
const L7 = ensure(f7.left);
const R7 = ensure(f7.right);
const u1 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,\\Bb{t \\Pc j}{,n \\Os,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('\ns7 pull Ot', j(L7, u1));
const u2 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,n \\Os,\\Bb{t \\Pc j}{,}{,i \\Od n,n \\Os,},t \\Os,},'
);
console.log('s7 pull Os true', j(u1, u2));
const u3 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,n \\Os,i \\Od n,n \\Os,\\Bb{t \\Pc j}{,}{,},t \\Os,},'
);
console.log('s7 pull Od+Os false', j(u2, u3));
const u4 = ensure(',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,}{,},t \\Os,},');
console.log('s7 drop Ot Os Od Os', j(u3, u4), '==R', u4 === R7);

// try create-copy collapse both arms at once via connectivity
const v1 = ensure(
  ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Ot n,n \\Os,\\Bb{t \\Pc j}{,}{,},i \\Od n,n \\Os,t \\Os,},'
);
console.log('s7 pull both pairs', j(L7, v1));
console.log('v1→R', j(v1, R7));
