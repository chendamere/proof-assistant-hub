import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
function fp(expr: string) {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

const raw = fs.readFileSync(
  path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex'),
  'utf8'
);
const lines = raw.split(/\r?\n/);
const exprs: { line: number; fp: string }[] = [];
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
  exprs.push({ line: i + 1, fp: fp(joined) });
  i = end;
}
let consec = 0;
const seen = new Map<string, number>();
for (let i = 0; i < exprs.length; i++) {
  const e = exprs[i]!;
  seen.set(e.fp, (seen.get(e.fp) ?? 0) + 1);
  if (i > 0 && exprs[i - 1]!.fp === e.fp) {
    consec++;
    if (consec <= 12) console.log('CONSEC', e.line);
  }
}
let multi = 0;
for (const [k, v] of seen) {
  if (v > 2) {
    multi++;
    if (multi <= 15) console.log('MULTI', v, k.slice(0, 120));
  }
}
console.log('totalRq', exprs.length, 'consecDupPairs', consec, 'fpsWith3plus', multi);
