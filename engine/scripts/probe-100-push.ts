import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
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
];
const POS = 13 * 100000 + 100;
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
function toBook(expr: string) {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const all = [...axioms, ...definitions, ...theorems];
const indexed = all.map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }));
const early = indexed.filter((r) => r.pos < POS);
const index = buildRuleIndex(early, new Map());

function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

// Dump rules that push something into Bb{if(m Ps n)}
console.log('=== Bb Ps distribute rules ===');
for (const t of early) {
  const L = t.leftSide || '';
  const R = t.rightSide || '';
  if (!L.includes('\\Bb') && !R.includes('\\Bb')) continue;
  if (!/\\Ps/.test(L + R) && !/Ps/.test(L + R)) continue;
  // look for pattern: ATOM, Bb{...}{Tc}{Tc} <-> Bb{...}{ATOM, Tc}{ATOM, Tc}
  if (/\\Bb\{if\([^)]*\\Ps[^)]*\)\}\{,?\s*\\Tc/.test(R) || /\\Bb\{if\([^)]*\\Ps[^)]*\)\}\{[^}]*\\Tc/.test(R)) {
    if (/,\\s*[^,]+,\\s*\\Bb\{if/.test(L.replace(/\s+/g, ' ')) || /,\s*[^,]+\s*,\s*\\Bb\{if/.test(L)) {
      console.log(t.id);
      console.log(' L', L);
      console.log(' R', R);
    }
  }
}

// specifically search Os + Bb
console.log('\n=== any Os+Bb early ===');
for (const t of early) {
  if (!/\\Os/.test(t.leftSide + t.rightSide)) continue;
  if (!/\\Bb/.test(t.leftSide + t.rightSide)) continue;
  console.log(t.id);
  console.log(' L', t.leftSide);
  console.log(' R', t.rightSide);
}

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::100::'));

// For s4: try pull equal nested content first (identical-15 style reverse on equal arms),
// leaving outer Bb with empty-ish arms, then push Os, then push content back.
const f4 = fails.find((x) => x.step === 4)!;
const L = ensure(f4.left);
const R = ensure(f4.right);

// Strategy: factor equal arms of outer Bb
// Outer true: \Bb{i1 Ps j1}{,i1 Os,j1 Os,c1,}{,i1 Os,j1 Os,c3,}
// Outer false: i1 Os, j1 Os, c2a
// These are NOT equal — so can't pull common.

// Try: rename c2a→c2 first? 
const ren = ensure(L.replace('\\Tc c_2a,', '\\Tc c_2,'));
console.log('\nrename', justify(L, ren));

// Try push with string replace matching exact R shape but keep c2a
const midA = ensure(
  L.replace(
    ',i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},',
    ',j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},'
  )
);
console.log('push midA', justify(L, midA), midA === R);
console.log('midA→R', justify(midA, R));

// Try using empty-branch / factor: convert nested equal structure
// What if we first make false arm match by using Tc abstraction?
// Or use recursive-function-r-17 style after wrapping?

// Try: bubble i2 Os next to Bb, then apply a connectivity rule
// Already adjacent: ...,R(i2),i2 Os,j Oc j1,R(i1),R(j1),Bb
// Need i2 Os immediately before Bb
const bub1 = ensure(
  L.replace(
    ',i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb',
    ',j \\Oc j_1,R(i_1),R(j_1),i_2 \\Os,\\Bb'
  )
);
console.log('bubble Os to Bb', justify(L, bub1));
if (justify(L, bub1)) {
  const push = ensure(
    bub1.replace(
      ',i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},',
      ',\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},'
    )
  );
  console.log('  then push', justify(bub1, push));
  console.log('  push→R', justify(push, R), fingerprintClose(push, R));
}

function fingerprintClose(a: string, b: string) {
  const na = ensure(a).replace(/\\Tc c_2a,/g, '\\Tc c_2,');
  const nb = ensure(b).replace(/\\Tc c_2a,/g, '\\Tc c_2,');
  return na === nb ? 'same-after-c2norm' : 'diff';
}

// Brute: try all early prefer rules' one-step rewrites via tcSubstitution if available
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
console.log('\nTrying oneStepRewrites for s4...');
const t0 = Date.now();
const rewrites = oneStepRewrites(L, early as any, { dagCache: index.dagCache, max: 200 });
console.log('rewrites', rewrites?.length ?? 0, Date.now() - t0 + 'ms');
if (rewrites) {
  for (const rw of rewrites.slice(0, 30)) {
    const j = justify(L, rw.expr);
    const toR = rw.expr === R || !!justify(rw.expr, R);
    console.log(' rw', rw.ruleId, toR ? '→Rable' : '', ensure(rw.expr).slice(0, 100));
  }
}

// s3: insert R then how to get c2→c2a?
const f3 = fails.find((x) => x.step === 3)!;
const L3 = ensure(f3.left);
const R3 = ensure(f3.right);
const mid3 = ensure(L3.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,'));
console.log('\ns3 insert', justify(L3, mid3));
console.log('s3 mid→R', justify(mid3, R3));
// Is c2 vs c2a just display that should be ignored? Check strip
import { stripDisplayIfConditions } from '../src/inferenceRules/utils';
console.log('s3 mid fp', ensure(stripDisplayIfConditions(mid3)).includes('c_2a'), ensure(stripDisplayIfConditions(mid3)).includes('c_2'));
console.log('s3 R fp ', ensure(stripDisplayIfConditions(R3)).includes('c_2a'));
// Difference mid vs R:
console.log('mid==R?', mid3 === R3);
console.log('mid', mid3);
console.log('R  ', R3);

// s26
const f26 = fails.find((x) => x.step === 26)!;
const L26 = ensure(f26.left);
const R26 = ensure(f26.right);
const bub26 = ensure(
  L26.replace(',j_2 \\Os,R(j_1),\\Bb', ',R(j_1),j_2 \\Os,\\Bb')
);
console.log('\ns26 bubble', justify(L26, bub26));
if (justify(L26, bub26)) {
  const push26 = ensure(
    bub26.replace(
      ',j_2 \\Os,\\Bb{i_2 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
      ',\\Bb{i_2 \\Ps j_1}{,i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
    )
  );
  console.log('  push', justify(bub26, push26), push26 === R26, justify(push26, R26));
}
// direct push without bubble
const push26d = ensure(
  L26.replace(
    ',j_2 \\Os,R(j_1),\\Bb{i_2 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
    ',R(j_1),\\Bb{i_2 \\Ps j_1}{,i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
  )
);
console.log('s26 direct push', justify(L26, push26d), push26d === R26);

// s38
const f38 = fails.find((x) => x.step === 38)!;
const L38 = ensure(f38.left);
const R38 = ensure(f38.right);
console.log('\ns38 L', L38);
console.log('s38 R', R38);
const push38 = ensure(
  L38.replace(
    ',R(j_1),\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
    ',\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,R(j_1),\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,R(j_1),j_1 \\Os,\\Tc c_2,},'
  )
);
console.log('s38 push', justify(L38, push38), push38 === R38, justify(push38, R38));
