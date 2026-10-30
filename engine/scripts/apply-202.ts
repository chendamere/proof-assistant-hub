/** 202: drop j Oc j2 / R(j2) / j2 Os from both Blb arms. */
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
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function armItems(arm: string): string[] {
  const e = arm.startsWith(',') ? arm : ',' + arm;
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
function joinArm(items: string[]): string {
  return ',' + items.join(',') + (items.length ? ',' : '');
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

function loadFail() {
  for (const name of ['recheck-ch14.jsonl', 'proof-step-failures.jsonl']) {
    const p = path.join(__dirname, 'out', name);
    if (!fs.existsSync(p)) continue;
    const fails = fs
      .readFileSync(p, 'utf8')
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const f = fails.find((x: { key: string }) => x.key.includes('::202::'));
    if (f) return f as { left: string; right: string };
  }
  throw new Error('no 202');
}

const f = loadFail();
const L = ensure(f.left);
const R = ensure(f.right);

let cur = L;
const mids: string[] = [];
function hop(nextRaw: string, label: string) {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL');
  if (!j) {
    console.log(' from', cur);
    console.log(' to  ', next);
    throw new Error(label);
  }
  if (next !== R) mids.push(next);
  cur = next;
}

// 1. Drop true-arm j Oc j2, j2 Os via create-copy
hop(
  cur.replace('{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}', '{,i_1 \\Os,j_1 \\Os,}'),
  '1 drop true Oc+Os'
);

// 2. Bubble false: move R(j2) next to j2 Os (already adjacent in original after j Oc)
// Current false: j Oc j2, R(j2), j1 Os, j2 Os, i1 Os
// Want: j Oc j2, j1 Os, R(j2), j2 Os, i1 Os  OR  j Oc j2, R(j2), j2 Os, j1 Os, i1 Os
hop(
  cur.replace(
    '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
    '{,j \\Oc j_2,R(j_2),j_2 \\Os,j_1 \\Os,i_1 \\Os,}'
  ),
  '2 bubble j2 Os next to R'
);

// 3. Drop R(j2) via thm-R-i-release
hop(
  cur.replace('{,j \\Oc j_2,R(j_2),j_2 \\Os,', '{,j \\Oc j_2,j_2 \\Os,'),
  '3 drop R(j2)'
);

// 4. Drop j Oc j2, j2 Os via create-copy
hop(
  cur.replace('{,j \\Oc j_2,j_2 \\Os,j_1 \\Os,i_1 \\Os,}', '{,j_1 \\Os,i_1 \\Os,}'),
  '4 drop false Oc+Os'
);

// 5. Reorder false arm to i1 Os, j1 Os
hop(
  cur.replace('{,j_1 \\Os,i_1 \\Os,}', '{,i_1 \\Os,j_1 \\Os,}'),
  '5 reorder false'
);

console.log('cur', cur);
console.log('R  ', R);
console.log('ok', cur === R || !!justify(cur, R));
if (!(cur === R || justify(cur, R))) throw new Error('incomplete');

const finalMids = mids.filter((m) => ensure(m) !== R);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
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
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('inserted', block.length);
    process.exit(0);
  }
}
console.log('NO ANCHOR');
process.exit(1);
