/** Probe Os reorder for thm24 s8 with nested-aware swaps. */
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
function charDist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
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

const fails = fs.readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8').trim().split(/\n/).map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 8);
const L = ensure(stripDisplayIfConditions(f.left));
const R = ensure(stripDisplayIfConditions(f.right));
console.log('startD', charDist(L, R));
console.log('L arm sample', L.match(/\\Bb\{i_1 \\Ps j_1\}\{[^]*?\}\{[^]*?\}/)?.[0]?.slice(0, 120));
console.log('R arm sample', R.match(/\\Bb\{i_1 \\Ps j_1\}\{[^]*?\}\{[^]*?\}/)?.[0]?.slice(0, 120));

// global replace of Os order in all innermost arms
const mid = ensure(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,/g,
    '\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os,'
  )
);
console.log('global replace == goal?', mid === R);
console.log('global justify', justify(L, mid));
console.log('global d', charDist(mid, R));

// one adjacent swap in all 4 arms simultaneously: m1 Os <-> n1 Os? or n1 Os <-> i1 Os
const swap1 = ensure(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,/g,
    '\\Bb{i_1 \\Ps j_1}{,m_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os,'
  )
);
console.log('swap n1/i1 all arms justify', justify(L, swap1), 'd', charDist(swap1, R));

const swap2 = ensure(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,/g,
    '\\Bb{i_1 \\Ps j_1}{,n_1 \\Os,m_1 \\Os,i_1 \\Os,j_1 \\Os,'
  )
);
console.log('swap m1/n1 all arms justify', justify(L, swap2), 'd', charDist(swap2, R));

// swap only first occurrence
const one = L.replace(
  /\\Bb\{i_1 \\Ps j_1\}\{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,/,
  '\\Bb{i_1 \\Ps j_1}{,m_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os,'
);
console.log('one arm swap justify', justify(L, ensure(one)), 'd', charDist(ensure(one), R));

// swap-release-release rewrites
const srr = prior.find((r) => r.id === 'swap-release-release')!;
const rw = oneStepRewrites(L, srr.leftSide, srr.rightSide);
console.log('srr rewrites', rw.length);
let bestD = charDist(L, R);
for (const raw of rw) {
  const e = ensure(raw);
  if (!checkInferenceRules(L, e, srr.leftSide, srr.rightSide).match) continue;
  const d = charDist(e, R);
  if (d < bestD) {
    bestD = d;
    console.log('better srr d', d, e.match(/\\Bb\{i_1 \\Ps j_1\}\{,[^}]{0,80}/)?.[0]);
  }
}
