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

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::28::') && x.step === 3)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('=== 28 s3 bubble then pull ===');
  // bubble m Oc to front of true arm
  const a = ensure(
    ',i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m \\Oc m_1,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('true arm bubble Oc', j(L, a));
  const b = ensure(
    ',i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('false arm bubble Oc', j(a, b));
  const c = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('pull Oc', j(b, c));
  // bubble m1 On to front of arms then pull
  const d = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('true bubble On', j(c, d));
  const e = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('false bubble On', j(d, e));
  const f2 = ensure(
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  console.log('pull On', j(e, f2));
}

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 14)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n=== 115 s14 full ===');
  const a = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('1 release false', j(L, a));
  const b = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,\\Tc c_2,},'
  );
  console.log('2 create false', j(a, b));
  const c = ensure(',\\Bb{i \\Pn j}{,\\Bb{i \\Pn j}{,\\Tc c_1,}{,\\Tc c_3,},}{,\\Tc c_2,},');
  console.log('3 collapse true', j(b, c));
  console.log('c==R', c === R);
}

{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::115::') && x.step === 12)!;
  const j = makeJust(keyPos(f.key));
  const L = ensure(f.left);
  console.log('\n=== 115 s12 ===');
  // Move i Oc i1 rightward to Bb
  const steps = [
    ensure(
      ',i \\Oc i_2,i_1 \\On,i \\Oc i_1,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_1 \\On,i_2 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
  ];
  console.log('L→s0', j(L, steps[0]!));
  console.log('s0→s1', j(steps[0]!, steps[1]!));
  // Also try swap i Oc i1 with i1 On first
  const t0 = ensure(
    ',i \\Oc i_2,i_1 \\On,i \\Oc i_1,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  // L is i Oc i1, i Oc i2, i1 On, i2 On, Bb
  const u0 = ensure(
    ',i \\Oc i_2,i \\Oc i_1,i_1 \\On,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('swap Ocs', j(L, u0));
  const u1 = ensure(
    ',i \\Oc i_2,i_1 \\On,i \\Oc i_1,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('u0→u1', j(u0, u1));
  const u2 = ensure(
    ',i \\Oc i_2,i_1 \\On,i_2 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('u1→u2', j(u1, u2));
  const u3 = ensure(
    ',i \\Oc i_2,i_2 \\On,i_1 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('u2→u3', j(u2, u3));
  // push Oc
  const u4 = ensure(
    ',i \\Oc i_2,i_2 \\On,i_1 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('push Oc', j(u3, u4));
  // need i1 On adjacent too - bubble and push
  const u5 = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('push On from u3?', j(u3, u5));
  const u4b = ensure(
    ',i \\Oc i_2,i_2 \\On,i \\Oc i_1,i_1 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  console.log('u3→u4b bubble On', j(u3, u4b));
  const u5b = ensure(
    ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  // push both Oc and On together? next-identical-dist style for On, and id12 for Oc separately
  console.log('push Oc from u4b', j(u4b, ensure(
    ',i \\Oc i_2,i_2 \\On,i_1 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
  )));
}
