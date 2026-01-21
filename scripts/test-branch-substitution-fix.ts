/**
 * Test script to verify the branch substitution fix
 * 
 * Target: ",\Bb{i \Oe j}{,x \Od m, x \Od n,}{,}, <=> ,\Bb{i \Oe j}{, x \Od n,x \Od m,}{,},"
 * Rule: ",x \Od m, x \Od n, <=> , x \Od n,x \Od m,"
 */

import { normalizeRule } from '../src/lib/operandNormalizer.ts';
import { checkInferenceRules } from '../src/lib/inferenceRules.ts';

// Test case
const targetLeft = ",\\Bb{i \\Oe j}{,x \\Od m, x \\Od n,}{,},";
const targetRight = ",\\Bb{i \\Oe j}{, x \\Od n,x \\Od m,}{,},";

const ruleLeft = ",x \\Od m, x \\Od n,";
const ruleRight = ", x \\Od n,x \\Od m,";

console.log("=".repeat(80));
console.log("BRANCH SUBSTITUTION FIX TEST");
console.log("=".repeat(80));
console.log("\nTarget Rule (to prove):");
console.log(`  Left:  "${targetLeft}"`);
console.log(`  Right: "${targetRight}"`);
console.log("\nTrue Rule (existing):");
console.log(`  Left:  "${ruleLeft}"`);
console.log(`  Right: "${ruleRight}"`);

try {
  // Normalize
  const targetNormalized = normalizeRule(targetLeft, targetRight);
  const ruleNormalized = normalizeRule(ruleLeft, ruleRight);
  
  const targetLeftInt = targetNormalized.left.integerExpression;
  const targetRightInt = targetNormalized.right.integerExpression;
  const ruleLeftInt = ruleNormalized.left.integerExpression;
  const ruleRightInt = ruleNormalized.right.integerExpression;
  
  console.log("\n" + "-".repeat(80));
  console.log("Normalized Expressions");
  console.log("-".repeat(80));
  console.log(`Target Left:  "${targetLeftInt}"`);
  console.log(`Target Right: "${targetRightInt}"`);
  console.log(`Rule Left:    "${ruleLeftInt}"`);
  console.log(`Rule Right:   "${ruleRightInt}"`);
  
  // Check inference rules
  console.log("\n" + "-".repeat(80));
  console.log("Checking Inference Rules");
  console.log("-".repeat(80));
  
  const result = checkInferenceRules(
    targetLeftInt,
    targetRightInt,
    ruleLeftInt,
    ruleRightInt
  );

  if (result.match) {
    console.log("\n✅ MATCH FOUND!");
    console.log(`Inference Rule: ${result.inferenceRule}`);
    if (result.matchPosition) {
      console.log(`\nMatch Details:`);
      console.log(`  Side: ${result.matchPosition.side}`);
      console.log(`  Description: ${result.matchPosition.description}`);
      if (result.matchPosition.wasPatternMatch) {
        console.log(`  Pattern Match: Yes`);
        if (result.matchPosition.operandMapping) {
          console.log("  Operand Mapping:");
          result.matchPosition.operandMapping.forEach((value, key) => {
            console.log(`    ${key} → ${value}`);
          });
        }
      }
    }
  } else {
    console.log("\n❌ NO MATCH FOUND");
    if (result.grammarError) {
      console.log(`Grammar Error: ${result.grammarError}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  
} catch (error) {
  console.error("\n❌ ERROR:", error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
