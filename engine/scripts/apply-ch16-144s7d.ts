/**
 * Complete 144 fold chain and insert into tex.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
const CO = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison',
  'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand',
  'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction',
  'Recursive_Function_R',
  'Previous_Order_Induction',
  'Recursive_Function_R_Prev',
  'Rules_of_Node_Ring',
  'Rules_of_Node_Connectivity',
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, `src/data/theorems/${CHAPTER}.tex`);

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
function bookBody(expr: string) {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = CO.indexOf(CHAPTER) * 100000 + 144;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const L = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R = ensure(',i \\Pu,i \\nPb t,');

const chain = [
  L,
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'), // take true
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},'), // error-release
  ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},'), // pull Os (derived)
  ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},'), // create-id
  ensure(',i \\Pu,n \\nPu,'), // def-null-neg
  ensure(',i \\Pu,i \\Od n,n \\nPu,'), // reverse id-not-null add Od?
  ensure(',i \\Pu,i \\Od n,'), // id-not-null drop nPu - wait we need opposite
];

// Rebuild working prefix then Od-discharge via null-0
const prefix = [
  L,
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'),
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},'),
  ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},'),
  ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},'),
  ensure(',i \\Pu,n \\nPu,'),
];

// From a4 we had: need to get a4 first via reverse id-not-null from tNn
const a4 = ensure(',i \\Pu,i \\Od n,');
const tNn = ensure(',i \\Pu,n \\nPu,');
const a3 = ensure(',i \\Pu,i \\Od n,n \\nPu,');
console.log('tNn->a3 reverse id-not-null', j(tNn, a3));
console.log('a3->a4', j(a3, a4));

const n0 = ensure(',\\Ot n,i \\Pe n,n \\Os,i \\Od n,');
const n0b = ensure(',\\Ot n,i \\Pe n,i \\Od n,n \\Os,');
const peOnly = ensure(',\\Ot n,i \\Pe n,');
const after3 = ensure(',\\Ot n,i \\Pe n,n \\Os,');
const tPu = ensure(',i \\Pu,');

console.log('a4->n0', j(a4, n0));
console.log('n0->n0b', j(n0, n0b));
console.log('n0b->peOnly', j(n0b, peOnly));
console.log('peOnly->after3', j(peOnly, after3));
console.log('after3->tPu', j(after3, tPu));
console.log('tPu->R', j(tPu, R));

// peOnly -> after3: create-temp adds Ot n, n Os → two Ot; need different add Os
const peTemp = ensure(',\\Ot n,i \\Pe n,\\Ot n,n \\Os,');
console.log('peOnly->peTemp', j(peOnly, peTemp));
console.log('peTemp->after3', j(peTemp, after3));

// Try n0 -> after3 by create-id? n0 has Os before Od
console.log('n0->after3 create-id?', j(n0, after3));
console.log('n0->tPu', j(n0, tPu));

// Full chain with known working hops
const full: string[] = [
  L,
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'),
  ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},'),
  ensure(',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},'),
  ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},'),
  ensure(',i \\Pu,n \\nPu,'),
];
// Can we go tNn -> R somehow with subnode-7 scaffolding under n nPu?
console.log('tNn->R', j(tNn, R));
console.log('tNn->tPu', j(tNn, tPu));

// Skip tNn: from create-id result go null-4 to Or then...
const t1d = ensure(',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,},');
const tOr = ensure(',i \\Pu,\\Or,');
console.log('t1d->tOr', j(t1d, tOr));
// null-5: i Pu, Or → Or; reverse Or → i Pu, Or. From Or alone to i Pu?
console.log('tOr->Or', j(tOr, ensure(',\\Or,')));
console.log('Or->tPu', j(ensure(',\\Or,'), tPu));

// Direct a4->R via 142 with Od (soft)?
console.log('a4->R', j(a4, R));

// Use null-0 path if n0->tPu works somehow
const hops = [a4, n0, n0b, peOnly];
for (let i = 0; i < hops.length - 1; i++) console.log('h', i, j(hops[i]!, hops[i + 1]!));

// peOnly + create-temp then null-0 with duplicate Ot cancelled differently
// theorems-of-node-null-comparison-0 reverse needs exact Ot, Pe, Os
// Add Os via: create-id reverse on fresh? 

// ALTERNATIVE: from t1d go to R via expanding nPb under Bb{n Pu}{Or}{}
console.log('t1d->R', j(t1d, R));
const via2 = ensure(',i \\Pu,i \\nPb t,');
console.log('same', via2 === R);

// Maybe cite 142 from t1d by ~ absorbing the Bb as empty true?
console.log('\nSearching t1d->R');
for (const rule of getRulesForTransition(index, t1d, R).slice(0, 30)) {
  if (
    checkInferenceRules(t1d, R, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
  ) {
    console.log('HIT', rule.id);
  }
}
