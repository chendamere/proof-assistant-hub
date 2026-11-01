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

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// --- 28 s3 ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::28::') && x.step === 3)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('=== 28 s3 ===');
  // pull m Oc m1 from both arms
  const a = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('pull Oc', j(L, a));
  const b = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('pull On', j(a, b));
  // push i1 Os into inner Bb
  const c = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('push i1 Os into inner (both outer arms)', j(b, c));
  // maybe need one arm at a time for nested
  const c1 = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('push true arm only', j(b, c1));
  const c2 = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('push false arm', j(c1, c2));
  // reorder Os inside: i1 Os, m1 Os → m1 Os, i1 Os
  const d = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,m_1 \\Os,i_1 \\Os,\\Tc c_4,},},'
  );
  console.log('reorder inner Os (both)', j(c2, d));
  const d1 = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('reorder one inner arm', j(c2, d1));
  // reorder outer m before i
  const e = ensure(
    ',m \\Oc m_1,m_1 \\On,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,m_1 \\Os,i_1 \\Os,\\Tc c_4,},},'
  );
  console.log('d→e reorder outer', j(d, e));
  console.log('e==R', e === R);
}

// --- 115 s12 ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 12)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n=== 115 s12 ===');
  // push i Oc i1 into both arms via reverse id12
  const a = ensure(
    ',i \\Oc i_2,i_1 \\On,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('push Oc both', j(L, a));
  // maybe need i Oc i1 adjacent to Bb first
  const a0 = ensure(
    ',i \\Oc i_2,i_1 \\On,i_2 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('bubble Oc to Bb', j(L, a0));
  const a1 = ensure(
    ',i \\Oc i_2,i_2 \\On,i_1 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('L reorder toward', j(L, a1));
}

// --- 115 s14 ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 14)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n=== 115 s14 ===');
  // reverse continuity-0 on true arm: i Oc i1, i1 On, Bb{i1 Ps j}{i1 Os,...} → Bb{i Pn j}{...}
  // But R has Bb{i Pn j}{Bb{i Pn j}{c1}{c3}}{c2} — nested Pn!
  // Maybe: collapse true arm to Bb{i Pn j}{c1}{c3} via continuity-0 reverse then something for nested
  const cont0 = allRules.find((r) => r.id === 'rules-of-node-continuity-0-lbifinj')!;
  console.log('cont0', cont0.leftSide, '⟺', cont0.rightSide);
  const a = ensure(
    ',\\Bb{i \\Pn j}{,\\Bb{i \\Pn j}{,\\Tc c_1,}{,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('collapse true arm', j(L, a));
  const b = ensure(',\\Bb{i \\Pn j}{,\\Bb{i \\Pn j}{,\\Tc c_1,}{,\\Tc c_3,},}{,\\Tc c_2,},');
  console.log('collapse false', j(a, b));
  console.log('b==R', b === R);
  // try reverse create-copy on false arm first
  const f1 = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('false release-next', j(L, f1));
  const f2 = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,\\Tc c_2,},'
  );
  console.log('false create-copy', j(f1, f2));
}
