/** Probe structural fails 108 s117 / 124 s22. */
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));

function probe(thm: number, step: number) {
  const fails = fs
    .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
    .trim()
    .split(/\n/)
    .map((l) => JSON.parse(l));
  const f = fails.find((x) => x.key.includes(`::${thm}::`) && x.step === step)!;
  const pos = 13 * 100000 + thm;
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
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n====', thm, 's' + step, '====');
  console.log('L', L);
  console.log('R', R);

  // Candidate structural rewrites for Bb cond→arms
  const cands: [string, string][] = [];
  // Bb{a Ps b}{T}{F} → Bb{}{a Ps b, T}{a nPs b, F}
  {
    const re =
      /\\Bb\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}\{,([^}]*)\}\{,([^}]*)\}/;
    const m = L.match(re);
    if (m) {
      const next = L.replace(
        re,
        `\\Bb{}{,${m[1]} \\Ps ${m[2]},${m[3]}}{,${m[1]} \\nPs ${m[2]},${m[4]}}`
      );
      cands.push(['Bb Ps → empty cond + Ps/nPs arms', next]);
    }
  }
  // reverse
  {
    const re =
      /\\Bb\{\}\{,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),([^}]*)\}\{,\1 \\nPs \2,([^}]*)\}/;
    const m = L.match(re);
    if (m) {
      const next = L.replace(re, `\\Bb{${m[1]} \\Ps ${m[2]}}{,${m[3]}}{,${m[4]}}`);
      cands.push(['empty Bb → cond Ps', next]);
    }
  }
  // Bb{i Pu}{T}{F} with flags
  {
    const re = /\\Bb\{([A-Za-z][A-Za-z0-9_]*) \\Pu\}\{,([^}]*)\}\{,([^}]*)\}/;
    const m = L.match(re);
    if (m) {
      cands.push([
        'add Pu/nPu flags',
        L.replace(re, `\\Bb{${m[1]} \\Pu}{,${m[1]} \\Pu,${m[2]}}{,${m[1]} \\nPu,${m[3]}}`),
      ]);
      cands.push(['drop empty Bb Pu wrapper', L.replace(re, `,${m[2]},`)]);
    }
  }
  // flat → wrap Bb{i Pu}
  if (!/\\Bb\{/.test(L) && /\\Bb\{/.test(R)) {
    cands.push(['hint: R introduces Bb', R]);
  }

  for (const [label, nxt] of cands) {
    console.log(label, '=>', justify(L, ensure(nxt)) ?? 'FAIL');
    if (ensure(nxt) !== R && justify(L, ensure(nxt))) {
      console.log('  then to R', justify(ensure(nxt), R) ?? 'FAIL');
    }
  }

  // Search rules that rewrite Bb condition
  console.log('rules touching Bb empty cond:');
  for (const r of allRules) {
    if (r.pos >= pos) continue;
    if (!/\\Bb\{\}/.test(r.leftSide + r.rightSide) && !/\\Bb\{\s*\}/.test(r.leftSide + r.rightSide))
      continue;
    if (/\\Ps/.test(r.leftSide + r.rightSide) || /\\Pu/.test(r.leftSide + r.rightSide)) {
      console.log(r.id);
      console.log(' L', r.leftSide);
      console.log(' R', r.rightSide);
    }
  }
}

probe(108, 117);
probe(108, 403);
probe(124, 22);
probe(124, 23);
