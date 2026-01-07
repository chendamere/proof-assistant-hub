/**
 * Test the actual checkInferenceRules with the fixed candidate extraction
 */

import { normalizeRule } from '../src/lib/operandNormalizer';
import { checkInferenceRules } from '../src/lib/inferenceRules';

const ruleToProveLeft = ",  \\Og x,";
const ruleToProveRight = ",\\Og x, \\Og m, m \\Os,";

const axiomLeft = ",";
const axiomRight = ",\\Og m, m \\Os,";

console.log("Testing actual checkInferenceRules with fixed candidate extraction...\n");

const ruleNormalized = normalizeRule(ruleToProveLeft, ruleToProveRight);
const axiomNormalized = normalizeRule(axiomLeft, axiomRight);

// Manual test

console.log("\nManual test of the substitution:");
console.log(`Rule Right: "${ruleNormalized.right.integerExpression}"`);
console.log(`Axiom Right: "${axiomNormalized.right.integerExpression}"`);
console.log(`Axiom Left: "${axiomNormalized.left.integerExpression}"`);
console.log(`Expected (Rule Left): "${ruleNormalized.left.integerExpression}"`);

// The pattern should match ", \Og 2, 2 \Os," in ruleRight
// Prefix should be ",\Og 1"
// After replacing with empty (because axiomLeft is just ","), we get ",\Og 1"
// But we need ",\Og 1,"

const prefix = ",\\Og 1";
const converted = ""; // empty because axiomLeft is just ","
const suffix = "";
const substituted = prefix + converted + suffix;
console.log(`\nSubstitution:`);
console.log(`  Prefix: "${prefix}"`);
console.log(`  Converted: "${converted}"`);
console.log(`  Suffix: "${suffix}"`);
console.log(`  Substituted: "${substituted}"`);
console.log(`  Expected: "${ruleNormalized.left.integerExpression}"`);

const normalizeSpacing = (expr: string): string => {
  if (!expr) return expr;
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ',')
    .trim();
};

const normalizedSub = normalizeSpacing(substituted);
const normalizedExpected = normalizeSpacing(ruleNormalized.left.integerExpression);
console.log(`  Normalized substituted: "${normalizedSub}"`);
console.log(`  Normalized expected: "${normalizedExpected}"`);
console.log(`  Match? ${normalizedSub === normalizedExpected}`);

if (normalizedSub !== normalizedExpected) {
  console.log(`\n  Trying with comma:`);
  const withComma = prefix + ',' + suffix;
  const normalizedWithComma = normalizeSpacing(withComma);
  console.log(`    With comma: "${withComma}"`);
  console.log(`    Normalized: "${normalizedWithComma}"`);
  console.log(`    Match? ${normalizedWithComma === normalizedExpected}`);
}

const result = checkInferenceRules(
  ruleNormalized.left.integerExpression,
  ruleNormalized.right.integerExpression,
  axiomNormalized.left.integerExpression,
  axiomNormalized.right.integerExpression
);

console.log("\nResult:", JSON.stringify(result, null, 2));

if (result.match) {
  console.log("\n✅ MATCH FOUND!");
  console.log(`Inference Rule: ${result.inferenceRule}`);
  if (result.matchPosition) {
    console.log(`\nMatch Details:`);
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
        console.log(`  Operand Mapping:`);
        result.matchPosition.operandMapping.forEach((value, key) => {
          console.log(`    ${key} → ${value}`);
        });
      }
    }
  }
} else {
  console.log("\n❌ NO MATCH FOUND");
}
