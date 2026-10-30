/**
 * Insert connectivity-0 mids for the thm24 Bb{m Pc n} expand that the
 * rewrite generator names with t_* but the book uses m_1/n_1.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Node_Connectivity.tex');

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
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

const left =
  ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,}{,i_1 \\Os,j_1 \\Os,\\Tc c_4,},},';
const mid =
  ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,m \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,}{,i_1 \\Os,j_1 \\Os,\\Tc c_4,},},';

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(left);

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
    console.log('anchor lines', i + 1, '-', end + 1);
    break;
  }
}
if (hitEnd < 0) {
  console.error('NO ANCHOR');
  process.exit(1);
}
lines.splice(hitEnd + 1, 0, `\\Rq${bookBody(mid)}${trail}`);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted mid after line', hitEnd + 1);
