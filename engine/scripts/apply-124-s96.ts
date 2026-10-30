/** 124 s96: pull i1 Os from equal Bb{i Pu} arms via reverse null-comparison-12. */
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
  let t = normalizeSpacing(fromOperatorFirst(s))
    .replace(/R_\(/g, 'R\\_(')
    .trim();
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 124;
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
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::124::') && x.step === 96);

for (const f of fails) {
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('direct', justify(L, R) ?? 'FAIL');
  console.log('L', L);
  console.log('R', R);

  // Try Blb form of condition / if form
  const variants = [
    R,
    ensure(
      L.replace(
        '\\Bb{i \\Pu}{,i_1 \\Os,',
        'i_1 \\Os,\\Bb{i \\Pu}{,'
      ).replace(
        '\\Bb{i \\Pu}{,i_1 \\Os,',
        'i_1 \\Os,\\Bb{i \\Pu}{,'
      ),
    ),
  ];
  // Proper pull: remove i1 Os from both arms, place before Bb
  const mid = ensure(
    ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},i_2 \\Os,j_1 \\Os,'
  );
  console.log('mid==R', mid === R);
  console.log('null12-rev', justify(L, mid) ?? 'FAIL');

  // Try with Blb instead of Bb in mid matching
  const Lblb = ensure(L.replace(/\\Bb\{/g, '\\Blb{'));
  const Rblb = ensure(R.replace(/\\Bb\{/g, '\\Blb{'));
  console.log('Blb direct', justify(Lblb, Rblb) ?? 'FAIL');

  // if(i Pu) form
  const Lif = ensure(L.replace('\\Bb{i \\Pu}', '\\Bb{if(i \\Pu)}'));
  const Rif = ensure(R.replace('\\Bb{i \\Pu}', '\\Bb{if(i \\Pu)}'));
  console.log('if form', justify(Lif, Rif) ?? 'FAIL');

  // Print null-12
  const n12 = allRules.find((r) => r.id.includes('null-comparison-12'));
  console.log('null12', n12?.leftSide, '⟺', n12?.rightSide);

  if (justify(L, mid) && (mid === R || justify(mid, R))) {
    // insert
    const raw = fs.readFileSync(texPath, 'utf8');
    const nl = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    const want = fingerprint(L);
    const wantR = fingerprint(R);
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
      // mid === R means direct — nothing to insert, but justify failed so can't be
      if (mid !== R) {
        lines.splice(end + 1, 0, `\\Rq${bookBody(mid)}${trail}`);
        fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
        console.log('OK inserted');
      }
      break;
    }
  }
}
