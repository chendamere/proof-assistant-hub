import { exprToDAG, dagToExpr } from '../src/lib/dag';

// Simple chain
const s1 = ', 1 \\Oc 2, 2 \\Os,';
const d1 = exprToDAG(s1);
console.log('Simple:', JSON.stringify(dagToExpr(d1, new Map())));
console.log('Expected:', JSON.stringify(s1));

// With mapping - this is what convertRuleOtherSideWithDAG produces for ruleRight
const d2 = exprToDAG(', i \\Oc m, m \\Os,');
const out = dagToExpr(d2, new Map([['i','1'],['m','2']]));
console.log('\nWith map i->1,m->2:', JSON.stringify(out));
console.log('Target format: prefix="," suffix="," so result = prefix+out+suffix');
console.log('Would be:', JSON.stringify(',' + out + ','));
