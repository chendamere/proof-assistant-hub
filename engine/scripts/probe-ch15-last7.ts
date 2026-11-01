import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
function makeJust(pos: number) {
  const index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
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

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const focus = process.argv[2];

for (const f of fails) {
  const thm = f.key.split('::')[1];
  if (focus && thm !== focus) continue;
  const pos = keyPos(f.key);
  const j = makeJust(pos);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log(`\n==== ${thm} s${f.step} ====`);
  console.log('direct', j(L, R));

  // Key rules for nested Bb
  const keys = [
    'theorems-of-identical-node-comparison-12-mcnlbif',
    'theorems-of-identical-node-comparison-15-mslbifi',
    'theorems-of-identical-node-comparison-18-bifisj',
    'theorems-of-identical-node-comparison-17-mplbifi',
    'rules-of-node-continuity-0-lbifinj',
    'rules-of-node-continuity-8-lbifinj',
    'thm-Ps-transitive',
    'theorems-of-identical-node-comparison-73-isjjsm',
    'theorems-of-identical-node-comparison-72-isjbifj',
    'copy-identical',
    'create-copy',
    'create-next-prev',
    'rules-of-operators-9-ipisi',
  ];
  let hits = 0;
  for (const id of keys) {
    const rule = allRules.find((r) => r.id === id);
    if (!rule || rule.pos >= pos) continue;
    for (const [a, b, dir] of [
      [rule.leftSide, rule.rightSide, 'fwd'],
      [rule.rightSide, rule.leftSide, 'rev'],
    ] as const) {
      let rws: string[];
      try {
        rws = oneStepRewrites(L, a, b);
      } catch {
        continue;
      }
      for (const raw of rws.slice(0, 30)) {
        const e = ensure(raw);
        if (!checkInferenceRules(L, e, a, b, { dagCache: dag }).match) continue;
        const closer = Math.abs(e.length - R.length) <= Math.abs(L.length - R.length) + 20;
        if (e === R || closer) {
          console.log(`  ${id} ${dir} → ${e.slice(0, 160)}`);
          hits++;
          if (hits >= 10) break;
        }
      }
      if (hits >= 10) break;
    }
    if (hits >= 10) break;
  }

  // Hand mid for 28 s3: reverse id12 pull m Oc m1
  if (thm === '28' && f.step === 3) {
    const mid = ensure(
      ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
    );
    console.log('pull Oc', j(L, mid));
  }
  if (thm === '123' && f.step === 14) {
    const a = ensure(
      ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,m \\Op,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    console.log('bubble m Op', j(L, a));
    // try successive adjacent swaps from L toward a
    function tops(e: string) {
      const items: string[] = [];
      let d = 0,
        s = 0;
      for (let i = 0; i < e.length; i++) {
        if (e[i] === '{') d++;
        else if (e[i] === '}') d--;
        else if (e[i] === ',' && d === 0) {
          const p = e.slice(s, i).trim();
          if (p) items.push(p);
          s = i + 1;
        }
      }
      const t = e.slice(s).trim();
      if (t) items.push(t);
      return items;
    }
    let cur = L;
    const goal = tops(a);
    for (let step = 0; step < 20; step++) {
      const items = tops(cur);
      if (items.join('|') === goal.join('|')) {
        console.log('reached bubble target in', step);
        break;
      }
      let moved = false;
      for (let i = 0; i < items.length - 1; i++) {
        const swapped = items.slice();
        const tmp = swapped[i]!;
        swapped[i] = swapped[i + 1]!;
        swapped[i + 1] = tmp;
        // prefer moving m Op rightward
        if (items[i] !== 'm \\Op' && items[i + 1] !== 'm \\Op') continue;
        const cand = ensure(',' + swapped.join(',') + ',');
        if (j(cur, cand)) {
          console.log('swap', items[i], '<->', items[i + 1], j(cur, cand));
          cur = cand;
          moved = true;
          break;
        }
      }
      if (!moved) {
        console.log('stuck bubbling', tops(cur).join(' | '));
        break;
      }
    }
  }
  if (thm === '129') {
    // drop j Ps i1 and i1 Ps j1
    const mid = ensure(
      ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    console.log('drop j Ps i1', j(L, mid));
    const mid2 = ensure(
      ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    console.log('drop i1 Ps j1', j(mid, mid2));
    console.log('reorder to R', j(mid2, R));
  }
}
