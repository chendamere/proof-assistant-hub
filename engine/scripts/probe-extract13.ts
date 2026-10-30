import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tex = fs.readFileSync(
  path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex'),
  'utf8'
);
const lines = tex.split(/\r?\n/);

function isProofStepLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return false;
  const hasOperator = /\\[A-Z][a-z]*/.test(trimmed);
  const hasCommaOrRq = /^[,\s]*\\?Rq\s*,|^,/.test(trimmed) || trimmed.includes(',');
  return hasOperator && (hasCommaOrRq || trimmed.startsWith(','));
}

function normalizeExpr(s: string) {
  s = s.replace(/\\\\+$/, '').replace(/\\+$/, '').trim();
  if (!s || s.length < 2) return '';
  if (!s.endsWith(',')) s = s + ',';
  if (!s.startsWith(',')) s = ',' + s;
  return s.replace(/\s+/g, ' ').trim();
}

function extractProofSteps(accumulated: string) {
  const re = /\s*\\+Rq(\s*\\sim)?\s*,/g;
  const raw: { text: string; sim: boolean }[] = [];
  let last = 0;
  let sim = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(accumulated))) {
    raw.push({ text: accumulated.slice(last, m.index), sim });
    sim = Boolean(m[1]);
    last = m.index + m[0].length;
  }
  raw.push({ text: accumulated.slice(last), sim });
  const steps: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const part = raw[i]!;
    let text = part.text.replace(/^\s*\\+Rq\s*,?\s*/, '');
    if (part.sim) text = text ? `\\sim, ${text}` : '\\sim';
    const expr = normalizeExpr(text);
    if (expr && expr.length > 2) steps.push(expr);
  }
  return steps;
}

let pending = '';
let inMath = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  const trimmed = line.trim();
  if (trimmed.includes('\\begin{math}') && i > 100 && i < 120) {
    inMath = true;
    pending = '';
    console.log('begin math', i + 1);
    continue;
  }
  if (inMath && trimmed.includes('\\end{math}')) {
    const steps = extractProofSteps(pending);
    console.log('end math steps', steps.length);
    steps.forEach((s, idx) => console.log(idx, s));
    break;
  }
  if (!inMath) continue;
  if (isProofStepLine(line) || (pending && line.match(/^\s*,?\s*[\w\s\\{}();,]+/))) {
    const continues = /\\+\s*$/.test(line);
    const stepPart = line.replace(/\\+\s*$/, '').trim();
    if (stepPart) {
      pending = pending ? pending + ' ' + stepPart : stepPart;
      if (!continues) {
        console.log('unexpected flush at', i + 1);
      }
    }
  }
}
