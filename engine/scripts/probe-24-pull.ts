/** Probe Oc/R pull chains for thm24 steps 3,4,6,7,8,9. */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';

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
function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function dist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 24;
const prior = allRules.filter((r) => r.pos < pos);
const dag = new Map();
const index = buildRuleIndex(prior, dag);

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

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((f: { key: string }) => f.key.includes('::24::'));

const step = Number(process.argv[2] ?? 3);
const f = fails.find((x: { step: number }) => x.step === step);
if (!f) {
  console.error('no fail', step);
  process.exit(1);
}
const L = ensure(stripDisplayIfConditions(f.left));
const R = ensure(stripDisplayIfConditions(f.right));
console.log('step', step, 'startD', dist(L, R));
console.log('L', L.slice(0, 160));
console.log('R', R.slice(0, 160));

// Hand candidates for pull Oc / R
const cands: string[] = [];
const add = (s: string, label: string) => {
  const e = ensure(s);
  if (e === L) return;
  cands.push(e);
  const id = justify(L, e);
  console.log(label, id ?? 'NO', 'd', dist(e, R), e.slice(0, 120));
};

// pull one Oc (m Oc m1) from equal Bb arms
add(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m \\Oc m_1,([^}]*)\}\{,m \\Oc m_1,([^}]*)\}/,
    'm \\Oc m_1,\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
  ),
  'pull mOc'
);
add(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m \\Oc m_1,n \\Oc n_1,([^}]*)\}\{,m \\Oc m_1,n \\Oc n_1,([^}]*)\}/,
    'm \\Oc m_1,n \\Oc n_1,\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
  ),
  'pull both Oc'
);
add(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m \\Oc m_1,n \\Oc n_1,R\(m_1\),R\(n_1\),([^}]*)\}\{,m \\Oc m_1,n \\Oc n_1,R\(m_1\),R\(n_1\),([^}]*)\}/,
    'm \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
  ),
  'pull Oc+R'
);
// after Oc out, reorder Oc to front
add(
  L.replace(
    /,i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),\\Bb\{i_1 \\Ps j_1\}\{,m \\Oc m_1,n \\Oc n_1,/,
    ',m \\Oc m_1,n \\Oc n_1,i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,'
  ).replace(
    /\}\{,m \\Oc m_1,n \\Oc n_1,/,
    '}{,'
  ),
  'hack reorder+strip'
);

// For step 4: pull R
add(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,R\(m_1\),R\(n_1\),([^}]*)\}\{,R\(m_1\),R\(n_1\),([^}]*)\}/,
    'R(m_1),R(n_1),\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
  ),
  'pull R both'
);
add(
  L.replace(/\\Bb\{i_1 \\Ps j_1\}\{,R\(m_1\),([^}]*)\}\{,R\(m_1\),([^}]*)\}/, 'R(m_1),\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'),
  'pull Rm1'
);

// For step 6: push R into arms
add(
  L.replace(
    /,R\(i_1\),R\(j_1\),\\Bb\{m_1 \\Ps n_1\}\{,/,
    ',\\Bb{m_1 \\Ps n_1}{,R(i_1),R(j_1),'
  ).replace(
    /\}\{,\\Bb\{i_1 \\Ps j_1\}/,
    '}{,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}'
  ),
  'push R both arms rough'
);

// For step 7: push Oc
add(
  L.replace(
    /,i \\Oc i_1,j \\Oc j_1,\\Bb\{m_1 \\Ps n_1\}\{,R\(i_1\),R\(j_1\),/,
    ',\\Bb{m_1 \\Ps n_1}{,i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),'
  ),
  'push Oc rough'
);

// For step 9: fold
add(
  L.replace(
    /i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),\\Bb\{i_1 \\Ps j_1\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}/g,
    '\\Bb{i \\Pc j}{,$1}{,$2}'
  ),
  'fold Pc both'
);

// also try oneStep from key rules
const keyIds = [
  'theorems-of-identical-node-comparison-12-mcnlbif',
  'theorems-of-identical-node-comparison-15-mslbifi',
  'recursive-function-r-17-ibifm',
  'thm-R-i-result',
  'rules-of-node-connectivity-0-lbificj',
  'rules-of-node-connectivity-4-icjici',
  'swap-release-release',
];
console.log('\n--- oneStep from key rules ---');
for (const id of keyIds) {
  const rule = prior.find((r) => r.id === id);
  if (!rule) {
    console.log('missing', id);
    continue;
  }
  let rewrites: string[] = [];
  try {
    rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  const good = [];
  for (const raw of rewrites) {
    const e = ensure(raw);
    if (e === L) continue;
    if (!checkInferenceRules(L, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) continue;
    const d = dist(e, R);
    if (e === R || d < dist(L, R)) good.push({ d, e });
  }
  good.sort((a, b) => a.d - b.d);
  console.log(id, 'rewrites', rewrites.length, 'closer', good.length);
  for (const g of good.slice(0, 3)) console.log(' ', g.d, g.e.slice(0, 140));
}
