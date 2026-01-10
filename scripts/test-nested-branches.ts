// Test nested branch matching
import { checkInferenceRules } from '../src/lib/inferenceRules.ts';

const testCases = [
  {
    name: 'Simple Blb matches Bb',
    targetLeft: ', \\Bb{j \\Oe t}{,i \\Op, i \\On, }{,i \\Op, i \\On,}, ',
    targetRight: ', \\Bb{j \\Oe t}{,i \\Op, }{,i \\Op,}, ',
    ruleLeft: ', \\Blb{j \\Oe t}{,i \\Op, }{,i \\Op,}, ',
    ruleRight: ', \\Blb{j \\Oe t}{,i \\Op, }{,i \\Op,}, ',
  },
  {
    name: 'Nested branches - complex case',
    targetLeft: ', \\Bb{j \\Oe t}{,i \\Op, \\Bb{j \\Oe t}{,i \\Op, i \\On, }{,i \\Op, i \\On,},i \\On, }{,i \\Op, i \\On,},',
    targetRight: ', \\Bb{j \\Oe t}{,i \\Op, \\Bb{j \\Oe t}{,i \\Op, }{,i \\Op, },i \\On, }{,i \\Op, i \\On,},',
    ruleLeft: ', \\Blb{j \\Oe t}{,i \\Op, \\Blb{j \\Oe t}{,i \\Op, }{,i \\Op, }, }{,i \\Op, i \\On,},',
    ruleRight: ', \\Blb{j \\Oe t}{,i \\Op, \\Blb{j \\Oe t}{,i \\Op, }{,i \\Op, }, }{,i \\Op, i \\On,},',
  }
];

console.log('Testing nested branch matching...\n');

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  console.log(`Target Left: ${testCase.targetLeft}`);
  console.log(`Target Right: ${testCase.targetRight}`);
  console.log(`Rule Left: ${testCase.ruleLeft}`);
  console.log(`Rule Right: ${testCase.ruleRight}`);
  
  const result = checkInferenceRules(
    testCase.targetLeft,
    testCase.targetRight,
    testCase.ruleLeft,
    testCase.ruleRight
  );
  
  console.log(`Result: ${result.match ? 'MATCH ✅' : 'NO MATCH ❌'}`);
  if (result.match) {
    console.log(`Inference Rule: ${result.inferenceRule}`);
    console.log(`Description: ${result.matchPosition?.description}`);
  }
  if (result.grammarError) {
    console.log(`Grammar Error: ${result.grammarError}`);
  }
  console.log('');
}
