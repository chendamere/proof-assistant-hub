import fs from 'fs';
import pathMod from 'path';
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
const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
const texPath = pathMod.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string): string {
  let body = ensure(expr);
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const pos = 13 * 100000 + 100;
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < pos),
  new Map()
);
function just(a: string, b: string) {
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (rule.id.includes('equiv-code')) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync(pathMod.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::100::') && x.step === 101)!;
const L = ensure(f.left);
const R = ensure(f.right);

const m1 = ensure(L.replace(/\\Bb\{j_2 \\Ps j_1\}\{,\}\{,\\Or,\},/, 'j_2 \\Ps j_1,'));
const m2 = ensure(m1.replace(/,j_2 \\Ps j_1,/, ',j_1 \\Ps j_2,'));
// Drop the trailing duplicate after R pair (keep the earlier j_1 Ps j_2)
const m3 = ensure(m2.replace(/(j_1 \\Ps j_2,R\(j_2\),R\(j_1\),)j_1 \\Ps j_2,/, '$1'));

console.log('L→m1', just(L, m1));
console.log('m1→m2', just(m1, m2));
console.log('m2→m3', just(m2, m3));
console.log('m3==R', m3 === R, 'm3→R', just(m3, R));
console.log('m3 Bb', m3.match(/\\Bb\{i_2 \\Ps j_2\}\{[^}]+\}/)?.[0]);
console.log('R  Bb', R.match(/\\Bb\{i_2 \\Ps j_2\}\{[^}]+\}/)?.[0]);

let cur = m3;
const chain = [m1, m2, m3];
// Align Os order inside Bb arms toward R with adjacent Os swaps
for (let step = 0; step < 20 && cur !== R; step++) {
  const swaps = [
    ['j_2 \\Os,i_2 \\Os', 'i_2 \\Os,j_2 \\Os'],
    ['i_2 \\Os,j_2 \\Os', 'j_2 \\Os,i_2 \\Os'],
    ['j_1 \\Os,i_1 \\Os', 'i_1 \\Os,j_1 \\Os'],
    ['i_1 \\Os,j_1 \\Os', 'j_1 \\Os,i_1 \\Os'],
    ['j_1 \\Os,i_1 \\Os,j_2 \\Os,i_2 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'],
    ['j_1 \\Os,i_1 \\Os,j_2 \\Os,i_2 \\Os', 'i_1 \\Os,j_1 \\Os,i_2 \\Os,j_2 \\Os'],
    ['j_2 \\Os,i_2 \\Os,i_1 \\Os,j_1 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'],
    ['i_2 \\Os,j_2 \\Os,j_1 \\Os,i_1 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'],
  ] as const;
  let moved = false;
  for (const [a, b] of swaps) {
    if (!cur.includes(a)) continue;
    const next = ensure(cur.replace(a, b));
    if (next === cur) continue;
    if (!just(cur, next)) continue;
    // prefer moves that increase match with R
    const better =
      next === R ||
      [...next].filter((c, i) => c === R[i]).length >= [...cur].filter((c, i) => c === R[i]).length;
    if (!better && next !== R) continue;
    chain.push(next);
    cur = next;
    moved = true;
    console.log('os', just(chain[chain.length - 2]!, cur), cur === R);
    break;
  }
  if (!moved) {
    console.log('stuck', cur.slice(120, 260));
    console.log('want', R.slice(120, 260));
    break;
  }
}

if (cur === R || just(cur, R)) {
  const mids = cur === R ? chain.slice(0, -1) : chain;
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(f.left);
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(joined) === want) {
      const tm = lines[end]!.match(/(\\+)\s*$/);
      const trail = tm ? tm[1]! : '\\\\\\\\';
      const block = mids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
      lines.splice(end + 1, 0, ...block);
      fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
      console.log('inserted', block.length);
      process.exit(0);
    }
  }
  console.log('NO ANCHOR');
} else {
  console.log('incomplete');
}
