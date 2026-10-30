/**
 * Within each math/proof block, drop \Rq lines whose fingerprint was already
 * seen earlier in that block (removes A-B-A-B oscillation while keeping first path).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const remove = new Set<number>();

let inMath = false;
let seen = new Set<string>();
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (/\\begin\{math\}/i.test(line)) {
    inMath = true;
    seen = new Set();
    continue;
  }
  if (/\\end\{math\}/i.test(line) || /^\\bigskip/.test(line.trim())) {
    inMath = false;
    seen = new Set();
    continue;
  }
  if (!inMath || !/\\Rq/.test(line)) continue;

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
  const f = fp(joined);
  if (seen.has(f)) {
    for (let k = i; k <= end; k++) remove.add(k);
  } else {
    seen.add(f);
  }
  i = end;
}

const out = lines.filter((_, idx) => !remove.has(idx));
fs.writeFileSync(texPath, out.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('removed', remove.size, 'lines; left', out.length);
