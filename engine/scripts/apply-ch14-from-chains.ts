/**
 * Re-apply complete chains from out/ch14-chains.json with improved anchors.
 *   npx tsx engine/scripts/apply-ch14-from-chains.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const chainsPath = path.join(__dirname, 'out/ch14-chains.json');

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  );
}
function ensureComma(s: string): string {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fp(s: string): string {
  return ensureComma(s)
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

type Solved = {
  key: string;
  step: number;
  left: string;
  intermediates: string[];
  complete: boolean;
};

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const solved = (JSON.parse(fs.readFileSync(chainsPath, 'utf8')) as Solved[]).filter(
  (s) => s.complete && s.intermediates.length > 0 && s.intermediates.length <= 16
);

type Job = { after: number; trail: string; mids: string[]; label: string };
const jobs: Job[] = [];

for (const item of solved) {
  const want = fp(item.left);
  let after = -1;
  let trail = '\\\\';
  // Build multi-line steps from each \Rq, require exact fingerprint match.
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = fp(
      lines
        .slice(i, end + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ')
    );
    if (joined !== want) continue;
    after = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
    break;
  }
  if (after < 0) {
    console.log('NO ANCHOR', item.key.split('::')[1], 'step', item.step, 'want', want.slice(0, 70));
    continue;
  }
  jobs.push({
    after,
    trail,
    mids: item.intermediates.map(toBook),
    label: `thm ${item.key.split('::')[1]} step ${item.step}`,
  });
}

jobs.sort((a, b) => b.after - a.after);
const used = new Set<number>();
let inserted = 0;
for (const job of jobs) {
  if (used.has(job.after)) {
    console.log('SKIP dup', job.label);
    continue;
  }
  used.add(job.after);
  const block = job.mids.map((m) => `\\Rq${bookBody(m)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += job.mids.length;
  console.log('inserted', job.mids.length, 'after', job.label, 'line', job.after + 1);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log(`done inserted=${inserted} jobs=${jobs.length}`);
