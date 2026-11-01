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
function tops(e: string): string[] {
  const items: string[] = [];
  let d = 0,
    s = 0;
  const x = ensure(e);
  for (let i = 0; i < x.length; i++) {
    if (x[i] === '{') d++;
    else if (x[i] === '}') d--;
    else if (x[i] === ',' && d === 0) {
      const p = x.slice(s, i).trim();
      if (p) items.push(p);
      s = i + 1;
    }
  }
  const t = x.slice(s).trim();
  if (t) items.push(t);
  return items;
}
function join(items: string[]) {
  return ensure(',' + items.join(',') + ',');
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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 0)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
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
console.log('L', tops(L).map((t) => t.slice(0, 35)));
console.log('R', tops(R).map((t) => t.slice(0, 35)));

// Pull Ot/Od from first Bb to empty-ish, then reorder
const p1 = ensure(
  ',i \\Ob t_1,\\Ot s_1,\\Bb{t_1 \\Pc j}{,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('pull Ot s1', j(L, p1));
const p2 = ensure(
  ',i \\Ob t_1,\\Ot s_1,i \\Od s_1,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('pull Od s1', j(p1, p2));

// Push i Ob t2 into Bb{t1} via connectivity-19 style? wrong cond
const q1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,i \\Ob t_2,\\Ot s_1,}{,i \\Ob t_2,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('push Ob2 into Bb1', j(L.replace(/,t_1 \\Os,i \\Ob t_2,/, ',i \\Ob t_2,t_1 \\Os,'), q1));

// After swap Os1 with Ob2:
const s0 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},i \\Ob t_2,t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('swap Os1 Ob2', j(L, s0));
// Push Ob2 into Bb1 from left of Os? Ob2 is before Os1 now - try push Ob2 into Bb1
const s1 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,i \\Ob t_2,\\Ot s_1,}{,i \\Ob t_2,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('push Ob2 into Bb1 from s0', j(s0, s1));
// Pull Ob2 out of Bb1 to sit after Ob1
const s2 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('pull Ob2 out front', j(s1, s2));
console.log('s2 vs want prefix', tops(s2).slice(0, 4).map((t) => t.slice(0, 30)));
console.log('R prefix', tops(R).slice(0, 4).map((t) => t.slice(0, 30)));

// From s2 need Bb2 before Os1: swap t1 Os with Bb2
const s3 = ensure(
  ',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,'
);
console.log('swap Os1 Bb2', j(s2, s3), 's3==R', s3 === R);

// Try connectivity-116: i Ob t1 with Bb{i Pc j} - wrong
// Try empty Bb push: empty both arms then swap
const e1 = ensure(
  ',i \\Ob t_1,\\Ot s_1,i \\Od s_1,\\Bb{t_1 \\Pc j}{,}{,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,'
);
console.log('\npull both from Bb1', j(L, e1));
