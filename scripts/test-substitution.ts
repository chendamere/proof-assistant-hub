/**
 * Test script for substitution pattern matching
 * Tests the example: 
 *   Target: ",x \Op ,x \Od y, a \Oc b, <=> ,x \Op ,a \Oc b, x \Od y,"
 *   Rule: ",i \Od j, n \Oc m, <=> , n \Oc m,i \Od j,"
 */

import { normalizeRule } from '../src/lib/operandNormalizer.ts';
import { checkInferenceRules } from '../src/lib/inferenceRules.ts';

// Test case
const targetLeft = ",x \\Op ,x \\Od y, a \\Oc b,";
const targetRight = ",x \\Op ,a \\Oc b, x \\Od y,";

const ruleLeft = ",i \\Od j, n \\Oc m,";
const ruleRight = ", n \\Oc m,i \\Od j,";

console.log("=".repeat(80));
console.log("SUBSTITUTION PATTERN MATCHING TEST");
console.log("=".repeat(80));
console.log("\nTarget Rule (to prove):");
console.log(`  Left:  "${targetLeft}"`);
console.log(`  Right: "${targetRight}"`);
console.log("\nTrue Rule (existing):");
console.log(`  Left:  "${ruleLeft}"`);
console.log(`  Right: "${ruleRight}"`);

try {
  // Normalize target rule
  console.log("\n" + "-".repeat(80));
  console.log("Step 1: Normalizing Target Rule");
  console.log("-".repeat(80));
  const targetNormalized = normalizeRule(targetLeft, targetRight);
  const targetLeftInt = targetNormalized.left.integerExpression;
  const targetRightInt = targetNormalized.right.integerExpression;
  
  console.log(`Target Left (normalized):  "${targetLeftInt}"`);
  console.log(`Target Right (normalized): "${targetRightInt}"`);
  console.log("\nTarget Left Operands:", targetNormalized.left.operands.map(op => ({
    original: op.original,
    normalized: op.normalized,
    integer: op.normalizedNumber
  })));
  console.log("Target Right Operands:", targetNormalized.right.operands.map(op => ({
    original: op.original,
    normalized: op.normalized,
    integer: op.normalizedNumber
  })));

  // Normalize rule
  console.log("\n" + "-".repeat(80));
  console.log("Step 2: Normalizing True Rule");
  console.log("-".repeat(80));
  const ruleNormalized = normalizeRule(ruleLeft, ruleRight);
  const ruleLeftInt = ruleNormalized.left.integerExpression;
  const ruleRightInt = ruleNormalized.right.integerExpression;
  
  console.log(`Rule Left (normalized):  "${ruleLeftInt}"`);
  console.log(`Rule Right (normalized): "${ruleRightInt}"`);
  console.log("\nRule Left Operands:", ruleNormalized.left.operands.map(op => ({
    original: op.original,
    normalized: op.normalized,
    integer: op.normalizedNumber
  })));
  console.log("Rule Right Operands:", ruleNormalized.right.operands.map(op => ({
    original: op.original,
    normalized: op.normalized,
    integer: op.normalizedNumber
  })));

  // Check inference rules
  console.log("\n" + "-".repeat(80));
  console.log("Step 3: Checking Inference Rules");
  console.log("-".repeat(80));
  console.log("\nComparing:");
  console.log(`  Target Left:  "${targetLeftInt}"`);
  console.log(`  Target Right: "${targetRightInt}"`);
  console.log(`  Rule Left:    "${ruleLeftInt}"`);
  console.log(`  Rule Right:   "${ruleRightInt}"`);
  
  // Manual check: does targetLeft contain ruleLeft?
  console.log("\nManual substring check:");
  const ruleLeftInTarget = targetLeftInt.includes(ruleLeftInt);
  console.log(`  Does targetLeft contain ruleLeft? ${ruleLeftInTarget}`);
  if (ruleLeftInTarget) {
    const index = targetLeftInt.indexOf(ruleLeftInt);
    console.log(`  Found at index: ${index}`);
    const prefix = targetLeftInt.substring(0, index);
    const suffix = targetLeftInt.substring(index + ruleLeftInt.length);
    console.log(`  Prefix: "${prefix}"`);
    console.log(`  Suffix: "${suffix}"`);
    const substituted = prefix + ruleRightInt + suffix;
    console.log(`  Substituted: "${substituted}"`);
    console.log(`  Target Right: "${targetRightInt}"`);
    console.log(`  Exact Match? ${substituted === targetRightInt}`);
    
    // Test spacing normalization
    const normalizeSpacing = (expr: string): string => {
      if (!expr) return expr;
      return expr
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ',')
        .trim();
    };
    const normalizedSub = normalizeSpacing(substituted);
    const normalizedTarget = normalizeSpacing(targetRightInt);
    console.log(`  Normalized Substituted: "${normalizedSub}"`);
    console.log(`  Normalized Target Right: "${normalizedTarget}"`);
    console.log(`  Normalized Match? ${normalizedSub === normalizedTarget}`);
  }
  
  const result = checkInferenceRules(
    targetLeftInt,
    targetRightInt,
    ruleLeftInt,
    ruleRightInt
  );

  console.log("\nResult:", result);
  
  if (result.match) {
    console.log("\n✅ MATCH FOUND!");
    console.log(`Inference Rule: ${result.inferenceRule}`);
    if (result.matchPosition) {
      console.log("\nMatch Position Details:");
      console.log(`  Side: ${result.matchPosition.side}`);
      console.log(`  Position: ${result.matchPosition.position}`);
      console.log(`  Description: ${result.matchPosition.description}`);
      if (result.matchPosition.prefix) {
        console.log(`  Prefix: "${result.matchPosition.prefix}"`);
      }
      if (result.matchPosition.suffix) {
        console.log(`  Suffix: "${result.matchPosition.suffix}"`);
      }
      if (result.matchPosition.wasPatternMatch) {
        console.log(`  Pattern Match: Yes`);
        if (result.matchPosition.operandMapping) {
          console.log("  Operand Mapping:");
          result.matchPosition.operandMapping.forEach((value, key) => {
            console.log(`    Rule operand ${key} → Target operand ${value}`);
          });
        }
      } else {
        console.log(`  Pattern Match: No (exact match)`);
      }
    }
  } else {
    console.log("\n❌ NO MATCH FOUND");
    console.log("The substitution pattern matching did not find a match.");
  }

  console.log("\n" + "=".repeat(80));
  
} catch (error) {
  console.error("\n❌ ERROR:", error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
