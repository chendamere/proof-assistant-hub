/** Probe 197 s86 and 202 s67 from latest recheck (or previous). */
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
const dag = new Map();

function makeJustify(thm: number) {
  const pos = 13 * 100000 + thm;
  const index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  return (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    if (A === B) return 'spacing';
    for (const rule of getRulesForTransition(index, A, B)) {
      if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        return rule.id;
    }
    return null;
  };
}

const rows = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// --- 197 ---
{
  const f = rows.find((x) => x.key.includes('::197::'));
  if (f) {
    const justify = makeJustify(197);
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('\n==== 197 s' + f.step + ' ====');
    console.log('L', L);
    console.log('R', R);
    // Flip Blb condition j Ps i → i Ps j
    const flip = ensure(L.replace('\\Blb{j \\Ps i}', '\\Blb{i \\Ps j}'));
    console.log('flip', justify(L, flip));
    // Fold Oc+Os into empty Blb via reverse connectivity-0 / def
    // connectivity-0: Blb{if(i Pc j)}{,}{,} → i Oc i_1, j Oc j_1, R..., Blb{if(i_1 Ps j_1)}{Os}{Os}
    // Here we have i Oc i_1, j Oc j_1, Blb{j Ps i}{j_1 Os,i_1 Os}{i_1 Os,j_1 Os} without R
    // Try pull Os then fold
    const pull = ensure(
      flip.replace(
        /\\Blb\{i \\Ps j\}\{,j_1 \\Os,i_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/,
        'i_1 \\Os,j_1 \\Os,\\Blb{i \\Ps j}{,}{,}'
      )
    );
    console.log('pull Os', justify(flip, pull));
    // Drop Oc via reverse create?
    console.log(
      'drop Oc',
      justify(
        L,
        ensure(',i \\Pu,j \\Pu,\\Blb{j \\Ps i}{,j_1 \\Os,i_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}')
      )
    );
  }
}

// --- 202 ---
{
  const f = rows.find((x) => x.key.includes('::202::'));
  if (f) {
    const justify = makeJustify(202);
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('\n==== 202 s' + f.step + ' ====');
    console.log('L', L);
    console.log('R', R);
    // Bubble j Oc j_2 to front of both arms then pull
    let cur = L;
    const m = cur.match(/\\Blb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
    console.log('arms', m[2], '|', m[3]);
    // true: i_1 Os,j_1 Os,j Oc j_2,j_2 Os → want i_1 Os,j_1 Os
    // false: j Oc j_2,R(j_2),j_1 Os,j_2 Os,i_1 Os → want i_1 Os,j_1 Os
    // First reorder false arm toward having j Oc j_2, R(j_2), j_2 Os together to fold via reverse Oc expand?
    const foldFalse = ensure(
      cur.replace(
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j \\Oc j_2,R(j_2),j_2 \\Os,}'
      )
    );
    console.log('reorder false', justify(cur, foldFalse));
  }
}
