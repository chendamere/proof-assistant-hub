/** Probe 124 s23 case-split: Bb+shell → true-arm flat. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 124;
console.log('building index…');
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
// Prefer post-flag L if present as s23
const f23 = fails.find((x) => x.key.includes('::124::') && x.step === 23)!;
let L = ensure(f23.left);
const R = ensure(f23.right);
console.log('L', L);
console.log('R', R);

// Path attempt: bubble Os next to Oc, create-copy drop shell, null-54
const steps: [string, string][] = [];

// 1. Move i1 Os next to i Oc i1 (currently after Bb)
{
  const next = L.replace(
    ',i_2 \\Os,i_1 \\Os,j_1 \\Os,',
    ',i_1 \\Os,i_2 \\Os,j_1 \\Os,'
  );
  steps.push(['bubble i1 Os left of i2 Os', next]);
}
// Try: put i1 Os right after i Oc i1
{
  const next = ensure(
    L.replace(',i \\Oc i_1,j \\Oc j_1,', ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,').replace(
      ',i_2 \\Os,i_1 \\Os,j_1 \\Os,',
      ',i_2 \\Os,j_1 \\Os,'
    )
  );
  steps.push(['move i1 Os next to i Oc i1', next]);
}
{
  const next = ensure(
    L.replace(',i \\Oc i_1,j \\Oc j_1,', ',i \\Oc i_1,j \\Oc j_1,j_1 \\Os,').replace(
      ',i_2 \\Os,i_1 \\Os,j_1 \\Os,',
      ',i_2 \\Os,i_1 \\Os,'
    )
  );
  steps.push(['move j1 Os next to j Oc', next]);
}

// null-54 style with outer Pu injected
{
  const withOuter = ensure(
    L.replace(
      ',i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}',
      ',i \\Oc i_1,j \\Oc j_1,i \\Pu,\\Bb{i \\Pu}'
    )
  );
  steps.push(['inject outer i Pu', withOuter]);
  const collapsed = ensure(
    withOuter.replace(
      /i \\Pu,\\Bb\{i \\Pu\}\{,i \\Pu,([^}]*)\}\{,i \\nPu,[^}]*\},/,
      'i \\Pu,$1,'
    )
  );
  steps.push(['null-54 collapse (from withOuter target)', collapsed]);
}

// Direct null-54 from L? (no outer Pu)
{
  const collapsed = ensure(
    L.replace(
      /\\Bb\{i \\Pu\}\{,i \\Pu,([^}]*)\}\{,i \\nPu,[^}]*\},/,
      '$1,'
    )
  );
  steps.push(['direct drop Bb keep true body', collapsed]);
}

for (const [label, nxt] of steps) {
  if (nxt === L) {
    console.log(label, 'SKIP same');
    continue;
  }
  console.log(label, '=>', justify(L, nxt) ?? 'FAIL');
}

// Multi-hop: move i1 Os adjacent then create-copy
console.log('\n--- multi-hop ---');
let cur = L;
function hop(nextRaw: string, label: string) {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL');
  if (!j) return false;
  cur = next;
  return true;
}

if (
  hop(
    cur.replace(',i \\Oc i_1,j \\Oc j_1,', ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,').replace(
      ',i_2 \\Os,i_1 \\Os,j_1 \\Os,',
      ',i_2 \\Os,j_1 \\Os,'
    ),
    'A i1 Os adjacent'
  )
) {
  hop(cur.replace(',i \\Oc i_1,i_1 \\Os,', ','), 'B drop i Oc+Os');
}
cur = L;
if (
  hop(
    cur
      .replace(',i \\Oc i_1,j \\Oc j_1,', ',i \\Oc i_1,j \\Oc j_1,j_1 \\Os,')
      .replace(',i_2 \\Os,i_1 \\Os,j_1 \\Os,', ',i_2 \\Os,i_1 \\Os,'),
    'C j1 Os adjacent'
  )
) {
  // continue
}

// Can null-54 apply inside larger expr if i Pu is first atom of true arm and we rearrange?
// Try: pull i Pu out of both arms? false has nPu not Pu.
// Try reverse thm-Pu-branch-prop on true only - no.

// Check null-54 on a minimal example
const miniL = ensure(',i \\Pu,\\Bb{i \\Pu}{,i \\Pu,a,}{,i \\nPu,b,},');
const miniR = ensure(',i \\Pu,i \\Pu,a,');
console.log('\nmini null-54', justify(miniL, miniR));

const miniL2 = ensure(
  ',i \\Oc i_1,i \\Pu,\\Bb{i \\Pu}{,i \\Pu,a,}{,i \\nPu,b,},i_1 \\Os,'
);
const miniR2 = ensure(',i \\Oc i_1,i \\Pu,i \\Pu,a,i_1 \\Os,');
console.log('mini null-54 with shell', justify(miniL2, miniR2));
