import { matchesPuNpbWitnessFold, matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const L = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R = ensure(',i \\Pu,i \\nPb t,');
console.log('fold', matchesPuNpbWitnessFold(L, R));
console.log('derived', matchesDerivedBbTransition(L, R));
console.log('neg', matchesPuNpbWitnessFold(R, L));
