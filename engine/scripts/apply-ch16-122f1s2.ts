/**
 * 122 flat:1 s2: create-id sandwich into Bb{i Pu}, expand second connectivity
 * sandwich in false arm, bubble trailing Os past first sandwich, swap order.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
const CO = [
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
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, `src/data/theorems/${CHAPTER}.tex`);

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
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string) {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch16.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x: { key: string; step: number; part?: string }) =>
    x.key.includes('::122::') && x.step === 2 && String(x.part || '').includes('1')
)!;
const L = ensure(f.left);
const R = ensure(f.right);

const pos = CO.indexOf(CHAPTER) * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a0: string, b0: string) {
  const A = ensure(a0);
  const B = ensure(b0);
  if (A === B) return 'identity';
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const mids: string[] = [];
let cur = L;
function push(next: string, label: string) {
  const n = ensure(next);
  const id = j(cur, n);
  console.log(label, id);
  if (!id) {
    console.log('PATH FAIL at', label);
    process.exit(1);
  }
  mids.push(n);
  cur = n;
}

push(',i \\Od s_2,s_2 \\Os,' + L.slice(1), 'b1');
push(
  cur.replace(
    ',i \\Od s_2,s_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,}{,i \\Ob t_1,',
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,'
  ),
  'intoOs'
);
push(
  cur.replace(
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,',
    ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  ),
  'intoOd'
);
push(cur.replace('{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}', '{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}'), 's1');
push(cur.replace('{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}', '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'), 's2');
push(',i \\Ob t_2,t_2 \\Os,' + cur.slice(1), 'front');
push(
  cur.replace(
    ',i \\Ob t_2,t_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  ),
  'intoOsOb'
);
push(
  cur.replace(
    ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    ',\\Bb{i \\Pu}{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  ),
  'intoOb'
);
push(
  cur.replace('{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}', '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'),
  'dropTrue'
);
push(
  cur.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  ),
  'exp1'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,t_2 \\Os,s_2 \\Os,'
  ),
  'swap1'
);
push(
  cur.replace(
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,',
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},'
  ),
  'odBoth'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
  ),
  'swapOs'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},'
  ),
  'osBoth'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}',
    '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}'
  ),
  'cidTrue'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}'
  ),
  'temp1'
);
push(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
  ),
  'pulled'
);
push(cur.replace(',s_2 \\Os,t_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,s_2 \\Os,i \\Ob t_1,'), 'orderedOs');
push(cur.replace(',t_2 \\Os,s_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,i \\Ob t_1,s_2 \\Os,'), 'pastOb');
push(
  cur.replace(
    ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},'
  ),
  'intoBb'
);
push(
  cur.replace('{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,s_2 \\Os,i \\Od s_1,}'),
  'reT'
);
push(
  cur.replace('{,\\Ot s_1,s_2 \\Os,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,}'),
  'reF'
);
push(
  cur.replace(
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,},t_1 \\Os,',
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},s_2 \\Os,t_1 \\Os,'
  ),
  'midOs'
);
push(cur.replace(',s_2 \\Os,t_1 \\Os,', ',t_1 \\Os,s_2 \\Os,'), 'osEnd');
push(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},',
  'swapSand'
);
console.log('final==R', cur === R);
if (cur !== R) {
  console.log('PATH FAIL final');
  process.exit(1);
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
const anchors: number[] = [];
let trail = '\\\\';
for (let i = 0; i < lines.length; i++) {
  if (!/\\Rq/.test(lines[i]!)) continue;
  let end = i;
  const tm0 = lines[i]!.match(/(\\+)\s*$/);
  if (tm0) trail = tm0[1]!;
  while (end + 1 < lines.length) {
    const nxt = lines[end + 1]!;
    if (/\\Rq/.test(nxt)) break;
    if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
    if (!nxt.trim()) break;
    end++;
    const tm = nxt.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
  }
  const buf = lines
    .slice(i, end + 1)
    .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
    .join(' ');
  if (fingerprint(buf) === want) anchors.push(end);
  i = end;
}
let anchor = -1;
for (const a of anchors) {
  let nxt = a + 1;
  while (nxt < lines.length && !/\\Rq/.test(lines[nxt]!) && !/\\end\{math\}/.test(lines[nxt]!)) nxt++;
  if (nxt < lines.length && /t_2/.test(lines[nxt]!)) {
    anchor = a;
    break;
  }
}
if (anchor < 0 && anchors.length) anchor = anchors[anchors.length - 1]!;
if (anchor < 0) {
  console.log('NO ANCHOR want', want.slice(0, 100));
  process.exit(1);
}
console.log('anchor line', anchor + 1, 'of', anchors.length, 'matches', 'mids', mids.length);
lines.splice(anchor + 1, 0, ...mids.map((m) => `\\Rq${bookBody(m)}${trail}`));
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted');
execSync('node scripts/extract-proof-steps.js', {
  cwd: root,
  stdio: 'inherit',
  maxBuffer: 64 * 1024 * 1024,
});
console.log('extracted');
