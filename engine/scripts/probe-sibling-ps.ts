import { theorems, axioms, definitions } from '../../src/data/theorems';
import { axioms as ax } from '../../src/data/axioms';
import { definitions as df } from '../../src/data/definitions';
import { checkInferenceRules } from '../src/inferenceRules';
import { trySiblingEqualityOnCondition } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const L = normalizeSpacing(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,R(j_1),i \\Ps i_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const R = normalizeSpacing(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,R(j_1),i \\Ps i_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);

const all = [...ax, ...df, ...theorems];
let siblingHits = 0;
let checkHits = 0;
for (const t of all) {
  const s = trySiblingEqualityOnCondition(L, R, t.leftSide, t.rightSide);
  if (s?.match) {
    siblingHits++;
    console.log('SIBLING', t.id);
  }
  const c = checkInferenceRules(L, R, t.leftSide, t.rightSide);
  if (c.match) {
    checkHits++;
    console.log('CHECK', t.id, c.matchPosition?.description);
  }
}
console.log('done siblingHits', siblingHits, 'checkHits', checkHits);

// Also the thm197 fail: j Ps j_1, Blb{i Ps j_1} → Blb{i Ps j}
const L2 = normalizeSpacing(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const R2 = normalizeSpacing(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
siblingHits = 0;
checkHits = 0;
for (const t of all) {
  const s = trySiblingEqualityOnCondition(L2, R2, t.leftSide, t.rightSide);
  if (s?.match) {
    siblingHits++;
    console.log('SIBLING2', t.id);
  }
  const c = checkInferenceRules(L2, R2, t.leftSide, t.rightSide);
  if (c.match) {
    checkHits++;
    console.log('CHECK2', t.id);
  }
}
console.log('done2', siblingHits, checkHits);
