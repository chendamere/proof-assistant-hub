/**
 * Probe adjacent outer reorder for 28 s3, and On-before-Oc push path for 115 s12.
 */
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
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
function fp(s: string) {
  return ensure(stripDisplayIfConditions(s))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
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
  console.log('=== 28 outer adjacent swaps ===');
  // A B C D Bb → C D A B Bb via adjacent
  const s1 = join(['i \\Oc i_1', 'm \\Oc m_1', 'i_1 \\On', 'm_1 \\On', tops(mid)[4]!]);
  console.log('B↔C', j(mid, s1), tops(s1).slice(0, 4));
  const s2 = join(['m \\Oc m_1', 'i \\Oc i_1', 'i_1 \\On', 'm_1 \\On', tops(mid)[4]!]);
  console.log('A↔C on s1', j(s1, s2), tops(s2).slice(0, 4));
  const s3 = join(['m \\Oc m_1', 'i \\Oc i_1', 'm_1 \\On', 'i_1 \\On', tops(mid)[4]!]);
  console.log('B↔D on s2', j(s2, s3), tops(s3).slice(0, 4));
  const s4 = join(['m \\Oc m_1', 'm_1 \\On', 'i \\Oc i_1', 'i_1 \\On', tops(mid)[4]!]);
  console.log('A↔D on s3', j(s3, s4), tops(s4).slice(0, 4));
  console.log('s4==R', fp(s4) === fp(R));

  // alternate: bubble m Oc left one by one from mid
  let cur = mid;
  const goal = tops(R);
  for (let step = 0; step < 12; step++) {
    if (fp(cur) === fp(R)) {
      console.log('greedy reached in', step);
      break;
    }
    const a = tops(cur);
    let found: string | null = null;
    let foundRule: string | null = null;
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i]!.startsWith('\\Bb') || a[i + 1]!.startsWith('\\Bb')) continue;
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      const cand = join(swapped);
      const rule = j(cur, cand);
      if (!rule) continue;
      // prefer reducing inversion count vs goal
      const inv = (items: string[]) => {
        let c = 0;
        for (let x = 0; x < Math.min(items.length, goal.length); x++) if (items[x] !== goal[x]) c++;
        return c;
      };
      if (inv(swapped) < inv(a)) {
        found = cand;
        foundRule = rule;
        break;
      }
      if (!found) {
        found = cand;
        foundRule = rule;
      }
    }
    if (!found) {
      console.log('no adjacent swap at', tops(cur).slice(0, 4));
      // try ALL adjacent regardless
      for (let i = 0; i < a.length - 1; i++) {
        if (a[i]!.startsWith('\\Bb') || a[i + 1]!.startsWith('\\Bb')) continue;
        const swapped = a.slice();
        const tmp = swapped[i]!;
        swapped[i] = swapped[i + 1]!;
        swapped[i + 1] = tmp;
        console.log('  try', i, j(cur, join(swapped)), a[i]!.slice(0, 20), '<->', a[i + 1]!.slice(0, 20));
      }
      break;
    }
    console.log('swap', step, foundRule, tops(found).slice(0, 4));
    cur = found;
  }
}

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 12)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n=== 115 On-first path from chains ===');
  const chain = [
    ',i \\Oc i_1,i \\Oc i_2,i_2 \\On,i_1 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
    ',i \\Oc i_1,i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
    ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
    ',i \\Oc i_2,i_2 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},',
  ].map(ensure);
  let prev = L;
  for (let i = 0; i < chain.length; i++) {
    console.log('hop', i, j(prev, chain[i]!));
    prev = chain[i]!;
  }
  // From after push Oc+On (chain[4]): need Os front then match R
  // R true: i2 Os, i Oc i1, i1 On, Bb
  // chain4 true: i Oc i1, i1 On, i2 Os, Bb
  const t1 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('true Os rotate (multi?)', j(chain[4]!, t1));
  // step by step true arm: bubble Os left
  const a = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('true: On↔Os', j(chain[4]!, a));
  const b = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('true: Oc↔Os', j(a, b));
  const c = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('false: On↔Os', j(b, c));
  const d = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('false: Oc↔Os', j(c, d));
  console.log('d==R', fp(d) === fp(R));

  // Also: after chain[4], try push via id15 for Os reorder like identical-15
  // Alternative from chain[5] (On before Oc in true only)
  const e = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i_1 \\On,i \\Oc i_1,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('from chain5 true Os past On', j(chain[5]!, e));
}
