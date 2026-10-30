/** Insert 124 s96: null-12 pull Os before Bb, then swap-copy-release bubbles to Oc. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
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
function bookBody(expr: string): string {
  let body = ensure(expr);
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::124::') && x.step === 96);

for (const f of fails) {
  const L = ensure(f.left);
  const R = ensure(f.right);
  const mid1 = ensure(
    ',i \\Oc i_1,j \\Oc j_1,i_1 \\Os,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},i_2 \\Os,j_1 \\Os,'
  );
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  const wantR = fingerprint(R);
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
    if (fingerprint(joined) !== want) continue;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    if (ns < lines.length && /\\Rq/.test(lines[ns]!)) {
      let ne = ns;
      while (ne + 1 < lines.length) {
        const nxt = lines[ne + 1]!;
        if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
        ne++;
      }
      const nextJoined = lines
        .slice(ns, ne + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ');
      if (fingerprint(nextJoined) !== wantR) continue;
    }
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    lines.splice(end + 1, 0, `\\Rq${bookBody(mid1)}${trail}`);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('OK s96 +1');
    process.exit(0);
  }
  console.log('NO ANCHOR');
}
