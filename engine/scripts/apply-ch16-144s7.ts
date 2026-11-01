/**
 * 144 s7: fold expanded nPb witness under i Pu.
 * Chain: take-true → pull Os → create-id → null-4 → (drop Or) → expand/fold nPb via subnode-7.
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
const pos = CO.indexOf(CHAPTER) * 100000 + 144;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (BLOCK.has(rule.id)) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const L = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R = ensure(',i \\Pu,i \\nPb t,');
const chain = [
  L,
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'), // take true
  ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},'), // pull Os
  ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},'), // create-id
  ensure(',i \\Pu,\\Or,'), // null-4
  ensure(',i \\Pu,'), // drop Or ???
  ensure(',i \\Pu,\\Bb{i \\Pu}{,}{,i \\Ob t,t \\nPc t,t \\Os,},'), // reverse take / expand scaffold
  R, // subnode-7 fold
];

console.log('Verify chain:');
for (let i = 0; i < chain.length - 1; i++) {
  const r = j(chain[i]!, chain[i + 1]!);
  console.log(`  [${i}]->[${i + 1}]`, r ?? 'NULL', chain[i + 1]!.slice(0, 80));
}

// Probe drop Or
const tOr = ensure(',i \\Pu,\\Or,');
const tPu = ensure(',i \\Pu,');
console.log('\nDrop Or probes:');
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Or/.test(r.leftSide + r.rightSide)) continue;
  if (r.leftSide.length > 60) continue;
  if (
    checkInferenceRules(tOr, tPu, r.leftSide, r.rightSide, { dagCache: index.dagCache }).match
  ) {
    console.log('HIT', r.id, r.leftSide, '↔', r.rightSide);
  }
}

// Skip Or: t1d -> tPu directly?
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
console.log('t1d->tPu', j(t1d, tPu));
console.log('t1d->R', j(t1d, R));
console.log('tPu->R', j(tPu, R));

const s7 = ensure(',i \\Pu,\\Bb{i \\Pu}{,}{,i \\Ob t,t \\nPc t,t \\Os,},');
console.log('tPu->s7', j(tPu, s7));
console.log('s7->R', j(s7, R));

// Maybe nPb fold from t1d via subnode-2: i nPb ↔ Bb{i Pb}{Or}{}
const via2 = ensure(',i \\Pu,\\Bb{i \\Pb t}{,\\Or,}{,},');
console.log('t1d->via2', j(t1d, via2));
console.log('via2->R', j(via2, R));
console.log('R->via2', j(R, via2));
