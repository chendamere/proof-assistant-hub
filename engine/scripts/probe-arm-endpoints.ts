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
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}
function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}
function ensure(s: string): string {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const thenStart = ensure(
  ', i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),'
);
const thenGoal = ensure(
  ', i \\Pu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,'
);
const elseStart = ensure(
  ', i \\nPu, i \\Ps i_1, i \\On, i \\Oc i_2, R(i_1), R(j_1), i_1 \\Ps j_1, R(i_2),'
);
const elseGoal = ensure(
  ', i \\nPu, i \\Ps i_1, R(i_1), i \\On, i \\Oc i_2, R(i_2), R(j_1), i_2 \\Ps j_1,'
);

const rules = [...axioms, ...definitions, ...theorems].filter((r) =>
  /swap|identical|null-comparison|recursive-function|release|create-next|copy|thm-R|thm-Ps|operators-and-relationships|empty-branch|node-ring|rules-of-operators/i.test(
    r.id
  )
);

function shrinks(expr: string): string[] {
  const out: string[] = [];
  const cnp = /,([A-Za-z][A-Za-z0-9_]*) \\On,\1 \\Op(?=,)/g;
  let m: RegExpExecArray | null;
  while ((m = cnp.exec(expr))) {
    out.push(ensure(expr.slice(0, m.index) + ',' + expr.slice(m.index + m[0].length)));
  }
  const rprev = /,([A-Za-z][A-Za-z0-9_]*) \\Pu,R\\_\(\1\),/g;
  const n = expr.replace(/R_\(/g, 'R\\_(');
  while ((m = rprev.exec(n))) {
    out.push(ensure(n.slice(0, m.index) + `,${m[1]} \\Pu,` + n.slice(m.index + m[0].length)));
  }
  const copy = /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
  while ((m = copy.exec(expr))) {
    out.push(ensure(expr.slice(0, m.index) + `,${m[1]} \\Oc ${m[2]},` + expr.slice(m.index + m[0].length)));
  }
  return out;
}

function solve(label: string, start: string, goal: string) {
  console.log('====', label, 'd', dist(start, goal));
  console.log(' from', start);
  console.log(' to  ', goal);
  type Node = { expr: string; path: string[]; via: string[]; d: number };
  let beam: Node[] = [{ expr: start, path: [], via: [], d: dist(start, goal) }];
  const seen = new Set([start]);
  let found: Node | null = null;
  for (let depth = 0; depth < 16 && !found; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const nbs: Array<{ expr: string; via: string }> = [];
      for (const rule of rules) {
        let rewrites: string[];
        try {
          rewrites = oneStepRewrites(node.expr, rule.leftSide, rule.rightSide);
        } catch {
          continue;
        }
        for (const raw of rewrites) {
          const expr = ensure(raw);
          if (expr === node.expr) continue;
          if (!checkInferenceRules(node.expr, expr, rule.leftSide, rule.rightSide).match) continue;
          nbs.push({ expr, via: rule.id });
        }
      }
      for (const cand of shrinks(node.expr)) {
        for (const rule of rules) {
          if (checkInferenceRules(node.expr, cand, rule.leftSide, rule.rightSide).match) {
            nbs.push({ expr: cand, via: rule.id });
            break;
          }
        }
      }
      for (const nb of nbs) {
        if (seen.has(nb.expr)) continue;
        const d = dist(nb.expr, goal);
        if (nb.expr !== goal && d > node.d + 35) continue;
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
    console.log(' depth', depth, 'best', beam[0]?.d, 'seen', seen.size);
    if (!beam.length) break;
  }
  if (found) {
    console.log(' FOUND hops', found.path.length, found.via.join(' | '));
    for (const p of found.path.slice(0, -1)) console.log('  ', p);
  } else {
    console.log(' NOT FOUND best', beam[0]?.expr);
  }
}

solve('then', thenStart, thenGoal);
solve('else', elseStart, elseGoal);
