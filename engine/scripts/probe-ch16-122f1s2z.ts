import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import fs from 'fs';
import path from 'path';

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
function hop(label: string, a: string, b: string) {
  const id = j(a, b);
  console.log(label, id);
  if (!id) {
    console.log('FAIL');
    process.exit(1);
  }
  return ensure(b);
}

const fails = fs
  .readFileSync(path.join('engine/scripts/out/recheck-ch16.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x: { key: string; step: number; part?: string }) =>
    x.key.includes('::122::') && x.step === 2 && String(x.part || '').includes('1')
)!;
const L = ensure(f.left);
const R = ensure(f.right);

let cur = L;
cur = hop('create-id', cur, ensure(',i \\Od s_2,s_2 \\Os,' + L.slice(1)));
cur = hop(
  'null-12 Os',
  cur,
  ensure(
    cur.replace(
      ',i \\Od s_2,s_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,}{,i \\Ob t_1,',
      ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,'
    )
  )
);
cur = hop(
  'null-10 Od',
  cur,
  ensure(
    cur.replace(
      ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,',
      ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
    )
  )
);
cur = hop(
  'swap true Os past Od',
  cur,
  ensure(cur.replace('{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}', '{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}'))
);
cur = hop(
  'swap true Od order',
  cur,
  ensure(cur.replace('{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}', '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'))
);

// front create-subnode
cur = hop('create-subnode front', cur, ensure(',i \\Ob t_2,t_2 \\Os,' + cur.slice(1)));
cur = hop(
  'null-12 Os into Bb',
  cur,
  ensure(
    cur.replace(
      ',i \\Ob t_2,t_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
      ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
    )
  )
);
cur = hop(
  'null-11 Ob into Bb',
  cur,
  ensure(
    cur.replace(
      ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
      ',\\Bb{i \\Pu}{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
    )
  )
);
cur = hop(
  'drop true Ob+Os',
  cur,
  ensure(
    cur.replace(
      '{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
      '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
    )
  )
);

// sandwich expand in false
cur = hop(
  'empty Bb',
  cur,
  ensure(
    cur.replace(
      '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
      '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
    )
  )
);
cur = hop(
  'swap Os Od',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,t_2 \\Os,s_2 \\Os,'
    )
  )
);
cur = hop(
  'Od both arms',
  cur,
  ensure(
    cur.replace(
      'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,',
      'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},'
    )
  )
);
cur = hop(
  'swap Os releases',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
    )
  )
);
cur = hop(
  'Os both arms',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},'
    )
  )
);
cur = hop(
  'cid true',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}',
      '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}'
    )
  )
);
cur = hop(
  'create-temp true',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}',
      '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}'
    )
  )
);
cur = hop(
  'pull Os both',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,',
      '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
    )
  )
);
cur = hop(
  'order Os',
  cur,
  ensure(cur.replace(',s_2 \\Os,t_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,s_2 \\Os,i \\Ob t_1,'))
);

// move s2 Os past t1 sandwich
cur = hop(
  'Os past Ob t1',
  cur,
  ensure(cur.replace(',t_2 \\Os,s_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,i \\Ob t_1,s_2 \\Os,'))
);
cur = hop(
  'Os into t1 Bb',
  cur,
  ensure(
    cur.replace(
      ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
      ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},'
    )
  )
);
cur = hop(
  'reorder true arm Os',
  cur,
  ensure(cur.replace('{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,s_2 \\Os,i \\Od s_1,}'))
);
cur = hop(
  'reorder false arm Os',
  cur,
  ensure(cur.replace('{,\\Ot s_1,s_2 \\Os,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,}'))
);
cur = hop(
  'pull Os mid',
  cur,
  ensure(
    cur.replace(
      '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,},t_1 \\Os,',
      '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},s_2 \\Os,t_1 \\Os,'
    )
  )
);
cur = hop(
  'Os to end',
  cur,
  ensure(cur.replace(',s_2 \\Os,t_1 \\Os,', ',t_1 \\Os,s_2 \\Os,'))
);

const swapped = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
cur = hop('swap sandwiches', cur, swapped);
console.log('eq R', cur === R);
