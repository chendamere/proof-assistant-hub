/** Probe null-54/55 and shell-drop path for 124 s24 / s90. */
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
console.log('rules', index.rules?.length ?? 'n/a');
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::124::') && (x.step === 24 || x.step === 90 || x.step === 99 || x.step === 96 || x.step === 93));

for (const f of fails) {
  console.log('\n======== s' + f.step + ' ========');
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('direct', justify(L, R) ?? 'FAIL');

  const cands: Array<[string, string]> = [];

  // null-54 after putting i Pu in front and dropping shell
  cands.push([
    'drop Os then null54?',
    L.replace(/,i_2 \\Os,i_1 \\Os,j_1 \\Os,$/, ','),
  ]);
  cands.push([
    'add i Pu front',
    L.replace(/^,i \\Oc i_1,/, ',i \\Pu,i \\Oc i_1,'),
  ]);
  cands.push([
    'null54 with shell kept aspirational',
    ensure(
      ',i \\Pu,i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}{,i \\nPu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),},i_2 \\Os,i_1 \\Os,j_1 \\Os,'
    ),
  ]);

  // bubble i1 Os next to i Oc i1 then create-copy
  cands.push([
    'bubble i1 Os to Oc',
    L.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}(\{[^}]*\}\{[^}]*\}),i_2 \\Os,i_1 \\Os,j_1 \\Os,/,
      ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}$1,i_2 \\Os,j_1 \\Os,'
    ),
  ]);
  cands.push([
    'create-copy drop i Oc i1 + i1 Os (after bubble)',
    ensure(
      L.replace(
        /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}(\{[^}]*\}\{[^}]*\}),i_2 \\Os,i_1 \\Os,j_1 \\Os,/,
        ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}$1,i_2 \\Os,j_1 \\Os,'
      ).replace(/,i \\Oc i_1,i_1 \\Os,/, ',')
    ),
  ]);

  // drop empty Bb (s99)
  cands.push(['drop empty Bb', L.replace(/,\\Bb\{i \\Pu\}\{,\}\{,\},/, ',')]);
  cands.push(['drop empty Bb2', L.replace(/j \\Oc j_1,\\Bb\{i \\Pu\}\{,\}\{,\},/, 'j \\Oc j_1,')]);

  // pull equal i1 Os (s96)
  cands.push([
    'pull i1 Os equal arms',
    L.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}\{,i_1 \\Os,([^}]*)\}\{,i_1 \\Os,\1\},/,
      ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,$1}{,$1},'
    ),
  ]);

  // s93: move i Ps i1 into Oc then Os into arms differently
  cands.push([
    's93 copy-id style',
    L.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}\{,i \\Ps i_1,/,
      ',i \\Oc i_1,i \\Ps i_1,j \\Oc j_1,\\Bb{i \\Pu}{,'
    ),
  ]);

  // reverse merge s90: wrap body into Bb
  if (f.step === 90) {
    cands.push([
      's90 direct wrap?',
      R, // try justify L→R already done
    ]);
    // stepwise: add empty Bb then fill? 
    cands.push([
      'add empty Bb shell',
      ensure(
        ',i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{,}{,},i_2 \\Os,i_1 \\Os,j_1 \\Os,i \\nPu,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,'
      ),
    ]);
  }

  for (const [label, raw] of cands) {
    const e = ensure(raw);
    if (e === L) {
      console.log(label, 'NOCHANGE');
      continue;
    }
    const j = justify(L, e);
    console.log(label, j ?? 'FAIL', e === R ? '(=R)' : '');
    if (j && e !== R) {
      const j2 = justify(e, R);
      if (j2) console.log('  then→R', j2);
    }
  }
}
