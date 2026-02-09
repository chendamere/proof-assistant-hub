/**
 * Compare results from vf2ExprSubgraphIsomorphismAll vs SingleRootDAGInjection.
 * Examples: simple chain, branch, branch-within-branch, \Tc, and deep nesting.
 *
 * Run: npx tsx scripts/compare-vf2-vs-singleroot.ts
 */

import {
  exprToDAG,
  vf2ExprSubgraphIsomorphismAll,
  augmentTargetDAGForTcMatching,
} from '../src/lib/dag';
import { SingleRootDAGInjection } from '../src/lib/dag/vf2Expr';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import type { DAGStructure, ExprNodeData } from '../src/lib/dag/types';

function mapToKey(m: Map<string, string>): string {
  return JSON.stringify([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function runBoth(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>,
  augmentForTc = false
): {
  vf2All: Array<{ mapping: Map<string, string>; operandMapping: Map<string, string> }>;
  singleRoot: Array<{ mapping: Map<string, string>; operandMapping: Map<string, string> }>;
} {
  let t = target;
  if (augmentForTc && pattern.nodes.length > target.nodes.length) {
    t = augmentTargetDAGForTcMatching(target);
  }
  const vf2All = [...vf2ExprSubgraphIsomorphismAll(pattern, t)];
  const singleRoot = [...SingleRootDAGInjection(pattern, target)];
  return { vf2All, singleRoot };
}

console.log('Compare vf2ExprSubgraphIsomorphismAll vs SingleRootDAGInjection');
console.log('For \\Tc cases, target is augmented before both when pattern > target.\n');

function compare(
  label: string,
  patternExpr: string,
  targetExpr: string,
  augmentForTc = false
) {
  console.log('\n' + '='.repeat(70));
  console.log(label);
  console.log('='.repeat(70));
  const pattern = exprToDAG(normalizeSpacing(patternExpr));
  let target = exprToDAG(normalizeSpacing(targetExpr));

  const patternNodes = pattern.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', ');
  const targetNodes = target.nodes.map((n) => (n.data as ExprNodeData)?.op ?? '?').join(', ');

  console.log('\nPattern:', patternExpr.slice(0, 80) + (patternExpr.length > 80 ? '...' : ''));
  console.log('Pattern nodes:', pattern.nodes.length, '→', patternNodes);
  console.log('\nTarget:', targetExpr.slice(0, 80) + (targetExpr.length > 80 ? '...' : ''));
  console.log('Target nodes:', target.nodes.length, '→', targetNodes);

  const { vf2All, singleRoot } = runBoth(pattern, target, augmentForTc);

  const vf2Keys = new Set(vf2All.map((r) => mapToKey(r.mapping)));
  const singleKeys = new Set(singleRoot.map((r) => mapToKey(r.mapping)));

  console.log('\n--- Results ---');
  console.log('vf2ExprSubgraphIsomorphismAll:  ', vf2All.length, 'match(es)');
  console.log('SingleRootDAGInjection:         ', singleRoot.length, 'match(es)');

  const onlyVf2 = [...vf2Keys].filter((k) => !singleKeys.has(k));
  const onlySingle = [...singleKeys].filter((k) => !vf2Keys.has(k));
  const common = [...vf2Keys].filter((k) => singleKeys.has(k));

  if (onlyVf2.length > 0) {
    console.log('\nOnly in vf2All:', onlyVf2.length);
    onlyVf2.slice(0, 2).forEach((k, i) => console.log('  ', i + 1, JSON.parse(k)));
  }
  if (onlySingle.length > 0) {
    console.log('\nOnly in SingleRoot:', onlySingle.length);
    onlySingle.slice(0, 2).forEach((k, i) => console.log('  ', i + 1, JSON.parse(k)));
  }
  if (common.length > 0 && (onlyVf2.length > 0 || onlySingle.length > 0)) {
    console.log('\nCommon to both:', common.length);
  }

  const agree = onlyVf2.length === 0 && onlySingle.length === 0;
  console.log('\n→', agree ? '✓ AGREE' : '✗ DIFFER');

  if (singleRoot.length > 0) {
    console.log('\nSample SingleRoot match:');
    const r = singleRoot[0];
    console.log('  mapping:', Object.fromEntries(r.mapping));
    console.log('  operandMapping:', Object.fromEntries(r.operandMapping));
  }
  if (vf2All.length > 0 && vf2All.length !== singleRoot.length) {
    console.log('\nSample vf2All match:');
    const r = vf2All[0];
    console.log('  mapping:', Object.fromEntries(r.mapping));
    console.log('  operandMapping:', Object.fromEntries(r.operandMapping));
  }
}

// --- Examples ---

// 1. Simple chain (no branch)
compare(
  '1. Simple chain',
  ',i \\Os, \\Or,',
  ',i \\Od m, j \\Od n, \\Bb{if(m \\Pe n)}{,m \\Os, n \\Os, }{,m \\Os, n \\Os, \\Or,},'
);

// 2. Simple branch (Bb with two arms)
compare(
  '2. Simple branch',
  ',\\Bb{i \\Oe j}{,x \\Or,}{,y \\Or,},',
  ',\\Bb{if(i \\Pu)}{,a \\Or,}{,b \\Or,},'
);

// 3. Branch within branch
compare(
  '3. Branch within branch',
  ',\\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,a \\Or,}{,b \\Or,},}{,c \\Or,},',
  ',\\Bb{if(i \\Pu)}{,\\Bb{if(m \\Pu)}{,1 \\Or,}{,2 \\Or,},}{,3 \\Or,},'
);

// 4. Exact match (trivial)
compare('4. Exact match', ',x \\Or,', ',x \\Or,');

// 5. \Tc: pattern has more nodes (empty arms)
// SingleRootDAGInjection augments internally; for fair comparison we augment for vf2All too
compare(
  '5. \\Tc - branch with empty arms (pattern > target)',
  ', \\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc c_1,}{,\\Tc c_2,},}{, \\Bb{m \\Oe n}{,\\Tc c_3,}{,\\Tc c_4,},},',
  ',\\Bb{if(i \\Pu)}{, \\Bb{if(m \\Pu)}{,}{,\\Or,},}{, \\Bb{if(m \\Pu)}{, \\Or,}{, \\Or,},},',
  true
);

// 6. Branch with one \Tc arm
compare(
  '6. Branch with one \\Tc arm',
  ',\\Bb{i \\Oe j}{,\\Tc c,}{,x \\Or,},',
  ',\\Bb{if(i \\Pu)}{,}{,a \\Or,},',
  true
);

// 7. Nested branch with \Tc in inner arms
compare(
  '7. Branch within branch with \\Tc',
  ',\\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc a,}{,\\Tc b,},}{,c \\Or,},',
  ',\\Bb{if(i \\Pu)}{,\\Bb{if(m \\Pu)}{,}{,\\Or,},}{,1 \\Or,},',
  true
);

// 8. No match (pattern too large, no Tc)
compare('8. No match - pattern larger', ',a \\Os, b \\Os, \\Or,', ',x \\Or,');

// 9. Multiple embeddings - pattern smaller, multiple valid positions
compare(
  '9. Multiple embeddings - pattern in larger target',
  ',m \\Os,',
  ',m \\Os, n \\Os, \\Or,'
);

// 10. Symmetric branch - two identical arms, multiple valid Tc mappings
compare(
  '10. Symmetric branch with \\Tc - both arms empty',
  ',\\Bb{i \\Oe j}{,\\Tc a,}{,\\Tc b,},',
  ',\\Bb{if(i \\Pu)}{,}{,},',
  true
);

// 11. Deep nesting - branch within branch within branch
compare(
  '11. Triple nested branch',
  ',\\Bb{a \\Oe b}{,\\Bb{c \\Oe d}{,\\Bb{e \\Oe f}{,x \\Or,}{,y \\Or,},}{,z \\Or,},}{,w \\Or,},',
  ',\\Bb{if(a \\Pu)}{,\\Bb{if(c \\Pu)}{,\\Bb{if(e \\Pu)}{,1 \\Or,}{,2 \\Or,},}{,3 \\Or,},}{,4 \\Or,},'
);
