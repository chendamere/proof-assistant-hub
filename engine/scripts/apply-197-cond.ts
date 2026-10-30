/**
 * Insert flip → identical-72 → flip for Blb{i Ps j_1} → Blb{i Ps j} with j Ps j_1.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(expr)
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

const L = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const m1 = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{j_1 \\Ps i}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const m2 = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{j \\Ps i}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
let hitEnd = -1;
let trail = '\\\\\\\\';
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
  if (fingerprint(joined) === want) {
    hitEnd = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
    console.log('anchor', i + 1, '-', end + 1);
    break;
  }
}
if (hitEnd < 0) {
  console.error('NO ANCHOR');
  process.exit(1);
}
const block = [m1, m2].map((mid) => `\\Rq${bookBody(mid)}${trail}`);
lines.splice(hitEnd + 1, 0, ...block);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted', block.length);
