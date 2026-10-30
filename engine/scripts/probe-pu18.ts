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

const start = toBook(
  ',i \\Ps i_1,i \\On,i_1 \\Pu,i_1 \\On,i_1 \\Op,R\\_(i_1),i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,'
);
const goal = toBook(
  ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,'
);

const cnp = axioms.find((r) => r.id === 'create-next-prev')!;
const rprev = theorems.find((r) => r.id === 'recursive-function-r-prev-1-iuii')!;
const puOn = theorems.find((r) => r.id === 'theorems-of-node-null-comparison-29-iumnm')!;

console.log('start', start);
console.log('cnp L/R', JSON.stringify(cnp.leftSide), JSON.stringify(cnp.rightSide));
console.log(
  'cnp rewrites',
  oneStepRewrites(start, cnp.leftSide, cnp.rightSide).map(toBook).slice(0, 8)
);

// Manually remove On Op
const mid1 = toBook(
  ',i \\Ps i_1,i \\On,i_1 \\Pu,R\\_(i_1),i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,'
);
console.log('cnp check mid1', checkInferenceRules(start, mid1, cnp.leftSide, cnp.rightSide).match);

const mid2 = toBook(',i \\Ps i_1,i \\On,i_1 \\Pu,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,');
console.log('rprev check mid2', checkInferenceRules(mid1, mid2, rprev.leftSide, rprev.rightSide).match);
console.log('rprev rewrites from mid1', oneStepRewrites(mid1, rprev.leftSide, rprev.rightSide).map(toBook));

console.log('puOn check goal', checkInferenceRules(mid2, goal, puOn.leftSide, puOn.rightSide).match);
console.log('puOn rewrites', oneStepRewrites(mid2, puOn.leftSide, puOn.rightSide).map(toBook));

// Try full beam with ALL rules but prioritize shrink rules
const rules = [...axioms, ...definitions, ...theorems];
type Node = { expr: string; path: string[]; via: string[]; d: number };
function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}
let beam: Node[] = [{ expr: start, path: [], via: [], d: dist(start, goal) }];
const seen = new Set([start]);
let found: Node | null = null;
for (let depth = 0; depth < 8 && !found; depth++) {
  const next: Node[] = [];
  for (const node of beam) {
    for (const rule of rules) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(node.expr, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const expr = toBook(raw);
        if (seen.has(expr)) continue;
        if (!checkInferenceRules(node.expr, expr, rule.leftSide, rule.rightSide).match) continue;
        const d = dist(expr, goal);
        if (expr !== goal && d > node.d + 20) continue;
        // Prefer shorter expressions for absorption phase
        seen.add(expr);
        const n = { expr, path: [...node.path, expr], via: [...node.via, rule.id], d };
        if (expr === goal) {
          found = n;
          break;
        }
        next.push(n);
      }
      if (found) break;
    }
    if (found) break;
  }
  if (found) break;
  next.sort((a, b) => a.d - b.d || a.expr.length - b.expr.length);
  beam = next.slice(0, 30);
  console.log('depth', depth, 'best', beam[0]?.d, beam[0]?.expr.slice(0, 100), 'seen', seen.size);
}
console.log(found ? `FOUND ${found.via.join(' | ')}` : 'NOT FOUND');
if (found) for (const p of found.path.slice(0, -1)) console.log(' mid', p);
