import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const out: string[] = [];
function log(...args: unknown[]) {
  const s = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  out.push(s);
}

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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::202::') && (x.step === 5 || x.step === 9));

const raw = fs.readFileSync(texPath, 'utf8');
const lines = raw.split(/\r?\n/);

for (const f of fails) {
  console.log('\n==== s' + f.step + ' ====');
  const want = fingerprint(f.left);
  const wantR = fingerprint(f.right);
  console.log('wantL', want);
  console.log('wantR', wantR);
  let hits = 0;
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
    const fp = fingerprint(joined);
    if (fp !== want) continue;
    hits++;
    console.log('LEFT hit line', i + 1);
    console.log('  joined fp', fp);
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
      const nfp = fingerprint(nextJoined);
      console.log('  next line', ns + 1, 'matchR', nfp === wantR);
      if (nfp !== wantR) {
        // show first diff
        for (let k = 0; k < Math.max(nfp.length, wantR.length); k++) {
          if (nfp[k] !== wantR[k]) {
            console.log('  diff at', k, JSON.stringify(nfp.slice(k, k + 60)));
            console.log('         vs', JSON.stringify(wantR.slice(k, k + 60)));
            break;
          }
        }
      }
    }
  }
  console.log('hits', hits);
  // also search for near misses containing j2 Ps j1 count
  const psL = (want.match(/j_2 \\Ps j_1/g) || []).length;
  console.log('Ps count in wantL', psL);
}
