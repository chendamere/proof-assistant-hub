import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

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
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
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
function hop(a: string, b: string, label: string) {
  const id = j(a, b);
  console.log(label, id);
  if (!id) process.exit(1);
  return b;
}

const R = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

let cur = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

cur = hop(
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
    )
  ),
  'swapOs'
);

cur = hop(
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},'
    )
  ),
  'osBoth'
);

cur = hop(
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}',
      '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}'
    )
  ),
  'cidTrue'
);

// Pull Os from false
const pullF = ensure(
  cur.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,', '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,')
);
console.log('cidTrue->pullF', j(cur, pullF));

// create-temp in true of cidTrue (with Os still in false)
const temp1 = ensure(
  cur.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}')
);
console.log('cidTrue->temp1', j(cur, temp1));

// From pullF: Bb{}{Od}, s2 Os, t2 Os
const temp2 = ensure(
  pullF.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,}')
);
console.log('pullF->temp2', j(pullF, temp2));

// Pull Os from true of temp2: Bb{Ot}{Od}, s2 Os, s2 Os, t2 Os — two s2 Os?
const pullT = ensure(
  temp2.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,s_2 \\Os,t_2 \\Os,'
  )
);
console.log('temp2->pullT', j(temp2, pullT));

// Better: from temp2 cancel one Os via create-temp reverse? That removes Ot too.
// From temp1: Bb{Ot, Os}{Od, Os}, t2 Os — create-id false leaves Bb{Ot,Os}{}, bad
// Pull false Os from temp1:
const pullF2 = ensure(
  temp1.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
  )
);
console.log('temp1->pullF2', j(temp1, pullF2));

// Now Bb{Ot, Os}{Od}, s2 Os, t2 Os — need remove Os from true without touching Ot
// equiv-code-dist reverse for Os from true only?
const pullT2 = ensure(
  pullF2.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,s_2 \\Os,t_2 \\Os,'
  )
);
console.log('pullF2->pullT2', j(pullF2, pullT2));

// Swap Os past Ot in true then... no

// Use DIFFERENT temp name for create-temp to avoid s2 conflict, then Pe?
const tempU = ensure(
  cur.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}', '\\Bb{t_2 \\Pc j}{,\\Ot u,u \\Os,}{,i \\Od s_2,s_2 \\Os,}')
);
console.log('cidTrue->tempU', j(cur, tempU));

// Check connectivity / subnode for how first sandwich Ot was introduced in the book
// Search tex for Ot s_2 near 122
import fs from 'fs';
import path from 'path';
const tex = fs.readFileSync(
  path.join('src/data/theorems/Rules_of_Relationship_of_Subnode.tex'),
  'utf8'
);
const idx = tex.indexOf('t_2 \\Pc j');
console.log('tex idx', idx);
if (idx > 0) {
  console.log(tex.slice(Math.max(0, idx - 400), idx + 200).replace(/\s+/g, ' '));
}
