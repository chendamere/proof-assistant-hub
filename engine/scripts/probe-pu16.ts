import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  );
}
function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const start = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps i_2,i_2 \\Ps j_1,'
);
const goal = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_2 \\Ps j_1,'
);

const copy = axioms.find((r) => r.id === 'copy-identical')!;
console.log('copy', copy.leftSide, '=>', copy.rightSide);
console.log('copy rewrites', oneStepRewrites(start, copy.leftSide, copy.rightSide).map(toBook));

// Try removing i Ps i_2 right after Oc? But we have i Ps i_1 after Oc, not i Ps i_2
// Bubble i_1 Ps i_2 left next to Oc then... Oc is i Oc i_2 so reverse copy removes i Ps i_2

const rules = [...axioms, ...definitions, ...theorems];
type Node = { expr: string; path: string[]; via: string[]; d: number };
let beam: Node[] = [{ expr: start, path: [], via: [], d: dist(start, goal) }];
const seen = new Set([start]);
let found: Node | null = null;

function shrinks(expr: string): string[] {
  const out: string[] = [];
  // reverse copy-identical: drop "i Ps j" immediately after "i Oc j"
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      out.push(ensure(expr.slice(0, m.index) + `,${m[1]} \\Oc ${m[2]},` + expr.slice(m.index + m[0].length)));
    }
  }
  // reverse identical-70: drop one of two adjacent identical Ps
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr))) {
      out.push(
        ensure(expr.slice(0, m.index) + `,${m[1]} \\Ps ${m[2]},` + expr.slice(m.index + m[0].length))
      );
    }
  }
  return out;
}
function ensure(s: string): string {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

for (let depth = 0; depth < 12 && !found; depth++) {
  const next: Node[] = [];
  for (const node of beam) {
    const neighbors: Array<{ expr: string; via: string }> = [];
    for (const rule of rules) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(node.expr, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const expr = toBook(raw);
        if (expr === node.expr) continue;
        if (!checkInferenceRules(node.expr, expr, rule.leftSide, rule.rightSide).match) continue;
        neighbors.push({ expr, via: rule.id });
      }
    }
    for (const cand of shrinks(node.expr)) {
      for (const rule of [copy, theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-70-isjisj')!]) {
        if (checkInferenceRules(node.expr, cand, rule.leftSide, rule.rightSide).match) {
          neighbors.push({ expr: cand, via: rule.id });
        }
      }
    }
    for (const nb of neighbors) {
      if (seen.has(nb.expr)) continue;
      const d = dist(nb.expr, goal);
      if (nb.expr !== goal && d > node.d + 40) continue;
      seen.add(nb.expr);
      const n = { expr: nb.expr, path: [...node.path, nb.expr], via: [...node.via, nb.via], d };
      if (nb.expr === goal) {
        found = n;
        break;
      }
      next.push(n);
    }
    if (found) break;
  }
  if (found) break;
  next.sort((a, b) => a.d - b.d || a.expr.length - b.expr.length);
  beam = next.slice(0, 40);
  console.log('depth', depth, 'best', beam[0]?.d, 'len', beam[0]?.expr.length, 'seen', seen.size);
  console.log(' ', beam[0]?.expr.slice(0, 130));
}
if (found) {
  console.log('FOUND', found.via.join(' | '));
  for (const p of found.path.slice(0, -1)) console.log(' mid', p);
} else console.log('NOT FOUND');
