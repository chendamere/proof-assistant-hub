import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const start = normalizeSpacing(
  ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),m \\Oc m_1,n \\Oc n_1,\\Bb{i_1 \\Ps j_1}{,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},}{,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_3,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_4,},},'
);
const goal = normalizeSpacing(
  ',m \\Oc m_1,n \\Oc n_1,i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},}{,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_3,}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_4,},},'
);

const rules = [...axioms, ...definitions, ...theorems].filter(
  (r) =>
    getPos(r.id) < 13 * 100000 + 24 &&
    /Oc|copy|swap|identical|R\(|release/i.test(r.id + r.leftSide)
);

function getPos(id: string): number {
  const m = id.match(/^theorems-of-identical-node-comparison-(\d+)/);
  if (m) return 4 * 100000 + parseInt(m[1]!, 10) + 1;
  const m2 = id.match(/^recursive-function-r-(\d+)/);
  if (m2) return 9 * 100000 + parseInt(m2[1]!, 10) + 1;
  const m3 = id.match(/^swap/);
  if (m3) return 6 * 100000;
  return 0;
}

let cur = start;
const path: string[] = [];
for (let step = 0; step < 10 && cur !== goal; step++) {
  let best: { id: string; expr: string; d: number } | null = null;
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const expr of rewrites) {
      if (expr === cur) continue;
      if (!checkInferenceRules(cur, expr, rule.leftSide, rule.rightSide).match) continue;
      const d = [...expr].reduce((n, c, i) => n + (c !== goal[i] ? 1 : 0), Math.abs(expr.length - goal.length));
      if (!best || d < best.d) best = { id: rule.id, expr, d };
      if (expr === goal) {
        best = { id: rule.id, expr, d: 0 };
        break;
      }
    }
    if (best?.d === 0) break;
  }
  if (!best) {
    console.log('stuck', step, cur.slice(0, 120));
    break;
  }
  console.log('hop', step, best.id, 'd', best.d, best.expr.slice(0, 100));
  path.push(best.expr);
  cur = best.expr;
}
console.log('done', cur === goal, 'hops', path.length);
