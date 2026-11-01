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
function makeJust(thmIdx: number) {
  const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + thmIdx;
  const index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    new Map()
  );
  return (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    for (const rule of getRulesForTransition(index, A, B)) {
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        return rule.id;
    }
    return null;
  };
}

// 123 s13: push m Op then i Op via identical-17
{
  const j = makeJust(123);
  const L = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const R = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  // bubble m Op next to Bb
  const a = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,m \\Op,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const b = ensure(
    ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const c = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,i \\Op,\\Bb{m_1 \\Ps i_1}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const d = ensure(
    ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('s13 a (bubble m Op)', j(L, a));
  console.log('s13 b push m', j(a, b));
  console.log('s13 c bubble i Op', j(b, c));
  console.log('s13 d push i', j(c, d));
  console.log('d==R', d === R);
}

// 316: 73 then drop
{
  const j = makeJust(316);
  const L = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  const R = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  // adjacent: i Ps i1, i2 Ps i already adjacent!
  const a = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  console.log('316 73 add', j(L, a));
  // drop first i2 Ps i (the one before i2 Ps i1)
  const b = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
  );
  console.log('316 drop via 70?', j(a, b));
  console.log('b==R', b === R);
}

// 322 Pu
{
  const j = makeJust(322);
  const L = ensure(',\\Ot i,i \\Pu,i \\On,i \\Pu,i \\Op,i \\Pn i,');
  const R = ensure(',\\Ot i,i \\On,i \\Op,i \\Pn i,');
  // operators-3?
  const rule = allRules.find((r) => r.id.includes('operators-and-relationships-3'));
  console.log('op3', rule?.id, rule?.leftSide, rule?.rightSide);
  // Try null-comparison drop Pu with Pn
  for (const r of allRules.filter((x) => x.pos < CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 322 && /\\Pu/.test(x.leftSide + x.rightSide) && /\\Pn|\\On|\\Op/.test(x.leftSide + x.rightSide)).slice(0, 30)) {
    const fwd = checkInferenceRules(L, R, r.leftSide, r.rightSide).match;
    const rev = checkInferenceRules(L, R, r.rightSide, r.leftSide).match;
    if (fwd || rev) console.log('322 rule', r.id, fwd ? 'fwd' : 'rev', r.leftSide, '⟺', r.rightSide);
  }
  // stepwise drop Pus
  const m1 = ensure(',\\Ot i,i \\On,i \\Pu,i \\Op,i \\Pn i,');
  const m2 = ensure(',\\Ot i,i \\Pu,i \\On,i \\Op,i \\Pn i,');
  console.log('L→m1', j(L, m1));
  console.log('L→m2', j(L, m2));
  console.log('m2→R', j(m2, R));
  console.log('m1→R', j(m1, R));
}

// 306 Pc: expand both via connectivity-4? or look for subst
{
  const j = makeJust(306);
  const L = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc i_1,i_1 \\Os,');
  const R = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc j,i_1 \\Os,');
  console.log('306 direct', j(L, R));
  // continuity rules about Pc?
  for (const r of allRules.filter((x) => /continuity/.test(x.id) && /\\Pc/.test(x.leftSide + x.rightSide)).slice(0, 20)) {
    console.log('cont Pc', r.id, r.leftSide, '⟺', r.rightSide);
  }
  // identical subst for Pc?
  for (const r of allRules.filter(
    (x) =>
      x.pos < CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 306 &&
      /\\Pc/.test(x.leftSide) &&
      /\\Ps/.test(x.leftSide) &&
      x.leftSide.includes('\\Pc') &&
      x.rightSide.includes('\\Pc')
  )) {
    if (r.leftSide !== r.rightSide && (r.leftSide.match(/\\Pc/g) || []).length === (r.rightSide.match(/\\Pc/g) || []).length) {
      const fwd = checkInferenceRules(L, R, r.leftSide, r.rightSide).match;
      const rev = checkInferenceRules(L, R, r.rightSide, r.leftSide).match;
      if (fwd || rev) console.log('HIT', r.id, fwd ? 'fwd' : 'rev', r.leftSide, r.rightSide);
    }
  }
}
