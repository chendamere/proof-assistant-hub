/** Apply 108 s359: fold Pc then pull equal-arm j_2 Os. */
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const pos = 13 * 100000 + 108;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  dag
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
const f = fails.find((x) => x.key.includes('::108::') && x.step === 359)!;
const L = ensure(f.left);
const R = ensure(f.right);

let cur = L;
const mids: string[] = [];
function hop(nextRaw: string, label: string) {
  const next = ensure(nextRaw);
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL');
  if (!j) throw new Error(label);
  if (next !== R) mids.push(next);
  cur = next;
}

hop(
  cur.replace(
    'i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
    'i \\Pc j,'
  ),
  'fold Pc'
);

// Bubble j_2 Os to front of both arms
for (const armLabel of ['true', 'false'] as const) {
  for (let step = 0; step < 6; step++) {
    const m = cur.match(/\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
    const idx = armLabel === 'true' ? 2 : 3;
    const arm = m[idx]!;
    if (arm.startsWith('j_2 \\Os,')) break;
    const toks = arm.split(',');
    const ji = toks.indexOf('j_2 \\Os');
    if (ji <= 0) break;
    const sw = toks.slice();
    [sw[ji - 1], sw[ji]] = [sw[ji]!, sw[ji - 1]!];
    const newArm = sw.join(',');
    const next =
      armLabel === 'true'
        ? cur.replace(`\\Bb{${m[1]}}{,${arm}}{,${m[3]}}`, `\\Bb{${m[1]}}{,${newArm}}{,${m[3]}}`)
        : cur.replace(`\\Bb{${m[1]}}{,${m[2]}}{,${arm}}`, `\\Bb{${m[1]}}{,${m[2]}}{,${newArm}}`);
    hop(next, `bubble ${armLabel} ${step}`);
  }
}

// Pull equal j_2 Os from both arms
{
  const pulled = ensure(
    cur.replace(
      /\\Bb\{([^}]*)\}\{,j_2 \\Os,([^}]*)\}\{,j_2 \\Os,([^}]*)\}/,
      'j_2 \\Os,\\Bb{$1}{,$2}{,$3}'
    )
  );
  hop(pulled, 'pull equal-arm j_2 Os');
}

// Bubble j_2 Os to goal position
const goalItems = topItems(R);
for (let step = 0; step < 12 && cur !== R; step++) {
  if (justify(cur, R)) {
    console.log('direct→R', justify(cur, R));
    break;
  }
  const items = topItems(cur);
  let best: { e: string; d: number } | null = null;
  for (let i = 0; i < items.length - 1; i++) {
    const sw = items.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    const e = joinItems(sw);
    if (!justify(cur, e)) continue;
    let d = 0;
    for (let k = 0; k < sw.length; k++) {
      const gi = goalItems.indexOf(sw[k]!);
      d += gi < 0 ? 10 : Math.abs(k - gi);
    }
    if (!best || d < best.d) best = { e, d };
  }
  if (!best) throw new Error('bubble stuck');
  hop(best.e, `top bubble d=${best.d}`);
}

console.log('done', cur === R || !!justify(cur, R), 'mids', mids.length);
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
