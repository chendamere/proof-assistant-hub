/** Debug structural pull/push justify for s3/s4/s8. */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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
];
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
function ensure(s: string) {
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function matchBrace(s: string, openIdx: number): number {
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}
function splitArm(arm: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < arm.length; i++) {
    const c = arm[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = arm.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = arm.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({ ...r, pos: posOf(r.id) }));
const pos = 13 * 100000 + 24;
const prior = allRules.filter((r) => r.pos < pos);
const index = buildRuleIndex(prior, new Map());
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (/error-code|equiv-code|identical-4/.test(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const step = Number(process.argv[2] ?? 3);
const fails = fs.readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8').trim().split(/\n/).map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === step);
const L = ensure(stripDisplayIfConditions(f.left));
const R = ensure(stripDisplayIfConditions(f.right));
console.log('step', step);

// identical-12 / r-17 oneStep closer
for (const id of [
  'theorems-of-identical-node-comparison-12-mcnlbif',
  'recursive-function-r-17-ibifm',
  'swap-release-release',
]) {
  const rule = prior.find((r) => r.id === id)!;
  const rw = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  console.log('\n', id, 'rewrites', rw.length);
  for (const raw of rw.slice(0, 6)) {
    const e = ensure(raw);
    if (e === L) continue;
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide).match) continue;
    console.log(' ', e.slice(0, 160));
  }
}

// manual pull first atom from outer Bb{i1 Ps j1}
{
  const bb = L.indexOf('\\Bb{i_1 \\Ps j_1}');
  console.log('\nbb idx', bb);
  if (bb >= 0) {
    const condOpen = L.indexOf('{', bb);
    const condClose = matchBrace(L, condOpen);
    const tOpen = condClose + 1;
    const tClose = matchBrace(L, tOpen);
    const fOpen = tClose + 1;
    const fClose = matchBrace(L, fOpen);
    const tArm = L.slice(tOpen + 1, tClose);
    const fArm = L.slice(fOpen + 1, fClose);
    console.log('tArm head', tArm.slice(0, 80));
    console.log('fArm head', fArm.slice(0, 80));
    const tToks = splitArm(tArm.startsWith(',') ? tArm.slice(1) : tArm);
    const fToks = splitArm(fArm.startsWith(',') ? fArm.slice(1) : fArm);
    console.log('t0', tToks[0], 'f0', fToks[0], 'eq', tToks[0] === fToks[0]);
    const atom = tToks[0]!;
    const tOut = tToks.length === 1 ? ',' : ',' + tToks.slice(1).join(',') + ',';
    const fOut = fToks.length === 1 ? ',' : ',' + fToks.slice(1).join(',') + ',';
    const pulled =
      L.slice(0, bb) + atom + ',' + `\\Bb{${L.slice(condOpen + 1, condClose)}}{${tOut}}{${fOut}}` + L.slice(fClose + 1);
    console.log('pulled', ensure(pulled).slice(0, 200));
    console.log('justify', justify(L, ensure(pulled)));
  }
}

// s8: single adjacent Os swap in one arm
if (step === 8) {
  const from = 'm_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os';
  const to = 'm_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os';
  const one = L.replace(from, to); // first only
  console.log('\ns8 one swap justify', justify(L, ensure(one)));
  const all = L.split(from).join(to);
  console.log('s8 all swap justify', justify(L, ensure(all)));
  const goalish = L.split(from).join('i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os');
  console.log('s8 all to goal order justify', justify(L, ensure(goalish)));
  console.log('s8 all to goal == R', ensure(goalish) === R);
}
