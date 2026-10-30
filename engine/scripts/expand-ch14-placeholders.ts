/**
 * Expand theorem-124 <1>/<2>/<3> short-form case split into full Bb-wrapped steps.
 * Fills multi-atom arm bubbles with prior-rule chains, then rewrites TeX.
 *
 *   npx tsx engine/scripts/expand-ch14-placeholders.ts
 *   npx tsx engine/scripts/expand-ch14-placeholders.ts --apply
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
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

const THM124_POS = CHAPTER_ORDER.indexOf('Rules_of_Node_Connectivity') * 100000 + 124;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: getPositionForRule(r),
}));
const prior = allRules.filter((r) => r.pos < THM124_POS);
const sharedDag = new Map();
const index = buildRuleIndex(prior, sharedDag);

const FILL_RULES = prior.filter((r) =>
  /swap|identical|null-comparison|recursive-function|release|create-next|copy-identical|thm-R|thm-Ps|operators-and-relationships|rules-of-operators|empty-branch|Ps-symmetric|flag|node-ring/i.test(
    r.id
  )
);

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

function ensureComma(s: string): string {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

function justify(from: string, to: string): string | null {
  const a = ensureComma(from);
  const b = ensureComma(to);
  if (a === b) return 'spacing';
  const toTry = getRulesForTransition(index, a, b);
  for (const rule of toTry) {
    const result = checkInferenceRules(a, b, rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    });
    if (result.match) return rule.id;
  }
  return null;
}

/** Hand-built shrinks that oneStepRewrites misses (empty-left create rules). */
function shrinkCandidates(expr: string): string[] {
  const out: string[] = [];
  // Reverse create-next-prev: drop adjacent "X \On, X \Op"
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\On,\1 \\Op(?=,)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      const next = expr.slice(0, m.index) + ',' + expr.slice(m.index + m[0].length);
      out.push(ensureComma(next));
    }
  }
  // Reverse recursive-function-r-prev-1: "X \Pu, R_(X)," → "X \Pu,"
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Pu,R\\_\(\1\),/g;
    let m: RegExpExecArray | null;
    const n = expr.replace(/R_\(/g, 'R\\_(');
    while ((m = re.exec(n))) {
      const next = n.slice(0, m.index) + `,${m[1]} \\Pu,` + n.slice(m.index + m[0].length);
      out.push(ensureComma(next));
    }
  }
  // Reverse copy-identical: "X \Oc Y, X \Ps Y," → "X \Oc Y,"
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      const next =
        expr.slice(0, m.index) + `,${m[1]} \\Oc ${m[2]},` + expr.slice(m.index + m[0].length);
      out.push(ensureComma(next));
    }
  }
  // Reverse identical-70: drop one of two adjacent identical Ps
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      const next =
        expr.slice(0, m.index) + `,${m[1]} \\Ps ${m[2]},` + expr.slice(m.index + m[0].length);
      out.push(ensureComma(next));
    }
  }
  return out;
}

function justifiedNeighbors(expr: string): Array<{ expr: string; via: string }> {
  const out: Array<{ expr: string; via: string }> = [];
  const seen = new Set<string>();
  const add = (next: string, via: string) => {
    const e = ensureComma(next);
    if (e === expr || seen.has(e)) return;
    seen.add(e);
    out.push({ expr: e, via });
  };
  for (const rule of FILL_RULES) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(expr, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensureComma(raw);
      if (e === expr) continue;
      if (
        !checkInferenceRules(expr, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
      ) {
        continue;
      }
      add(e, rule.id);
    }
  }
  for (const cand of shrinkCandidates(expr)) {
    const id = justify(expr, cand);
    if (id) add(cand, id);
  }
  return out;
}

/**
 * Beam search from `from` toward `goal`. Keeps short uphill detours
 * (duplicate-then-bubble) and checker-only shrinks.
 */
function fillArm(fromRaw: string, goalRaw: string, maxHops = 14): string[] | null {
  const goal = ensureComma(goalRaw);
  const start = ensureComma(fromRaw);
  if (start === goal) return [];
  if (justify(start, goal)) return [];

  type Node = { expr: string; path: string[]; d: number };
  let beam: Node[] = [{ expr: start, path: [], d: dist(start, goal) }];
  const seen = new Set<string>([start]);

  for (let depth = 0; depth < maxHops; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      if (justify(node.expr, goal)) return node.path;
      for (const nb of justifiedNeighbors(node.expr)) {
        if (seen.has(nb.expr)) continue;
        const d = dist(nb.expr, goal);
        if (nb.expr !== goal && d > node.d + 45) continue;
        seen.add(nb.expr);
        const path = [...node.path, nb.expr];
        if (nb.expr === goal) return path.slice(0, -1);
        next.push({ expr: nb.expr, path, d });
      }
    }
    if (next.length === 0) return null;
    next.sort((a, b) => a.d - b.d);
    // Keep some uphill duplicates: take best 24 plus any that grew a Ps count.
    const top = next.slice(0, 24);
    const extras = next
      .slice(24)
      .filter((n) => (n.expr.match(/\\Ps/g) || []).length > (start.match(/\\Ps/g) || []).length)
      .slice(0, 8);
    beam = [...top, ...extras];
  }
  return null;
}

function stripRq(line: string): string {
  return line
    .replace(/^\s*(?:<\d+>\s*)*\\Rq\s*/, '')
    .replace(/\\+\s*$/, '')
    .trim();
}

function takeBrace(s: string): { body: string; rest: string } | null {
  if (!s.startsWith('{')) return null;
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') {
      d--;
      if (d === 0) return { body: s.slice(1, i), rest: s.slice(i + 1) };
    }
  }
  return null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

const startMark = lines.findIndex((l) => /\\Rq\s*<1>/.test(l));
const endMark = lines.findIndex((l, i) => i > startMark && /^<1>\\+/.test(l.trim()));
if (startMark < 0 || endMark < 0) {
  console.error('Could not find <1> block', { startMark, endMark });
  process.exit(1);
}

let seedThen = '';
let seedElse = '';
{
  let bb = '';
  for (let i = startMark - 1; i >= Math.max(0, startMark - 5); i--) {
    bb = lines[i]! + (bb ? ' ' + bb : '');
    if (bb.includes('\\Bb{if(i \\Pu)}')) break;
  }
  const idx = bb.indexOf('\\Bb{if(i \\Pu)}');
  if (idx < 0) {
    console.error('seed Bb not found near', startMark);
    process.exit(1);
  }
  const after = bb.slice(idx + '\\Bb{if(i \\Pu)}'.length);
  const t = takeBrace(after);
  const e = t ? takeBrace(t.rest) : null;
  if (!t || !e) {
    console.error('failed to parse seed arms');
    process.exit(1);
  }
  seedThen = t.body.trim();
  seedElse = e.body.trim();
  console.log('seedThen', seedThen.slice(0, 80));
  console.log('seedElse', seedElse.slice(0, 80));
}

const puSteps: string[] = [];
const nPuSteps: string[] = [];
let mode: 'skip' | 'pu' | 'npu' = 'skip';
for (let i = startMark + 1; i < endMark; i++) {
  const line = lines[i]!;
  const trimmed = line.trim();
  if (/^<2>\\+$/.test(trimmed)) {
    mode = 'pu';
    continue;
  }
  if (/^<3>\\+$/.test(trimmed)) {
    mode = 'npu';
    continue;
  }
  if (/^<[23]>\s*\\Rq/.test(trimmed)) continue;
  if (!/\\Rq/.test(line)) continue;
  const body = stripRq(line);
  if (!body) continue;
  if (mode === 'pu') puSteps.push(body);
  else if (mode === 'npu') nPuSteps.push(body);
}
console.log('puSteps', puSteps.length, 'nPuSteps', nPuSteps.length);

type Frame = { then: string; else_: string; label: string };
const sequence: Frame[] = [{ then: seedThen, else_: seedElse, label: 'seed' }];

function expandArmChain(
  which: 'then' | 'else_',
  frozenOther: string,
  fromArm: string,
  toArm: string,
  labelPrefix: string
): boolean {
  const chain = fillArm(fromArm, toArm);
  if (chain === null) {
    console.log(`UNSOLVED ${labelPrefix} (keeping book target frame)`);
    console.log('  from', ensureComma(fromArm).slice(0, 120));
    console.log('  to  ', ensureComma(toArm).slice(0, 120));
    // Still emit the book frame so <n> placeholders are gone; gap stays for later fill.
    if (which === 'then') {
      sequence.push({ then: toArm, else_: frozenOther, label: `${labelPrefix}-gap` });
    } else {
      sequence.push({ then: frozenOther, else_: toArm, label: `${labelPrefix}-gap` });
    }
    return false;
  }
  for (let i = 0; i < chain.length; i++) {
    const mid = chain[i]!;
    if (which === 'then') {
      sequence.push({ then: mid, else_: frozenOther, label: `${labelPrefix}-mid${i + 1}` });
    } else {
      sequence.push({ then: frozenOther, else_: mid, label: `${labelPrefix}-mid${i + 1}` });
    }
  }
  if (which === 'then') {
    sequence.push({ then: toArm, else_: frozenOther, label: labelPrefix });
  } else {
    sequence.push({ then: frozenOther, else_: toArm, label: labelPrefix });
  }
  const via = chain.length === 0 ? 'direct' : `+${chain.length} mids`;
  console.log(`OK ${labelPrefix} ${via}`);
  return true;
}

const fast = process.argv.includes('--fast');
let thenCur = seedThen;
let elseCur = seedElse;
let allOk = true;

for (let i = 0; i < puSteps.length; i++) {
  const next = puSteps[i]!;
  if (fast) {
    // Skip expensive search; emit book frames only (still strips <n>).
    const direct = justify(ensureComma(thenCur), ensureComma(next));
    if (direct) console.log(`OK pu-${i + 1} direct`);
    else {
      console.log(`GAP pu-${i + 1}`);
      allOk = false;
    }
    sequence.push({ then: next, else_: elseCur, label: `pu-${i + 1}` });
  } else if (!expandArmChain('then', elseCur, thenCur, next, `pu-${i + 1}`)) {
    allOk = false;
  }
  thenCur = next;
}
const thenFinal = thenCur;
for (let i = 0; i < nPuSteps.length; i++) {
  const next = nPuSteps[i]!;
  if (fast) {
    const direct = justify(ensureComma(elseCur), ensureComma(next));
    if (direct) console.log(`OK npu-${i + 1} direct`);
    else {
      console.log(`GAP npu-${i + 1}`);
      allOk = false;
    }
    sequence.push({ then: thenFinal, else_: next, label: `npu-${i + 1}` });
  } else if (!expandArmChain('else_', thenFinal, elseCur, next, `npu-${i + 1}`)) {
    allOk = false;
  }
  elseCur = next;
}

console.log(`sequence length ${sequence.length} allOk=${allOk}`);

const apply = process.argv.includes('--apply');
const applyPartial = process.argv.includes('--apply-partial');
fs.writeFileSync(
  path.join(__dirname, 'out/ch14-placeholder-expand.json'),
  JSON.stringify(
    {
      allOk,
      sequenceLen: sequence.length,
      sample: sequence.slice(0, 4).map((s) => ({
        label: s.label,
        then: ensureComma(s.then).slice(0, 80),
        else_: ensureComma(s.else_).slice(0, 80),
      })),
    },
    null,
    2
  )
);

if (!apply && !applyPartial) process.exit(allOk ? 0 : 1);
if (apply && !allOk) {
  console.error('Refusing --apply with unsolved arm hops; use --apply-partial to strip <n> anyway');
  process.exit(1);
}

const outLines: string[] = [];
for (let i = 1; i < sequence.length; i++) {
  const s = sequence[i]!;
  const t = s.then.trim().startsWith(',') ? s.then.trim() : ',' + s.then.trim();
  const e = s.else_.trim().startsWith(',') ? s.else_.trim() : ',' + s.else_.trim();
  const tNorm = t.endsWith(',') ? t : t + ',';
  const eNorm = e.endsWith(',') ? e : e + ',';
  outLines.push(`\\Rq, i \\Oc i_1, j \\Oc j_1,  \\\\`);
  outLines.push(
    `\\Bb{if(i \\Pu)}{${tNorm}}{${eNorm}}, i_2 \\Os, i_1 \\Os, j_1 \\Os,\\\\\\`
  );
}

const newLines = [...lines.slice(0, startMark), ...outLines, ...lines.slice(endMark + 1)];
fs.writeFileSync(texPath, newLines.join(nl));
console.log(`applied: replaced lines ${startMark + 1}-${endMark + 1} with ${outLines.length} lines`);
