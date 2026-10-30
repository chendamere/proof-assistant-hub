/**
 * Insert solved chapter-14 intermediates before each failing right-hand step.
 * Usage: npx tsx engine/scripts/apply-ch14-chains.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const chainsPath = path.join(__dirname, 'out/ch14-chains.json');

type Solved = {
  key: string;
  step: number;
  left: string;
  right: string;
  intermediates: string[];
  complete: boolean;
};

function toBook(expr: string): string {
  return normalizeSpacing(
    expr
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/R_\(/g, 'R\\_(')
  );
}

function canon(s: string): string {
  return normalizeSpacing(
    toBook(
      s
        .replace(/\\+\s*$/, '')
        .replace(/^\s*\\Rq\s*/, '')
        .trim()
    )
  );
}

function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const solved = (JSON.parse(fs.readFileSync(chainsPath, 'utf8')) as Solved[]).filter(
  (s) => s.complete && s.intermediates.length > 0 && s.intermediates.length <= 12
);

type Job = { lineNo: number; trail: string; intermediates: string[]; label: string };
const jobs: Job[] = [];

for (const item of solved) {
  const want = canon(item.right);
  let lineNo = -1;
  for (let i = 0; i < lines.length; i++) {
    if (canon(lines[i]!) === want) {
      lineNo = i;
      break;
    }
  }
  if (lineNo < 0) {
    console.log('NO EXACT RIGHT ANCHOR', item.key.split('::')[1], 'step', item.step);
    continue;
  }
  // Require the prior step's left to appear above this right (guards wrong anchors).
  const wantLeft = canon(item.left);
  let sawLeft = false;
  for (let i = Math.max(0, lineNo - 8); i < lineNo; i++) {
    const c = canon(lines[i]!);
    if (c && (c === wantLeft || wantLeft.includes(c) || c.includes(wantLeft.slice(0, Math.min(50, wantLeft.length))))) {
      sawLeft = true;
      break;
    }
  }
  if (!sawLeft) {
    console.log('NO LEFT CONTEXT', item.key.split('::')[1], 'step', item.step, 'line', lineNo + 1);
    continue;
  }
  // Copy trailing backslash run from the previous step line when possible.
  let trail = '\\\\';
  for (let j = lineNo - 1; j >= 0; j--) {
    const m = lines[j]!.match(/(\\+)\s*$/);
    if (m) {
      trail = m[1]!;
      break;
    }
  }
  jobs.push({
    lineNo,
    trail,
    intermediates: item.intermediates.map(toBook),
    label: `thm ${item.key.split('::')[1]} step ${item.step}`,
  });
}

jobs.sort((a, b) => b.lineNo - a.lineNo);
let inserted = 0;
const used = new Set<number>();
for (const job of jobs) {
  if (used.has(job.lineNo)) {
    console.log('SKIP duplicate anchor', job.label, 'line', job.lineNo);
    continue;
  }
  used.add(job.lineNo);
  const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.lineNo, 0, ...block);
  inserted += job.intermediates.length;
  console.log('inserted', job.intermediates.length, 'before', job.label, 'line', job.lineNo);
}

fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log(`wrote insertions=${inserted} jobs=${jobs.length}`);
