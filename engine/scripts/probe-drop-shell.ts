import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';

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
  'Rules_of_Node_Continuity',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
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
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 307;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

// 307 drop shell
{
  const L = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Os,i \\On,i \\Ps j,');
  const R = ensure(',i \\On,i \\Ps j,');
  const m1 = ensure(',i \\Oc i_1,i_1 \\Os,i \\On,i \\Ps j,');
  console.log('307 release-next', justify(L, m1));
  console.log('307 rev create-copy', justify(m1, R));
  console.log('307 direct create?', justify(L, R));
}

// 314 similar with extra
{
  const L = ensure(',i \\Oc i_0,i_0 \\On,i_0 \\Os,i \\On,i \\Ps j,j \\On,i \\Ps j,');
  const R = ensure(',i \\On,i \\Ps j,j \\On,i \\Ps j,');
  const m1 = ensure(',i \\Oc i_0,i_0 \\Os,i \\On,i \\Ps j,j \\On,i \\Ps j,');
  console.log('314 release', justify(L, m1));
  console.log('314 create', justify(m1, R));
}

// 123 s55 drop m Oc m1, m1 On, m1 Os
{
  const L = ensure(
    ',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i_1 \\Os,m \\Oc m_1,m_1 \\On,m_1 \\Os,\\Bb{m \\Ps i}{,\\Tc c_1,}{,\\Tc c_2,},'
  );
  const R = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i_1 \\Os,\\Bb{m \\Ps i}{,\\Tc c_1,}{,\\Tc c_2,},');
  const m1 = ensure(
    ',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i_1 \\Os,m \\Oc m_1,m_1 \\Os,\\Bb{m \\Ps i}{,\\Tc c_1,}{,\\Tc c_2,},'
  );
  console.log('123s55 release', justify(L, m1));
  console.log('123s55 create', justify(m1, R));
}

// 123 s12 create-next-prev
{
  const L = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const R = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const a = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const b = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('123s12 create i', justify(L, a));
  console.log('123s12 create m', justify(a, b));
  console.log('b==R', b === R);
}

// 123 s13 push Ops into arms
{
  const L = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const R = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  // need m Op, i Op adjacent before Bb - currently i Op is early, m Op mid
  const bubbled = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,m \\Op,i \\Op,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const pushed = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('123s13 bubbled via?', 'manual');
  console.log('bubbled→pushed dual', justify(bubbled, pushed));
  console.log('pushed==R', pushed === R);
}

// 316 s25 identical-73
{
  const L = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  const R = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  // want i2 Ps i → i2 Ps i1 given i Ps i1. That's reverse 73? 
  // 73: i Ps j, j Ps m → i Ps j, i Ps m
  // For i2 Ps i → i2 Ps i1: need i Ps i1 and rewrite right operand of i2 Ps i
  // flip72 style: flip i2 Ps i → i Ps i2, then ? 
  console.log('316 direct', justify(L, R));
  const f1 = ensure(L.replace('i_2 \\Ps i,i \\On', 'i \\Ps i_2,i \\On'));
  console.log('flip one', justify(L, f1));
}

// 322 drop Pu
{
  const L = ensure(',\\Ot i,i \\Pu,i \\On,i \\Pu,i \\Op,i \\Pn i,');
  const R = ensure(',\\Ot i,i \\On,i \\Op,i \\Pn i,');
  console.log('322 direct', justify(L, R));
  // null-comparison duplicate Pu drop?
  const m1 = ensure(',\\Ot i,i \\Pu,i \\On,i \\Op,i \\Pn i,');
  console.log('drop one Pu', justify(L, m1));
  console.log('drop other', justify(m1, R));
}
