/**
 * Apply thm150 s10: drop Pc via Ps scaffold (copy-identical + swap + connectivity-193).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
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

const left = ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const mids = [
  ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Ps i_0,i \\Pc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
];

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(left);
let anchor = -1;
let trail = '\\\\';
let inMath = false;
for (let i = 0; i < lines.length; i++) {
  if (/\\begin\{math\}/.test(lines[i]!)) {
    inMath = true;
    continue;
  }
  if (/\\end\{math\}/.test(lines[i]!)) {
    inMath = false;
    continue;
  }
  if (!inMath || !/\\Rq/.test(lines[i]!)) continue;
  let end = i;
  const tm0 = lines[i]!.match(/(\\+)\s*$/);
  if (tm0) trail = tm0[1]!;
  while (end + 1 < lines.length) {
    const nxt = lines[end + 1]!;
    if (/\\Rq/.test(nxt)) break;
    if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
    if (!nxt.trim()) break;
    end++;
    const tm = nxt.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
  }
  const buf = lines
    .slice(i, end + 1)
    .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
    .join(' ');
  if (fingerprint(buf) === want) {
    if (anchor >= 0) {
      console.log('NONUNIQUE');
      process.exit(1);
    }
    anchor = end;
  }
  i = end;
}
if (anchor < 0) {
  console.log('NO ANCHOR');
  process.exit(1);
}
lines.splice(anchor + 1, 0, ...mids.map((m) => `\\Rq${bookBody(m)}${trail}`));
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted', mids.length, 'after line', anchor + 1);
execSync('node scripts/extract-proof-steps.js', {
  cwd: root,
  stdio: 'inherit',
  maxBuffer: 64 * 1024 * 1024,
});
