/**
 * Apply known complete chains for stubborn ch14 gaps (108 empty-branch→bubble, etc.).
 */
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
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(expr)
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

const bb =
  '\\Bb{i_2 \\Ps m_2}{,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_1,}{,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_2,},';
const prefix = ',i \\Oc i_1,R(i_1),j \\Oc j_1,R(j_1),j \\Oc j_2,';
const L = ensure(
  ',i \\Oc i_1,R(i_1),j \\Oc j_1,R(j_1),i_1 \\Ps j_1,j \\Oc j_2,i \\Oc i_2,R(i_2),R(j_2),i_1 \\Os,m \\Oc m_2,R(m_2),\\Bb{}{,i_2 \\Ps m_2,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_1,}{,i_2 \\nPs m_2,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_2,},'
);
const chain = [
  ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_1,R(j_1),i_1 \\Ps j_1,j \\Oc j_2,i \\Oc i_2,R(i_2),R(j_2),i_1 \\Os,m \\Oc m_2,R(m_2),' +
      bb
  ),
  ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_1,R(j_1),j \\Oc j_2,i_1 \\Ps j_1,i \\Oc i_2,R(i_2),R(j_2),i_1 \\Os,m \\Oc m_2,R(m_2),' +
      bb
  ),
  ensure(`${prefix}i_1 \\Ps j_1,i \\Oc i_2,R(j_2),R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}i_1 \\Ps j_1,R(j_2),i \\Oc i_2,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}R(j_2),i_1 \\Ps j_1,i \\Oc i_2,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}R(j_2),i \\Oc i_2,i_1 \\Ps j_1,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  // goal is last book step — omit
];

const pos = 13 * 100000 + 108;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function justify(a: string, b: string) {
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

let prev = L;
for (let i = 0; i < chain.length; i++) {
  const id = justify(prev, chain[i]!);
  console.log('hop', i, id);
  if (!id) {
    console.error('unjustified');
    process.exit(1);
  }
  prev = chain[i]!;
}
const goal = ensure(`${prefix}R(j_2),i \\Oc i_2,R(i_2),i_1 \\Ps j_1,i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`);
console.log('last→goal', justify(prev, goal));

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
let hitEnd = -1;
let trail = '\\\\\\\\';
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
    hitEnd = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
    console.log('anchor', i + 1, '-', end + 1);
    break;
  }
}
if (hitEnd < 0) {
  console.error('NO ANCHOR');
  process.exit(1);
}
const block = chain.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
lines.splice(hitEnd + 1, 0, ...block);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted', block.length);
