/**
 * Terminal entry for the proof engine.
 *
 *   npx tsx engine/src/cli.ts parse ",i \Od m,"
 *   npx tsx engine/src/cli.ts grammar ",i \Od m,"
 *   npx tsx engine/src/cli.ts check "<targetLeft>" "<targetRight>" "<ruleLeft>" "<ruleRight>"
 *
 * Does not import the website. A later build can bundle this file into a standalone executable.
 */

import { dagToExpr, exprToDAG } from './dag/index';
import { checkGrammar } from './grammarChecker';
import { checkInferenceRules } from './inferenceRules/index';

function args(): string[] {
  return process.argv.slice(2);
}

function usage(): string {
  return [
    'Usage:',
    '  prove parse "<expression>"',
    '  prove grammar "<expression>"',
    '  prove check "<targetLeft>" "<targetRight>" "<ruleLeft>" "<ruleRight>"',
  ].join('\n');
}

function cmdParse(expr: string): void {
  const dag = exprToDAG(expr);
  console.log(`nodes: ${dag.nodes.length}`);
  console.log(`edges: ${dag.edges.length}`);
  for (const node of dag.nodes) {
    const data = node.data;
    if (!data) continue;
    const operands = data.operands.length ? ` ${data.operands.join(' ')}` : '';
    console.log(`  ${node.id}: ${data.op}${operands}`);
  }
  console.log(`roundtrip: ${dagToExpr(dag)}`);
}

function cmdGrammar(expr: string): void {
  const result = checkGrammar(expr);
  console.log(result.isValid ? 'valid' : 'invalid');
  for (const error of result.errors) {
    console.log(`  ${error.position}: ${error.message}`);
  }
  process.exit(result.isValid ? 0 : 1);
}

function cmdCheck(targetLeft: string, targetRight: string, ruleLeft: string, ruleRight: string): void {
  const result = checkInferenceRules(targetLeft, targetRight, ruleLeft, ruleRight);
  if (result.match) {
    console.log(`match: ${result.inferenceRule ?? 'yes'}`);
    if (result.matchPosition?.description) console.log(result.matchPosition.description);
    process.exit(0);
  }
  console.log('no match');
  if (result.grammarError) console.log(result.grammarError);
  process.exit(1);
}

const [command, ...rest] = args();

if (command === 'parse' && rest.length === 1) {
  cmdParse(rest[0]);
} else if (command === 'grammar' && rest.length === 1) {
  cmdGrammar(rest[0]);
} else if (command === 'check' && rest.length === 4) {
  cmdCheck(rest[0], rest[1], rest[2], rest[3]);
} else {
  console.log(usage());
  process.exit(command ? 1 : 0);
}
