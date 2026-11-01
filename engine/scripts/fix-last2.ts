import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
function makeJust(pos: number) {
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

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::28::') && x.step === 3)!;
  const j = makeJust(keyPos(f.key));
  const mid = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,m_1 \\Os,i_1 \\Os,\\Tc c_4,},},'
  );
  const R = ensure(f.right);
  // greedy bubble outer
  let cur = mid;
  const g = tops(R);
  const path: string[] = [];
  for (let step = 0; step < 20; step++) {
    if (ensure(cur) === R) break;
    const a = tops(cur);
    let best: string | null = null;
    let bestD = a.reduce((d, t, i) => d + (t !== g[i]! ? 1 : 0), 0);
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) continue;
      // only swap top-level non-Bb items
      if (a[i]!.startsWith('\\Bb') || a[i + 1]!.startsWith('\\Bb')) continue;
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      const d = swapped.reduce((dd, t, ii) => dd + (t !== g[ii]! ? 1 : 0), 0);
      const cand = join(swapped);
      if (d < bestD && j(cur, cand)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) {
      console.log('stuck', tops(cur));
      break;
    }
    console.log('swap', j(cur, best), bestD);
    path.push(best);
    cur = best;
  }
  console.log('reached R', ensure(cur) === R, 'steps', path.length);
}

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 12)!;
  const j = makeJust(keyPos(f.key));
  const afterOc = ensure(
    ',i \\Oc i_2,i_2 \\On,i_1 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const pushOn = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('\npush On', j(afterOc, pushOn));
  const R = ensure(f.right);
  // reorder arms toward R
  let cur = pushOn;
  for (let step = 0; step < 30; step++) {
    if (ensure(cur) === R) {
      console.log('115 reached R in', step);
      break;
    }
    // try swap-release inside one arm at a time via justified adjacent within arm — hard.
    // Manual reorder true then false
    break;
  }
  // Manual path from pushOn to R
  const t1 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('reorder true On past Oc', j(pushOn, t1));
  const t2 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('true: Os to front', j(t1, t2));
  const t3 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('false reorder On', j(t2, t3));
  const t4 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('false Os front', j(t3, t4));
  console.log('t4==R', t4 === R);
}
