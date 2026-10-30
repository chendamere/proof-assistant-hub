/** 100 s4: bubble i2 Os to Bb then identical-15 push into arms. */
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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
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
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 100;
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
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const f = fails.find((x) => x.key.includes('::100::') && x.step === 4)!;
const L = ensure(f.left.replace(/c_2a/g, 'c_2'));
const R = ensure(f.right.replace(/c_2a/g, 'c_2'));

let items = topItems(L);
const hops: string[] = [];
let cur = L;

function swapAt(i: number) {
  const sw = items.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const e = joinItems(sw);
  const j = justify(cur, e);
  if (!j) {
    console.log('swap fail at', i, items[i], items[i + 1]);
    return false;
  }
  console.log('swap', j, items[i], '↔', items[i + 1]);
  hops.push(e);
  items = sw;
  cur = e;
  return true;
}

// Move i2 Os right until just before Bb
let oi = items.indexOf('i_2 \\Os');
const goalBeforeBb = items.length - 1; // Bb is last
while (oi < goalBeforeBb - 1) {
  if (!swapAt(oi)) break;
  oi++;
}

const pushed = ensure(
  cur.replace(
    ',i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,}',
    ',\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,}'
  )
);
console.log('push', justify(cur, pushed) ?? 'FAIL');
console.log('=R', pushed === R || justify(pushed, R));

if (justify(cur, pushed) && (pushed === R || justify(pushed, R))) {
  const mids = [...hops, ...(pushed === R ? [] : [pushed])].filter((m) => ensure(m) !== R);
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(f.left);
  const wantR = fingerprint(f.right);
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
    if (fingerprint(joined) !== want) continue;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    if (ns < lines.length && /\\Rq/.test(lines[ns]!)) {
      let ne = ns;
      while (ne + 1 < lines.length) {
        const nxt = lines[ne + 1]!;
        if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
        ne++;
      }
      const nextJoined = lines
        .slice(ns, ne + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ');
      if (fingerprint(nextJoined) !== wantR) continue;
    }
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = mids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('OK +' + block.length);
    process.exit(0);
  }
  console.log('NO ANCHOR');
}
