import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.step === 62)!;
console.log('want', fp(f.left));
console.log('wantR', fp(f.right));
const raw = fs.readFileSync(path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex'), 'utf8');
const lines = raw.split(/\r?\n/);
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
  if (joined.includes('i_1 \\Op') && joined.includes('R\\_(i_1)') && joined.includes('i_2 \\Ps j_1')) {
    console.log('--- line', i, 'matchL', fp(joined) === fp(f.left));
    console.log(fp(joined));
  }
}
