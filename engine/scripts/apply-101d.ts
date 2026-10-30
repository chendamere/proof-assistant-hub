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
  return ensure(expr).replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
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
const chain: string[] = [];
let cur = L;
function hop(nextRaw: string, label: string) {
  const e = ensure(nextRaw);
  const id = just(cur, e);
  console.log(label, id);
  if (!id) throw new Error('fail ' + label + ' ' + nextRaw.slice(0, 80));
  chain.push(e);
  cur = e;
}

hop(L.replace(/\\Bb\{j_2 \\Ps j_1\}\{,\}\{,\\Or,\},/, 'j_2 \\Ps j_1,'), 'collapse');
hop(cur.replace(/,j_2 \\Ps j_1,/, ',j_1 \\Ps j_2,'), 'flip');
hop(cur.replace('R(j_2),R(j_1),j_1 \\Ps j_2', 'R(j_1),R(j_2),j_1 \\Ps j_2'), 'swapR');
hop(cur.replace('j_1 \\Ps j_2,R(j_1),R(j_2),j_1 \\Ps j_2', 'j_1 \\Ps j_2,R(j_1),R(j_2)'), 'drop');
hop(cur.replace('R(j_1),R(j_2)', 'R(j_2),R(j_1)'), 'swapRback');
hop(cur.replace('\\Bb{i_2 \\Ps j_2}{,j_2 \\Os,i_2 \\Os,', '\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,'), 'trueOs');

// False arm Os: j_1,i_1,j_2,i_2 → i_2,j_2,i_1,j_1 via adjacent swaps (bubble sort)
// Sequence: 
// j1 i1 j2 i2
// j1 j2 i1 i2 (swap i1-j2)
// j1 j2 i2 i1
// j1 i2 j2 i1
// i2 j1 j2 i1
// i2 j1 i1 j2? no
// Better target-aware bubbles:
const falseGoal = 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os';
for (let step = 0; step < 16; step++) {
  const m = cur.match(/\}{,(j_1 \\Os,i_1 \\Os,j_2 \\Os,i_2 \\Os|[^,]+\\Os,[^,]+\\Os,[^,]+\\Os,[^,]+\\Os),\\Tc c_2/);
  const arm = m?.[1];
  if (!arm) {
    console.log('no false arm match', cur.match(/\}{,([^}]*\\Tc c_2)/)?.[1]);
    break;
  }
  if (arm === falseGoal) break;
  const toks = arm.split(',');
  // find a swap that improves positions toward goal
  const goalToks = falseGoal.split(',');
  let best: { expr: string; d: number } | null = null;
  for (let i = 0; i < toks.length - 1; i++) {
    const sw = toks.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    const newArm = sw.join(',');
    const next = ensure(cur.replace(`}{,${arm},\\Tc c_2`, `}{,${newArm},\\Tc c_2`));
    if (!just(cur, next)) continue;
    let d = 0;
    for (let k = 0; k < sw.length; k++) d += Math.abs(k - goalToks.indexOf(sw[k]!));
    if (!best || d < best.d) best = { expr: next, d };
  }
  if (!best) {
    console.log('cannot bubble false arm', arm);
    break;
  }
  console.log('false bubble', just(cur, best.expr), best.d);
  chain.push(best.expr);
  cur = best.expr;
}

console.log('done', cur === R, just(cur, R));
if (cur !== R && !just(cur, R)) {
  console.log('INCOMPLETE');
  console.log(cur.slice(-120));
  console.log(R.slice(-120));
  process.exit(1);
}
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
