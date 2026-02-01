/**
 * Test script for generateSubexpressions.
 * Generates all valid subexpressions for expressions with branches (\Bb, \Blb, \Brb).
 * Branch-containing results are displayed in tree format.
 */

import { generateSubexpressions } from '../src/lib/inferenceRules/subexpressions.ts';
import { formatBranchTree } from '../src/lib/inferenceRules/branchTreeFormat.ts';

const tests = [
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, c \\On,}{, d \\On,}, j \\Op,",
    expected: [] as string[],
    description: 'expr: single Bb with prefix and suffix'
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, c \\On, c \\Op,}{, d \\On,d \\Op,}, j \\Op,",
    expected: [] as string[],
    description: 'expr: single Bb with prefix and suffix'
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{,\\Bb{a \\Pe b}{, c \\On, c  \\Op,}{, d \\On, d \\Op,},}{, d \\On, }, ",
    expected: [] as string[],
    description: 'expr2: nested Bb in top arm'
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, i \\Op,\\Bb{a \\Pe b}{, c \\On, c  \\Op,}{, d \\On, d \\Op,},}{, d \\On, }, i \\Op, ",
    expected: [] as string[],
    description: 'expr3: nested Bb in top with operation before'
  },
];

for (const test of tests.slice(0,1)) {
  console.log('='.repeat(80));
  console.log('Test:', test.description);
  console.log('Input:', test.expr);
  console.log('-'.repeat(80));

  const result = generateSubexpressions(test.expr);
  const normalized = test.expr.replace(/\s{2,}/g, ' ');

  console.log('Count:', result.length);

  result.forEach((r, i) => {
    const pos = normalized.indexOf(r);
    const start = pos < 0 ? -1 : pos;
    // if (/\\B[lr]b|\\Bb/.test(r)) {
    //   console.log(`${i + 1}. [${start}]`);
    //   console.log(formatBranchTree(r));
    // } else {
      console.log(`${i + 1}. [${start}] ${JSON.stringify(r)}`);
    // }
  });

  console.log('');
}
