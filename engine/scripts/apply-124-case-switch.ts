/** Insert merge mid for 124 case-switch (true-end → false-start). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchesCaseFocusOrMerge } from '../src/inferenceRules/caseFocus';
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
function bookBody(expr: string) {
  let body = ensure(expr);
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function armBody(expr: string): string {
  // strip outer commas for Bb arm content
  let t = ensure(expr);
  if (t.startsWith(',')) t = t.slice(1);
  if (t.endsWith(',')) t = t.slice(0, -1);
  return t.startsWith(',') ? t : ',' + t + (t.endsWith(',') ? '' : ',');
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.step === 86)!;
const L = ensure(f.left);
const R = ensure(f.right);

const trueArm = armBody(L);
const falseArm = armBody(R);
const mid = ensure(
  `,i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{${trueArm}}{${falseArm}},i_2 \\Os,i_1 \\Os,j_1 \\Os,`
);
console.log('L→mid', matchesCaseFocusOrMerge(L, mid));
console.log('mid→R', matchesCaseFocusOrMerge(mid, R));
console.log('mid', mid);

if (!matchesCaseFocusOrMerge(L, mid) || !matchesCaseFocusOrMerge(mid, R)) {
  console.log('case-switch mid failed');
  process.exit(1);
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
const wantR = fingerprint(R);
const anchors: { end: number; trail: string }[] = [];
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
  if (ns >= lines.length || !/\\Rq/.test(lines[ns]!)) continue;
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
  const tm = lines[end]!.match(/(\\+)\s*$/);
  anchors.push({ end, trail: tm ? tm[1]! : '\\\\\\\\' });
}
console.log('anchors', anchors.length);
if (anchors.length !== 1) process.exit(1);
const a = anchors[0]!;
lines.splice(a.end + 1, 0, `\\Rq${bookBody(mid)}${a.trail}`);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('OK +1');
