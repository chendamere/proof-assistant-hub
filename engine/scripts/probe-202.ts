/** Probe 202: strip j Oc j_2 / R(j_2) / j_2 Os from both Blb arms. */
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
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

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
const pos = 13 * 100000 + 202;
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
const f = fails.find((x) => x.key.includes('::202::'))!;
const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);

// Candidate hops
const cands: [string, string][] = [
  [
    'equalize false: drop R(j2) via reverse? try bubble R next to j2 Os',
    L.replace(
      '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
      '{,j \\Oc j_2,j_1 \\Os,R(j_2),j_2 \\Os,i_1 \\Os,}'
    ),
  ],
  [
    'true: bubble j Oc j2 next to j2 Os',
    L.replace(
      '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}',
      '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}'
    ),
  ],
  [
    'pull true j Oc j2 + j2 Os out via identical-15 style?',
    L.replace(
      '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
      'j \\Oc j_2,j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}'
    ),
  ],
  [
    'equalize arms: add R(j2) to true via reverse release',
    L.replace(
      '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}',
      '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}'
    ),
  ],
  [
    'equalize false reorder to match true order + R',
    L.replace(
      '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
      '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}'
    ),
  ],
  [
    'drop create-copy on true: j Oc j2, j2 Os',
    L.replace('{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}', '{,i_1 \\Os,j_1 \\Os,}'),
  ],
  [
    'drop whole false extras',
    L.replace(
      '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
      '{,j_1 \\Os,i_1 \\Os,}'
    ),
  ],
];

for (const [label, nxt] of cands) {
  if (nxt === L) {
    console.log('SKIP', label);
    continue;
  }
  console.log(label, '=>', justify(L, nxt) ?? 'FAIL');
}

// List rules that mention Oc and Os and R together (shrink)
console.log('\n--- shrink Oc/Os/R rules ---');
for (const r of allRules) {
  if (r.pos >= pos) continue;
  const both = r.leftSide + r.rightSide;
  if (!/\\Oc/.test(both) || !/\\Os/.test(both)) continue;
  if (!/\bR\(/.test(both) && !/R\\_\(/.test(both) && !/R_\(/.test(both)) continue;
  if (r.rightSide.length <= r.leftSide.length + 5) {
    console.log(r.id);
    console.log(' L', r.leftSide);
    console.log(' R', r.rightSide);
  }
}

// Try: equalize by inserting R(j2) into true arm (reverse R-release)
const withR = L.replace(
  '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}',
  '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}'
);
console.log('\ninsert R(j2) true', justify(L, withR) ?? 'FAIL');
if (justify(L, withR)) {
  const eq = withR.replace(
    '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
    '{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}'
  );
  console.log('reorder false', justify(withR, eq) ?? 'FAIL');
  // pull j Oc j2, R(j2), j2 Os via identical-15?
  const pulled = eq.replace(
    '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}',
    'j \\Oc j_2,R(j_2),j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
  );
  console.log('pull triple', justify(eq, pulled) ?? 'FAIL');
  // drop via create-copy style with R?
  const dropped = ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_1,R\\_(j_1),\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
  );
  console.log('direct drop from eq', justify(eq, dropped) ?? 'FAIL');
  console.log('goal match', dropped === R, justify(pulled, R) ?? 'n/a');
}
