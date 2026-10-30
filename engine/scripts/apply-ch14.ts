/**
 * Insert solved chapter-14 intermediate chains into Rules_of_Node_Connectivity.tex.
 * Uses engine/scripts/out/intermediate-chains.json from fill-proof-intermediates.
 * Does not convert operator-first (current chains are already book form).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const solvedPath = path.join(__dirname, 'out/intermediate-chains.json');
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

type Solved = {
  key: string;
  step: number;
  left: string;
  right: string;
  intermediates: string[];
};

const solved = (JSON.parse(fs.readFileSync(solvedPath, 'utf8')) as Solved[]).filter((s) =>
  s.key.startsWith('Rules_of_Node_Connectivity::')
);

function bookBody(expr: string): string {
  let s = normalizeSpacing(expr).replace(/^,+|,+$/g, '');
  // ensure no trailing comma before the template adds one
  s = s.replace(/,+$/g, '');
  return s;
}

function normalizeExpr(s: string): string {
  s = s.replace(/\\+\s*$/, '').trim();
  if (!s || s.length < 2) return '';
  if (!s.endsWith(',')) s = s + ',';
  if (!s.startsWith(',')) s = ',' + s;
  return normalizeSpacing(s);
}

function extractParts(accumulated: string): string[] {
  return accumulated
    .split(/\s*\\+Rq\s*,/)
    .map((p) => normalizeExpr(p.replace(/^\s*\\+Rq\s*,?\s*/, '')))
    .filter((e) => e.length > 2);
}

type Chunk = { startLine: number; endLine: number; steps: string[]; stepLines: number[] };

function chunksOf(filePath: string): Map<number, Chunk[]> {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\n/);
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

const lines = fs.readFileSync(texPath, 'utf8').split(/\n/);
const chunks = chunksOf(texPath);
const inserts: Array<{ line: number; text: string[]; replace: boolean; order: number }> = [];
let located = 0;
let missed = 0;

for (const item of solved) {
  const theoremNo = parseInt(item.key.split('::')[1] ?? '0', 10);
  const list = chunks.get(theoremNo) ?? [];
  const flat: Array<{ chunk: Chunk; offset: number; norm: string }> = [];
  for (const chunk of list) {
    chunk.steps.forEach((norm, offset) => flat.push({ chunk, offset, norm }));
  }
  const leftNorm = normalizeSpacing(item.left);
  const rightNorm = normalizeSpacing(item.right);
  let pairAt = flat.findIndex((s, i) => s.norm === leftNorm && flat[i + 1]?.norm === rightNorm);
  if (pairAt < 0) {
    // fall back to recorded step index if norms drifted only by spaces
    pairAt = item.step;
  }
  const left = flat[pairAt];
  const right = flat[pairAt + 1];
  if (!left || !right || left.norm !== leftNorm || right.norm !== rightNorm) {
    console.log('locate miss', theoremNo, 'step', item.step);
    missed++;
    continue;
  }
  const leftLine = left.chunk.stepLines[left.offset];
  const rightLine = right.chunk.stepLines[right.offset];
  if (leftLine == null || rightLine == null) {
    console.log('locate line miss', theoremNo, item.step);
    missed++;
    continue;
  }
  const trail = (lines[rightLine] ?? '').match(/\\+\s*$/)?.[0] ?? '\\\\';
  const indent = (lines[rightLine] ?? '').match(/^\s*/)?.[0] ?? '';
  const text = item.intermediates.map((e) => `${indent}\\Rq, ${bookBody(e)},${trail}`);
  located++;
  if (leftLine === rightLine) {
    const line = lines[rightLine] ?? '';
    const rqOrdinal = left.chunk.stepLines.slice(0, left.offset + 1).filter((n) => n === rightLine).length;
    let from = 0;
    let pos = -1;
    for (let k = 0; k < rqOrdinal; k++) {
      pos = line.indexOf('\\Rq', from);
      if (pos < 0) break;
      from = pos + 3;
    }
    if (pos < 0) {
      console.log('same-line split miss', theoremNo, item.step);
      missed++;
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

fs.writeFileSync(texPath, lines.join('\n'));
console.log({ located, missed, insertions: inserts.length, linesAdded: inserts.reduce((n, i) => n + i.text.length - (i.replace ? 1 : 0), 0) });
