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
function topItems(expr: string): string[] {
  const e = ensure(expr);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = e.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = e.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
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
const step = (next: string, label: string) => {
  const e = ensure(next);
  const id = just(cur, e);
  console.log(label, id);
  if (!id) throw new Error('fail ' + label);
  chain.push(e);
  cur = e;
};

step(L.replace(/\\Bb\{j_2 \\Ps j_1\}\{,\}\{,\\Or,\},/, 'j_2 \\Ps j_1,'), 'collapse Or');
step(cur.replace(/,j_2 \\Ps j_1,/, ',j_1 \\Ps j_2,'), 'flip Ps');

// Now: j_1 Ps j_2, R(j_2), R(j_1), j_1 Ps j_2
// Swap R's then r-27 drop, then swap R's back
step(cur.replace('R(j_2),R(j_1),j_1 \\Ps j_2', 'R(j_1),R(j_2),j_1 \\Ps j_2'), 'swap R for r27');
step(
  cur.replace('j_1 \\Ps j_2,R(j_1),R(j_2),j_1 \\Ps j_2', 'j_1 \\Ps j_2,R(j_1),R(j_2)'),
  'r27 drop trail'
);
step(cur.replace('R(j_1),R(j_2)', 'R(j_2),R(j_1)'), 'swap R back');

console.log('after Ps cleanup == prefix?', !cur.includes('j_1 \\Ps j_2,j_1 \\Ps'));
console.log('cur==R', cur === R);

// Os bubble inside Bb via item... arms are nested. Use string adjacent Os swaps.
for (let i = 0; i < 30 && cur !== R; i++) {
  const cands = [
    cur.replace('j_2 \\Os,i_2 \\Os', 'i_2 \\Os,j_2 \\Os'),
    cur.replace('i_2 \\Os,j_2 \\Os', 'j_2 \\Os,i_2 \\Os'),
    cur.replace('j_1 \\Os,i_1 \\Os,j_2 \\Os,i_2 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'),
    cur.replace('i_1 \\Os,j_1 \\Os,j_2 \\Os,i_2 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'),
    cur.replace('j_1 \\Os,i_1 \\Os,i_2 \\Os,j_2 \\Os', 'i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os'),
    cur.replace(',i_1 \\Os,j_1 \\Os,i_2 \\Os,j_2 \\Os,', ',i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,'),
    cur.replace(',j_1 \\Os,i_1 \\Os,j_2 \\Os,i_2 \\Os,', ',i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,'),
  ];
  let moved = false;
  let best: string | null = null;
  let bestScore = -1;
  for (const raw of cands) {
    const e = ensure(raw);
    if (e === cur) continue;
    if (!just(cur, e)) continue;
    let score = 0;
    for (let k = 0; k < Math.min(e.length, R.length); k++) if (e[k] === R[k]) score++;
    if (e === R) score = 1e9;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (!best) {
    console.log('stuck at', cur.slice(100, 280));
    console.log('want    ', R.slice(100, 280));
    break;
  }
  console.log('os hop', just(cur, best), best === R);
  chain.push(best);
  cur = best;
  moved = true;
  void moved;
}

if (cur !== R && !just(cur, R)) {
  console.log('INCOMPLETE');
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
void topItems;
void joinItems;
