import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
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
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 123;
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
function tops(e: string) {
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

const L = ensure(
  ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
const R = ensure(
  ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);

// Distance-minimizing: move m Op right until before Bb
let cur = L;
const path: string[] = [];
function distToBb(items: string[], name: string) {
  const iOp = items.indexOf(`${name} \\Op`);
  const iBb = items.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
  return iOp < 0 || iBb < 0 ? 99 : iBb - iOp - 1; // how many slots to cross
}
for (const name of ['m', 'i']) {
  for (let guard = 0; guard < 15; guard++) {
    const items = tops(cur);
    const d = distToBb(items, name);
    if (d === 0) break;
    if (d < 0) {
      console.log(name, 'Op is after Bb?');
      break;
    }
    const iOp = items.indexOf(`${name} \\Op`);
    const swapped = items.slice();
    const tmp = swapped[iOp]!;
    swapped[iOp] = swapped[iOp + 1]!;
    swapped[iOp + 1] = tmp;
    const cand = join(swapped);
    const via = justify(cur, cand);
    console.log('move', name, 'Op right over', items[iOp + 1], 'via', via);
    if (!via) break;
    path.push(cand);
    cur = cand;
  }
  // push into Bb
  const items = tops(cur);
  const iOp = items.indexOf(`${name} \\Op`);
  const iBb = items.findIndex((t) => t.startsWith('\\Bb'));
  if (iOp !== iBb - 1) {
    console.log('not adjacent', name, iOp, iBb);
    continue;
  }
  const without = join(items.filter((_, i) => i !== iOp));
  const am = /\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/.exec(without);
  if (!am) {
    console.log('no bb');
    continue;
  }
  const pushed = ensure(
    without.replace(
      am[0]!,
      `\\Bb{${am[1]}}{,${name} \\Op,${am[2]}}{,${name} \\Op,${am[3]}}`
    )
  );
  const via = justify(cur, pushed);
  console.log('push', name, via);
  if (!via) break;
  path.push(pushed);
  cur = pushed;
}
console.log('final==R', ensure(cur) === R);
console.log('final', cur);
console.log('R    ', R);
console.log('path len', path.length);
