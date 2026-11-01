/**
 * Hand-pattern probes for stubborn ch15 fails.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
function keyPos(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
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
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  idxCache.set(pos, i);
  return i;
}
function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function flipPsCond(expr: string): string | null {
  const re = /\\B(lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const m = re.exec(expr);
  if (!m) return null;
  return (
    expr.slice(0, m.index) +
    `\\B${m[1]}{${m[3]} \\Ps ${m[2]}}` +
    expr.slice(m.index + m[0].length)
  );
}

function tryChain(label: string, steps: string[], pos: number) {
  console.log(`\n-- ${label} --`);
  for (let i = 0; i < steps.length - 1; i++) {
    const via = justify(steps[i]!, steps[i + 1]!, pos);
    console.log(`  ${i}->${i + 1}: ${via ?? 'FAIL'}`);
    if (!via) {
      console.log('    from', ensure(steps[i]!));
      console.log('    to  ', ensure(steps[i + 1]!));
      return false;
    }
  }
  console.log('  OK chain len', steps.length - 1);
  return true;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

// --- thm 9 step 6: flip72 ---
{
  const f = fails.find((x) => x.key.includes('::9::') && x.step === 6)!;
  const pos = keyPos(f.key);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const f1 = ensure(flipPsCond(L)!);
  // after flip: Blb{j Ps i1}; apply 72 with j Ps j1 → Blb{j1 Ps i1}
  const f2 = ensure(f1.replace('\\Blb{j \\Ps i_1}', '\\Blb{j_1 \\Ps i_1}'));
  const f3 = ensure(flipPsCond(f2)!);
  tryChain('thm9 s6 flip72', [L, f1, f2, f3], pos);
  console.log('  goal match', ensure(f3) === R, 'got', f3, 'want', R);
}

// --- thm 9 step 8: push Op into both arms via mplbifi ---
{
  const f = fails.find((x) => x.key.includes('::9::') && x.step === 8)!;
  const pos = keyPos(f.key);
  const L = ensure(f.left);
  const R = ensure(f.right);
  // Need i1 Op and j1 Op outside then push. create-next-prev adds On,Op from nothing?
  // Reverse mplbifi pulls Op out. Forward: m Op, Blb → Blb{m Op}{m Op}
  // Path: add i1 Op outside (how?), push, add j1 Op outside, push, reorder arms.
  // Or: reverse create-next-prev next to existing? There's no free On inside arms.
  // Look at R: arms have i1 Op, i1 Os, j1 Op, j1 Os
  // Maybe: create-next-prev reverse on nothing... axiom: ,i On, i Op, ⟺ ,i On,
  // So reverse adds Op next to On. Outside we have i1 On at top. Add i1 Op next to i1 On, push into Blb via 17, then same for j1?
  // But j1 doesn't have On outside - only j Oc j1.
  // Alternative: reverse release? Or add Op via reverse of dropping Op inside.
  // Try: L → add i1 Op after i1 On → push into both arms → add j1 Op after j Oc? need j1 On first?
  const a1 = ensure(L.replace('i_1 \\On,j \\Oc', 'i_1 \\On,i_1 \\Op,j \\Oc'));
  const a2 = ensure(
    a1.replace(
      'i_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
      '\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}'
    )
  );
  // still need j1 Op in both arms
  const a3 = ensure(
    a2.replace(
      '\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}',
      'j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}'
    )
  );
  const a4 = ensure(
    a3.replace(
      'j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Os,}',
      '\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}{,i_1 \\Op,i_1 \\Os,j_1 \\Op,j_1 \\Os,}'
    )
  );
  // reorder i1 Op before i1 Os already; need j1 Op before j1 Os - already.
  // Want: {i1 Op, i1 Os, j1 Op, j1 Os} - a4 has {i1 Op, i1 Os, j1 Op, j1 Os} if push puts j1 Op after i1 Os
  // a4 target arms: i1 Op, i1 Os, j1 Op, j1 Os — matches R if outer matches
  tryChain('thm9 s8 Op push', [L, a1, a2, a3, a4], pos);
  console.log('  goal', ensure(a4) === R);
  console.log('  a4', a4);
  console.log('  R ', R);
}

// --- thm 9 step 20: collapse Oc/Os from arms (create-copy / continuity def reverse) ---
{
  const f = fails.find((x) => x.key.includes('::9::') && x.step === 20)!;
  const pos = keyPos(f.key);
  const L = ensure(f.left);
  const R = ensure(f.right);
  // L: j Oc j1, j1 Op, Blb{i Ps j1}{i Oc i1, i1 Os, j1 Os}{same}
  // R: j Oc j1, j1 Op, Blb{i Ps j1}{j1 Os}{j1 Os}
  // Drop i Oc i1, i1 Os from both arms — create-copy reverse? create-copy: i Oc m, m Os ⟺ empty?
  // Actually create-copy: ,i Oc j, ⟺ ,i Oc j, j Os, or the axiom create?
  // Connectivity create-copy often: X Oc m, m Os can be deleted as a pair via create?
  const mid = ensure(
    L.replace(
      /\\Blb\{i \\Ps j_1\}\{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,\}\{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,}'
    )
  );
  console.log('\n-- thm9 s20 direct mid --', justify(L, mid, pos), 'matchR', mid === R);
  // stepwise: pull i Oc i1, i1 Os out then drop
  const p1 = ensure(
    L.replace(
      /\\Blb\{i \\Ps j_1\}\{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,\}\{,i \\Oc i_1,i_1 \\Os,j_1 \\Os,\}/,
      'i \\Oc i_1,i_1 \\Os,\\Blb{i \\Ps j_1}{,j_1 \\Os,}{,j_1 \\Os,}'
    )
  );
  tryChain('thm9 s20 pull then drop', [L, p1, R], pos);
}

// --- thm 321 s9: drop i Ps i1 ---
{
  const f = fails.find((x) => x.key.includes('::321::') && x.step === 9)!;
  if (f) {
    const pos = keyPos(f.key);
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('\n-- thm321 s9 --');
    console.log('L', L);
    console.log('R', R);
    console.log('direct', justify(L, R, pos));
    // drop i Ps i1 between On and i1 Pu — need bubble next to i Oc i1 then reverse copy-identical
    const bubbled = ensure(
      ',i \\Pu,i \\Oc i_1,i \\Ps i_1,i_1 \\On,i \\On,i_1 \\Pu,i \\Pu,i_1 \\Os,'
    );
    const dropped = ensure(',i \\Pu,i \\Oc i_1,i_1 \\On,i \\On,i_1 \\Pu,i \\Pu,i_1 \\Os,');
    tryChain('thm321 drop Ps', [L, bubbled, dropped], pos);
    console.log('dropped==R', dropped === R);
  }
}

// --- thm 322 s5: drop Pu flags ---
{
  const f = fails.find((x) => x.key.includes('::322::') && x.step === 5)!;
  if (f) {
    const pos = keyPos(f.key);
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('\n-- thm322 s5 --');
    console.log('L', L);
    console.log('R', R);
    console.log('direct', justify(L, R, pos));
  }
}

// --- thm 306 Pc subst ---
{
  const f = fails.find((x) => x.key.includes('::306::'))!;
  if (f) {
    const pos = keyPos(f.key);
    console.log('\n-- thm306 --');
    console.log('L', ensure(f.left));
    console.log('R', ensure(f.right));
    console.log('direct', justify(f.left, f.right, pos));
  }
}
