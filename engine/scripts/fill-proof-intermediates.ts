/**
 * Fill proof arrows that are a short chain of existing rules.
 * Does not add axioms or change rule statements.
 *
 * Usage:
 *   npx tsx engine/scripts/fill-proof-intermediates.ts          # report only
 *   npx tsx engine/scripts/fill-proof-intermediates.ts --apply  # edit theorem tex
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { armFactorStep, oneSiteToward, oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { earlyRulePosition } from '../../src/data/rulePosition';

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
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
  'Tree_Order_Induction',
  'Recursive_Function_Rc',
  'Rules_of_Number_Equal_Relationship',
  'Rules_of_Number_More_Less_Than',
  'Rules_of_Assign_Operator_Temp_Space',
  'Axioms_of_Assign_Operator',
  'Theorems_of_Insert_Node_Function',
  'Theorems_of_Delete_Node_Function',
  'Theorems_of_Assign_Operator',
  'Function_Cpo',
  'Recursive_Function_Rcpo',
  'Addition',
  'Recursive_Function_Rcpm',
  'Multiplication',
  'Paradox',
];

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
const allRules = [...axioms, ...definitions, ...theorems];

function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1];
  const index = parseInt(m[2], 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

function getPositionForKey(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  const chapterIdx = CHAPTER_ORDER.indexOf(filename);
  if (chapterIdx < 0) return 999999999;
  return chapterIdx * 100000 + index;
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const n = b.length;
  let prev = new Uint32Array(n + 1);
  let cur = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n]!;
}

type Rule = { id: string; leftSide: string; rightSide: string };

function opFamily(op: string): string {
  if (op === '\\Bb' || op === '\\Bs' || op === '\\Blb' || op === '\\Bls' || op === '\\Brb' || op === '\\Brs') return 'branch';
  if (op === '\\Pe' || op === '\\Oe') return 'eq';
  if (op === '\\nPe' || op === '\\nOe') return 'neq';
  if (op === '\\Ps' || op === '\\nPs') return op;
  return op;
}

function ruleFor(from: string, to: string, rules: Rule[]): Rule | null {
  const want = normalizeSpacing(to);
  const have = new Set([...(from.match(/\\[A-Za-z]+/g) ?? []), ...(to.match(/\\[A-Za-z]+/g) ?? [])].map(opFamily));
  const candidates: Rule[] = [];
  for (const rule of rules) {
    const ops = ((rule.leftSide + rule.rightSide).match(/\\[A-Za-z]+/g) ?? []).map(opFamily);
    if (!ops.some((op) => op !== 'branch' && have.has(op))) continue;
    if (!ops.every((op) => op === '\\Tc' || op === 'branch' || have.has(op))) continue;
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(from, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    if (rewrites.includes(want)) {
      if (checkInferenceRules(from, want, rule.leftSide, rule.rightSide).match) return rule;
    } else if (rewrites.length > 0) {
      candidates.push(rule);
    }
  }
  for (const rule of candidates) {
    if (checkInferenceRules(from, want, rule.leftSide, rule.rightSide).match) return rule;
  }
  return null;
}

/** Peel one arm, or one adjacent swap, at a time. Each hop must be one existing rule. */
function siteChain(
  left: string,
  right: string,
  rules: Rule[]
): { exprs: string[]; ruleIds: string[] } | null {
  const goal = normalizeSpacing(right);
  let cur = normalizeSpacing(left);
  const exprs: string[] = [];
  const ruleIds: string[] = [];
  for (let n = 0; n < 40 && cur !== goal; n++) {
    const site = oneSiteToward(cur, goal);
    const fact = armFactorStep(cur, goal);
    const options = [site, fact !== site ? fact : null].filter((x): x is string => !!x);
    if (options.length === 0) options.push(goal);
    let chosen: { expr: string; id: string } | null = null;
    for (const target of options) {
      const rule = ruleFor(cur, target, rules);
      if (!rule) continue;
      chosen = { expr: normalizeSpacing(target), id: rule.id };
      break;
    }
    if (!chosen || chosen.expr === cur) return null;
    exprs.push(chosen.expr);
    ruleIds.push(chosen.id);
    cur = chosen.expr;
  }
  return cur === goal && exprs.length > 1 ? { exprs, ruleIds } : null;
}

function findChain(
  left: string,
  right: string,
  rules: Rule[]
): { exprs: string[]; ruleIds: string[] } | null {
  const goal = normalizeSpacing(right);
  const start = normalizeSpacing(left);
  if (start === goal) return { exprs: [], ruleIds: [] };
  const startDist = lev(start, goal);
  const t0 = performance.now();
  type Node = { expr: string; exprs: string[]; ruleIds: string[]; dist: number };
  let beam: Node[] = [{ expr: start, exprs: [], ruleIds: [], dist: startDist }];
  const seen = new Set([start]);
  for (let depth = 0; depth < 4 && beam.length; depth++) {
    const next: Node[] = [];
    for (const state of beam) {
      if (performance.now() - t0 > 1200) break;
      const exprOps = new Set(state.expr.match(/\\[A-Za-z]+/g) ?? []);
      for (const rule of rules) {
        const ruleOps = (rule.leftSide + rule.rightSide).match(/\\[A-Za-z]+/g) ?? [];
        if (!ruleOps.some((op) => exprOps.has(op))) continue;
        let rewrites: string[];
        try {
          rewrites = oneStepRewrites(state.expr, rule.leftSide, rule.rightSide);
        } catch {
          continue;
        }
        for (const expr of rewrites) {
          if (seen.has(expr)) continue;
          seen.add(expr);
          const exprs = [...state.exprs, expr];
          const ruleIds = [...state.ruleIds, rule.id];
          if (expr === goal) return { exprs, ruleIds };
          const dist = lev(expr, goal);
          if (dist <= startDist + 48) next.push({ expr, exprs, ruleIds, dist });
        }
      }
    }
    next.sort((a, b) => a.dist - b.dist);
    beam = next.slice(0, 18);
  }
  return null;
}

function chainChecks(left: string, exprs: string[], ruleIds: string[], rules: Rule[]): boolean {
  let prev = normalizeSpacing(left);
  for (let i = 0; i < exprs.length; i++) {
    const rule = rules.find((r) => r.id === ruleIds[i]);
    if (!rule) return false;
    const result = checkInferenceRules(prev, exprs[i]!, rule.leftSide, rule.rightSide);
    if (!result.match) return false;
    prev = exprs[i]!;
  }
  return true;
}

type Fail = { key: string; step: number; left: string; right: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileArg = process.argv.find((a) => a.startsWith('--file='));
const failPath = fileArg
  ? path.resolve(fileArg.slice('--file='.length))
  : path.join(__dirname, 'out', 'proof-step-failures.jsonl');
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity;

const fails: Fail[] = fs
  .readFileSync(failPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as Fail)
  .slice(0, limit);

const rulesByPos = allRules
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: getPositionForRule(r) }))
  .sort((a, b) => a.pos - b.pos);

type Solved = Fail & { intermediates: string[]; ruleIds: string[] };
const solved: Solved[] = [];
const unsolved: Fail[] = [];

let n = 0;
for (const fail of fails) {
  n++;
  const pos = getPositionForKey(fail.key);
  const prior = rulesByPos.filter((r) => r.pos < pos);
  const chain = siteChain(fail.left, fail.right, prior) ?? findChain(fail.left, fail.right, prior);
  const intermediates = chain ? chain.exprs.slice(0, -1) : [];
  const ok = chain != null && intermediates.length > 0 && chainChecks(fail.left, chain.exprs, chain.ruleIds, prior);
  if (ok && chain) {
    solved.push({ ...fail, intermediates, ruleIds: chain.ruleIds });
    console.log(`CHAIN ${n}/${fails.length} ${fail.key} step ${fail.step} +${intermediates.length} via ${chain.ruleIds.join(' | ')}`);
  } else {
    unsolved.push(fail);
    console.log(`OPEN ${n}/${fails.length} ${fail.key} step ${fail.step}`);
  }
}

const outDir = path.join(__dirname, 'out');
fs.writeFileSync(path.join(outDir, 'intermediate-chains.json'), JSON.stringify(solved, null, 2));
fs.writeFileSync(path.join(outDir, 'unsolved-steps.json'), JSON.stringify(unsolved, null, 2));
console.log(`solved=${solved.length} unsolved=${unsolved.length} apply=${apply}`);

if (!apply || solved.length === 0) process.exit(0);

function normalizeExpr(s: string): string {
  s = s.replace(/\\+\s*$/, '').trim();
  if (!s || s.length < 2) return '';
  if (!s.endsWith(',')) s = s + ',';
  if (!s.startsWith(',')) s = ',' + s;
  return s.replace(/\s+/g, ' ').trim();
}

function extractParts(accumulated: string): string[] {
  return accumulated
    .split(/\s*\\+Rq\s*,/)
    .map((p) => normalizeExpr(p.replace(/^\s*\\+Rq\s*,?\s*/, '')))
    .filter((e) => e.length > 2);
}

type Chunk = { startLine: number; endLine: number; steps: string[]; stepLines: number[] };

function chunksOf(filePath: string): Map<number, Chunk[]> {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const byTheorem = new Map<number, Chunk[]>();
  let theorem = 0;
  let inProof = false;
  let pending: Array<{ lineNo: number; text: string }> = [];
  const flush = () => {
    if (!pending.length || theorem <= 0) {
      pending = [];
      return;
    }
    const joined = pending.map((p) => p.text).join(' ');
    const steps = extractParts(joined).map((s) => normalizeSpacing(s));
    const rqLines: number[] = [];
    for (const p of pending) {
      const n = p.text.match(/\\Rq/g)?.length ?? 0;
      for (let k = 0; k < n; k++) rqLines.push(p.lineNo);
    }
    let stepLines: number[];
    if (steps.length === rqLines.length + 1) stepLines = [pending[0]!.lineNo, ...rqLines];
    else if (steps.length === rqLines.length) stepLines = rqLines;
    else stepLines = steps.map(() => pending[0]!.lineNo);
    if (steps.length) {
      const list = byTheorem.get(theorem) ?? [];
      list.push({
        startLine: pending[0]!.lineNo,
        endLine: pending[pending.length - 1]!.lineNo,
        steps,
        stepLines,
      });
      byTheorem.set(theorem, list);
    }
    pending = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) continue;
    if (trimmed.includes('\\begin{math}')) {
      inProof = true;
      continue;
    }
    if (inProof && trimmed.includes('\\end{math}')) {
      flush();
      inProof = false;
      continue;
    }
    if (inProof) {
      const continues = /\\+\s*$/.test(lines[i]!);
      const stepPart = lines[i]!.replace(/\\+\s*$/, '').trim();
      if (stepPart && !/^(premise|conclusion)\s*[\\;:]?/i.test(stepPart)) {
        pending.push({ lineNo: i, text: stepPart });
        if (!continues) flush();
      } else flush();
      continue;
    }
    if (trimmed.includes('\\[') && /\\Rq/.test(trimmed)) theorem++;
  }
  return byTheorem;
}

const byFile = new Map<string, Solved[]>();
for (const s of solved) {
  const file = s.key.split('::')[0] ?? '';
  const list = byFile.get(file) ?? [];
  list.push(s);
  byFile.set(file, list);
}

const texDir = path.join(__dirname, '../../src/data/theorems');
for (const [file, items] of byFile) {
  const filePath = path.join(texDir, file + '.tex');
  if (!fs.existsSync(filePath)) {
    console.log('missing tex', filePath);
    continue;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const chunks = chunksOf(filePath);
  const inserts: Array<{ line: number; text: string[]; replace: boolean; order: number }> = [];
  for (const item of items) {
    const theoremNo = parseInt(item.key.split('::')[1] ?? '0', 10);
    const list = chunks.get(theoremNo) ?? [];
    const flat: Array<{ chunk: Chunk; offset: number; norm: string }> = [];
    for (const chunk of list) {
      chunk.steps.forEach((norm, offset) => flat.push({ chunk, offset, norm }));
    }
    let pairAt = flat.findIndex((s, i) => s.norm === item.left && flat[i + 1]?.norm === item.right);
    if (pairAt < 0) pairAt = item.step;
    const left = flat[pairAt];
    const right = flat[pairAt + 1];
    if (!left || !right || left.norm !== item.left || right.norm !== item.right) {
      console.log('locate miss', item.key, 'step', item.step);
      continue;
    }
    const leftLine = left.chunk.stepLines[left.offset];
    const rightLine = right.chunk.stepLines[right.offset];
    if (leftLine == null || rightLine == null) {
      console.log('locate line miss', item.key, item.step);
      continue;
    }
    const trail = (lines[rightLine] ?? '').match(/\\+\s*$/)?.[0] ?? '\\\\';
    const indent = (lines[rightLine] ?? '').match(/^\s*/)?.[0] ?? '';
    const text = item.intermediates.map((e) => `${indent}\\Rq, ${e.replace(/^,|,$/g, '')},${trail}`);
    if (leftLine === rightLine) {
      const line = lines[rightLine] ?? '';
      const at = line.indexOf('\\Rq');
      if (at < 0) {
        console.log('same-line split miss', item.key, item.step);
        continue;
      }
      const rqOrdinal = left.chunk.stepLines.slice(0, left.offset + 1).filter((n) => n === rightLine).length;
      let from = 0;
      let pos = -1;
      for (let k = 0; k < rqOrdinal; k++) {
        pos = line.indexOf('\\Rq', from);
        if (pos < 0) break;
        from = pos + 3;
      }
      if (pos < 0) {
        console.log('same-line split miss', item.key, item.step);
        continue;
      }
      const head = line.slice(0, pos).replace(/\\+\s*$/, '').trimEnd();
      const tail = line.slice(pos);
    inserts.push({
      line: rightLine,
      text: [`${indent}${head}${trail}`, ...text.slice(0, -1), `${indent}${tail.trimStart()}`],
      replace: true,
      order: inserts.length,
    });
    continue;
    }
    inserts.push({ line: rightLine, text, replace: false, order: inserts.length });
  }
  inserts.sort((a, b) => b.line - a.line || b.order - a.order);
  for (const ins of inserts) {
    if (ins.replace) lines.splice(ins.line, 1, ...ins.text);
    else lines.splice(ins.line, 0, ...ins.text);
  }
  if (inserts.length) {
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`edited ${file} insertions=${inserts.length}`);
  }
}
