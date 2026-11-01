import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(id) || definitionIds.has(id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
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
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 9;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  dag
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

const L = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const R = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,},'
);

// dual Op push rule?
const dual = allRules.find((r) => r.id.includes('iopjop'));
console.log('dual rule', dual?.id, dual?.leftSide, dual?.rightSide);

const bothOut = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,i_1 \\Op,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('L→bothOut', justify(L, bothOut));
console.log('bothOut→R', justify(bothOut, R));

// create-next-prev insert i1 On,i1 Op then drop dup On
const c1 = ensure(
  ',i \\Oc i_1,i_1 \\On,i_1 \\On,i_1 \\Op,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const c1b = ensure(
  ',i \\Oc i_1,i_1 \\On,i_1 \\Op,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('L→c1 create', justify(L, c1));
console.log('L→c1b create', justify(L, c1b));
console.log('c1→c1b drop On', justify(c1, c1b));

const push1 = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},'
);
console.log('c1b→push1', justify(c1b, push1));

// create for j1
const c2 = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,j_1 \\On,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,},'
);
console.log('push1→c2', justify(push1, c2));
const push2 = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,j_1 \\On,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,},'
);
console.log('c2→push2', justify(c2, push2));
// drop j1 On via release-next needs j1 Os outside...
const dropOn = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,},'
);
console.log('push2→dropOn', justify(push2, dropOn));
console.log('dropOn==R', dropOn === R);

// Try oneStepRewrites of create-next-prev and dual Op from L
for (const id of ['create-next-prev', 'swap-theorems-of-same-operand-58-iuicni']) {
  const rule = allRules.find((r) => r.id === id || r.id.includes('iop') && r.id.includes('jop'));
  void rule;
}
const dualRules = allRules.filter(
  (r) =>
    r.pos < pos &&
    /\\Op/.test(r.leftSide + r.rightSide) &&
    /\\B/.test(r.leftSide + r.rightSide) &&
    /i \\Op/.test(r.leftSide + r.rightSide)
);
console.log(
  'dual-ish',
  dualRules.slice(0, 10).map((r) => r.id)
);
for (const rule of dualRules.slice(0, 15)) {
  try {
    const rw = oneStepRewrites(L, rule.leftSide, rule.rightSide);
    for (const e of rw) {
      if (!checkInferenceRules(L, ensure(e), rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      if (ensure(e).includes('\\Op')) console.log('hit', rule.id, ensure(e).slice(0, 140));
    }
  } catch {
    /* */
  }
}

// create-copy for s20
const L20 = ensure(
  ',j \\Oc j_1,j_1 \\Op,\\Blb{i \\Ps j_1}{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,}{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,},'
);
const R20 = ensure(',j \\Oc j_1,j_1 \\Op,\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,},');
const createCopy = allRules.find((r) => r.id === 'create-copy')!;
console.log('create-copy', createCopy.leftSide, '⟺', createCopy.rightSide);
try {
  const rw = oneStepRewrites(L20, createCopy.rightSide, createCopy.leftSide); // reverse drop
  console.log(
    'rev create-copy rewrites',
    rw.slice(0, 5).map((e) => ensure(e).slice(0, 120))
  );
  for (const e of rw) {
    if (checkInferenceRules(L20, ensure(e), createCopy.rightSide, createCopy.leftSide, { dagCache: index.dagCache }).match) {
      console.log('justified reverse create-copy', ensure(e));
    }
  }
} catch (err) {
  console.log('create-copy err', err);
}
console.log('L20→R20', justify(L20, R20));
