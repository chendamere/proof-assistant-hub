/** Probe s28 push i2 Os into Bb with adjacency. */
import fs from 'fs';
import { dirname, join } from 'path';
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
const __dirname = dirname(fileURLToPath(import.meta.url));
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
    .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
    .trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
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
const pos = 13 * 100000 + 108;
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
function justifyVerbose(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    const r = checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
    if (r.match) hits.push(rule.id);
  }
  return hits;
}

const fails = fs
  .readFileSync(join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::108::') && x.step === 28)!;
let cur = ensure(f.left);
const R = ensure(f.right);
const path: string[] = [];
const step = (next: string, label: string) => {
  const j = justify(cur, next);
  console.log(label, j ?? 'FAIL');
  if (!j) return false;
  path.push(next);
  cur = ensure(next);
  return true;
};

// reorder
const m1 = ensure(cur.replace(',R(i_2),i_2 \\Os,R(i_1),', ',R(i_2),R(i_1),i_2 \\Os,'));
if (!step(m1, 'swap Os/R(i1)')) process.exit(1);
const m2 = ensure(cur.replace(',R(i_2),R(i_1),i_2 \\Os,', ',R(i_1),R(i_2),i_2 \\Os,'));
if (!step(m2, 'swap R')) process.exit(1);

// bubble i2 Os next to Bb
let items = topItems(cur);
const goalOrderHint = topItems(R);
console.log('cur', items);
let oi = items.indexOf('i_2 \\Os');
let bi = items.findIndex((x) => x.startsWith('\\Bb'));
console.log('oi', oi, 'bi', bi);
while (oi < bi - 1) {
  const sw = items.slice();
  const t = sw[oi]!;
  sw[oi] = sw[oi + 1]!;
  sw[oi + 1] = t;
  const e = joinItems(sw);
  if (!step(e, `bubble ${items[oi]}↔${items[oi + 1]}`)) {
    console.log('bubble stuck');
    break;
  }
  items = topItems(cur);
  oi = items.indexOf('i_2 \\Os');
  bi = items.findIndex((x) => x.startsWith('\\Bb'));
}
console.log('after bubble', items);

// try push: remove i2 Os and prepend to both arms
{
  const m = cur.match(/\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) throw new Error('no bb');
  const pushed = joinItems(
    items
      .filter((x) => x !== 'i_2 \\Os')
      .map((x) =>
        x.startsWith('\\Bb')
          ? `\\Bb{${m[1]}}{,i_2 \\Os,${m[2]}}{,i_2 \\Os,${m[3]}}`
          : x
      )
  );
  console.log('push target === R', ensure(pushed) === R);
  console.log('push hits', justifyVerbose(cur, pushed));
  console.log('push', justify(cur, pushed) ?? 'FAIL');
  // try with Blb instead?
  const asBlb = ensure(cur.replace('\\Bb{', '\\Blb{'));
  const pushedBlb = ensure(pushed.replace('\\Bb{', '\\Blb{'));
  console.log('via Blb convert', justify(cur, asBlb) ?? 'FAIL');
}

// Try null-9 reverse / empty branch wrap?
// Or copy-create style: maybe need R(m) adjacent?

// Search rules that mention Os and Bb
const osBb = allRules.filter(
  (r) =>
    r.pos < pos &&
    r.leftSide.includes('\\Os') &&
    (r.leftSide.includes('\\Bb') || r.rightSide.includes('\\Bb') || r.leftSide.includes('\\Blb'))
);
console.log(
  'Os+B rules',
  osBb.map((r) => r.id.replace(/^[^-]+-/, '')).slice(0, 40)
);
console.log('count', osBb.length);

// Minimal isolated test
const isoL = ensure(',i_2 \\Os, \\Bb{if(j_2 \\Ps m_2)}{,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,j_2 \\Os,m_2 \\Os,\\Tc c_2,},');
const isoR = ensure(
  ',\\Bb{if(j_2 \\Ps m_2)}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_2,},'
);
console.log('iso push', justify(isoL, isoR) ?? 'FAIL', justifyVerbose(isoL, isoR));

const isoL2 = ensure(',i_2 \\Os, \\Bb{j_2 \\Ps m_2}{,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,j_2 \\Os,m_2 \\Os,\\Tc c_2,},');
const isoR2 = ensure(
  ',\\Bb{j_2 \\Ps m_2}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_2,},'
);
console.log('iso no-if', justify(isoL2, isoR2) ?? 'FAIL', justifyVerbose(isoL2, isoR2));

const isoL3 = ensure(',i_2 \\Os, \\Blb{if(j_2 \\Ps m_2)}{,}{,},');
const isoR3 = ensure(',\\Blb{if(j_2 \\Ps m_2)}{,i_2 \\Os,}{,i_2 \\Os,},');
console.log('iso Blb empty arms', justify(isoL3, isoR3) ?? 'FAIL');

const isoL4 = ensure(',i_2 \\Os, \\Blb{j_2 \\Ps m_2}{,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,j_2 \\Os,m_2 \\Os,\\Tc c_2,},');
const isoR4 = ensure(
  ',\\Blb{j_2 \\Ps m_2}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_2,},'
);
console.log('iso Blb full', justify(isoL4, isoR4) ?? 'FAIL', justifyVerbose(isoL4, isoR4));
