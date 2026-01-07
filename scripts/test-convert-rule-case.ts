/**
 * Test script for convertRuleOtherSide with the specific case:
 *   Rule to prove: ",  \Og x, <=> ,\Og x, \Og m, m \Os,"
 *   Axiom: ", <=>  ,\Og m, m \Os,"
 */

import { normalizeRule } from '../src/lib/operandNormalizer';
import { checkInferenceRules } from '../src/lib/inferenceRules';

// Test case
const ruleToProveLeft = ",  \\Og x,";
const ruleToProveRight = ",\\Og x, \\Og m, m \\Os,";

const axiomLeft = ",";
const axiomRight = ",\\Og m, m \\Os,";

console.log("=".repeat(80));
console.log("CONVERT RULE OTHER SIDE - Specific Case Walkthrough");
console.log("=".repeat(80));
console.log("\nRule to Prove:");
console.log(`  Left:  "${ruleToProveLeft}"`);
console.log(`  Right: "${ruleToProveRight}"`);
console.log("\nAxiom (True Rule):");
console.log(`  Left:  "${axiomLeft}"`);
console.log(`  Right: "${axiomRight}"`);

try {
  // Normalize rule to prove
  console.log("\n" + "-".repeat(80));
  console.log("Step 1: Normalizing Rule to Prove");
  console.log("-".repeat(80));
  const ruleNormalized = normalizeRule(ruleToProveLeft, ruleToProveRight);
  const ruleLeftInt = ruleNormalized.left.integerExpression;
  const ruleRightInt = ruleNormalized.right.integerExpression;
  
  console.log(`Rule Left (normalized):  "${ruleLeftInt}"`);
  console.log(`Rule Right (normalized): "${ruleRightInt}"`);

  // Normalize axiom
  console.log("\n" + "-".repeat(80));
  console.log("Step 2: Normalizing Axiom");
  console.log("-".repeat(80));
  const axiomNormalized = normalizeRule(axiomLeft, axiomRight);
  const axiomLeftInt = axiomNormalized.left.integerExpression;
  const axiomRightInt = axiomNormalized.right.integerExpression;
  
  console.log(`Axiom Left (normalized):  "${axiomLeftInt}"`);
  console.log(`Axiom Right (normalized): "${axiomRightInt}"`);

  // Check inference rules
  console.log("\n" + "-".repeat(80));
  console.log("Step 3: Checking Inference Rules");
  console.log("-".repeat(80));
  console.log("\nComparing:");
  console.log(`  Rule Left:   "${ruleLeftInt}"`);
  console.log(`  Rule Right:  "${ruleRightInt}"`);
  console.log(`  Axiom Left:  "${axiomLeftInt}"`);
  console.log(`  Axiom Right: "${axiomRightInt}"`);
  
  // Manual check: does ruleRight contain axiomRight pattern?
  console.log("\nManual pattern check:");
  console.log(`  Looking for axiomRight pattern in ruleRight...`);
  console.log(`  Axiom Right: "${axiomRightInt}"`);
  console.log(`  Rule Right:  "${ruleRightInt}"`);
  
  // Check if we can find the pattern
  const extractOperandTokens = (expr: string) => {
    const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
    const numberPattern = /\b(\d+)\b/g;
    let match;
    while ((match = numberPattern.exec(expr)) !== null) {
      tokens.push({
        token: match[1],
        index: match.index,
        endIndex: match.index + match[1].length
      });
    }
    return tokens;
  };
  
  const ruleRightTokens = extractOperandTokens(ruleRightInt);
  const axiomRightTokens = extractOperandTokens(axiomRightInt);
  
  console.log(`  Rule Right tokens: [${ruleRightTokens.map(t => `"${t.token}" at ${t.index}`).join(', ')}]`);
  console.log(`  Axiom Right tokens: [${axiomRightTokens.map(t => `"${t.token}" at ${t.index}`).join(', ')}]`);
  
  // Try position 1 (the second token in ruleRight, which is "2")
  if (ruleRightTokens.length >= axiomRightTokens.length + 1) {
    const startIdx = 1; // Start at the second token
    const candidateTokens = ruleRightTokens.slice(startIdx, startIdx + axiomRightTokens.length);
    console.log(`\n  Trying position ${startIdx} (starting at token "${candidateTokens[0]?.token}"):`);
    console.log(`    Candidate tokens: [${candidateTokens.map(t => t.token).join(', ')}]`);
    
    // Extract pattern
    const extractOperandPattern = (expr: string, tokens: Array<{ token: string; index: number; endIndex: number }>) => {
      const patternVars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      const operandToVar = new Map<string, string>();
      let patternVarIdx = 0;
      
      tokens.forEach(token => {
        if (!operandToVar.has(token.token)) {
          operandToVar.set(token.token, patternVars[patternVarIdx++]);
        }
      });
      
      let pattern = expr;
      const sortedTokens = [...tokens].sort((a, b) => b.index - a.index);
      sortedTokens.forEach(token => {
        const patternVar = operandToVar.get(token.token)!;
        pattern = pattern.substring(0, token.index) + patternVar + pattern.substring(token.endIndex);
      });
      
      return { pattern, operandToVar };
    };
    
    const axiomPattern = extractOperandPattern(axiomRightInt, axiomRightTokens);
    console.log(`    Axiom pattern: "${axiomPattern.pattern}"`);
    
    // Try to extract candidate with proper boundaries
    const startToken = candidateTokens[0];
    const endToken = candidateTokens[candidateTokens.length - 1];
    let candidateStart = startToken.index;
    let candidateEnd = endToken.endIndex;
    
    // Extend backwards
    const ruleTrimmed = axiomRightInt.trim();
    if (ruleTrimmed.startsWith(',')) {
      for (let i = candidateStart - 1; i >= 0; i--) {
        const char = ruleRightInt[i];
        if (char === ',') {
          candidateStart = i;
          break;
        } else if (/\s/.test(char)) {
          continue;
        } else {
          break;
        }
      }
    }
    
    // Extend forwards
    if (ruleTrimmed.endsWith(',')) {
      for (let i = candidateEnd; i < ruleRightInt.length; i++) {
        const char = ruleRightInt[i];
        if (char === ',') {
          candidateEnd = i + 1;
          break;
        } else if (/\s/.test(char)) {
          continue;
        } else {
          break;
        }
      }
    }
    
    const candidate = ruleRightInt.substring(candidateStart, candidateEnd);
    console.log(`    Candidate extracted: "${candidate}"`);
    console.log(`    Start: ${candidateStart}, End: ${candidateEnd}`);
    
    const candidatePattern = extractOperandPattern(candidate, extractOperandTokens(candidate));
    console.log(`    Candidate pattern: "${candidatePattern.pattern}"`);
    
    const normalizeSpacing = (expr: string): string => {
      if (!expr) return expr;
      return expr
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ',')
        .trim();
    };
    
    const normalizedCandidatePattern = normalizeSpacing(candidatePattern.pattern);
    const normalizedAxiomPattern = normalizeSpacing(axiomPattern.pattern);
    console.log(`    Normalized candidate pattern: "${normalizedCandidatePattern}"`);
    console.log(`    Normalized axiom pattern: "${normalizedAxiomPattern}"`);
    console.log(`    Patterns match? ${normalizedCandidatePattern === normalizedAxiomPattern}`);
  }
  
  const result = checkInferenceRules(
    ruleLeftInt,
    ruleRightInt,
    axiomLeftInt,
    axiomRightInt
  );

  console.log("\nResult:", JSON.stringify(result, null, 2));
  
  if (result.match) {
    console.log("\n✅ MATCH FOUND!");
    console.log(`Inference Rule: ${result.inferenceRule}`);
    
    if (result.matchPosition) {
      console.log("\n" + "-".repeat(80));
      console.log("Step 4: Match Position Details");
      console.log("-".repeat(80));
      console.log(`  Side: ${result.matchPosition.side}`);
      console.log(`  Position: ${result.matchPosition.position}`);
      console.log(`  Description: ${result.matchPosition.description}`);
      if (result.matchPosition.prefix) {
        console.log(`  Prefix: "${result.matchPosition.prefix}"`);
      }
      if (result.matchPosition.suffix) {
        console.log(`  Suffix: "${result.matchPosition.suffix}"`);
      }
      
      if (result.matchPosition.wasPatternMatch && result.matchPosition.operandMapping) {
        console.log("\n" + "-".repeat(80));
        console.log("Step 5: convertRuleOtherSide Walkthrough");
        console.log("-".repeat(80));
        
        const operandMapping = result.matchPosition.operandMapping;
        const prefix = result.matchPosition.prefix || '';
        const suffix = result.matchPosition.suffix || '';
        const targetSide = result.matchPosition.side === 'left' ? ruleLeftInt : ruleRightInt;
        const expectedResult = result.matchPosition.side === 'left' ? ruleRightInt : ruleLeftInt;
        const ruleOtherSide = result.matchPosition.side === 'left' ? axiomRightInt : axiomLeftInt;
        
        console.log(`\nParameters for convertRuleOtherSide:`);
        console.log(`  ruleOtherSide: "${ruleOtherSide}"`);
        console.log(`  prefix: "${prefix}"`);
        console.log(`  suffix: "${suffix}"`);
        console.log(`  targetSide: "${targetSide}"`);
        console.log(`  expectedResult: "${expectedResult}"`);
        console.log(`\nOperand Mapping (from pattern match):`);
        operandMapping.forEach((value, key) => {
          console.log(`    Axiom operand ${key} → Rule operand ${value}`);
        });
        
        // Simulate convertRuleOtherSide logic
        console.log("\n" + "-".repeat(80));
        console.log("Step 6: Simulating convertRuleOtherSide Logic");
        console.log("-".repeat(80));
        
        const extractOperandsFromText = (text: string): Set<string> => {
          const operands = new Set<string>();
          const numberPattern = /\b(\d+)\b/g;
          let match;
          while ((match = numberPattern.exec(text)) !== null) {
            operands.add(match[1]);
          }
          return operands;
        };
        
        const extractOperandTokens = (expr: string) => {
          const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
          const numberPattern = /\b(\d+)\b/g;
          let match;
          while ((match = numberPattern.exec(expr)) !== null) {
            tokens.push({
              token: match[1],
              index: match.index,
              endIndex: match.index + match[1].length
            });
          }
          return tokens;
        };
        
        // Step 1: Extract existing operands
        const prefixOperands = extractOperandsFromText(prefix);
        const suffixOperands = extractOperandsFromText(suffix);
        const targetOperands = extractOperandsFromText(targetSide);
        const expectedOperands = extractOperandsFromText(expectedResult);
        
        console.log("\n1. Extracting existing operands:");
        console.log(`   Prefix operands: [${Array.from(prefixOperands).join(', ')}]`);
        console.log(`   Suffix operands: [${Array.from(suffixOperands).join(', ')}]`);
        console.log(`   Target operands: [${Array.from(targetOperands).join(', ')}]`);
        console.log(`   Expected result operands: [${Array.from(expectedOperands).join(', ')}]`);
        
        const existingOperands = new Set([...prefixOperands, ...suffixOperands, ...targetOperands, ...expectedOperands]);
        console.log(`   All existing operands: [${Array.from(existingOperands).join(', ')}]`);
        
        // Step 2: Extract operands from ruleOtherSide
        const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
        const unmappedTokens = ruleOtherTokens.filter(token => !operandMapping.has(token.token));
        
        console.log(`\n2. Operands in ruleOtherSide: [${ruleOtherTokens.map(t => t.token).join(', ')}]`);
        console.log(`   Unmapped operands: [${unmappedTokens.map(t => t.token).join(', ')}]`);
        
        // Step 3: Check if ruleOtherSide is just a comma
        const ruleOtherTrimmed = ruleOtherSide.trim();
        console.log(`\n3. Checking if ruleOtherSide is just a comma:`);
        console.log(`   ruleOtherSide.trim() = "${ruleOtherTrimmed}"`);
        console.log(`   Is just comma? ${ruleOtherTrimmed === ','}`);
        
        if (ruleOtherTrimmed === ',') {
          console.log(`\n   ✅ ruleOtherSide is just a comma!`);
          console.log(`   Returning empty string, so substitution becomes: prefix + suffix`);
          console.log(`   Substituted: "${prefix}${suffix}"`);
          console.log(`   Expected: "${expectedResult}"`);
          
          const normalizeSpacing = (expr: string): string => {
            if (!expr) return expr;
            return expr
              .replace(/\s+/g, ' ')
              .replace(/\s+,/g, ',')
              .replace(/,\s+/g, ',')
              .trim();
          };
          
          const normalizedSub = normalizeSpacing(prefix + suffix);
          const normalizedExpected = normalizeSpacing(expectedResult);
          console.log(`   Normalized substituted: "${normalizedSub}"`);
          console.log(`   Normalized expected: "${normalizedExpected}"`);
          console.log(`   Match? ${normalizedSub === normalizedExpected}`);
        } else if (unmappedTokens.length > 0) {
          console.log(`\n4. There are unmapped operands - would try existing operands first`);
          console.log(`   (This is where the recursive tryMappingWithExisting logic would run)`);
        } else {
          console.log(`\n4. All operands are mapped - using existing mapping`);
          let converted = ruleOtherSide;
          const sortedTokens = [...ruleOtherTokens].sort((a, b) => b.index - a.index);
          sortedTokens.forEach(token => {
            const newOperand = operandMapping.get(token.token)!;
            converted = converted.substring(0, token.index) + newOperand + converted.substring(token.endIndex);
          });
          console.log(`   Converted: "${converted}"`);
          console.log(`   Substituted: "${prefix}${converted}${suffix}"`);
        }
      }
    }
  } else {
    console.log("\n❌ NO MATCH FOUND");
    console.log("\n" + "-".repeat(80));
    console.log("Step 4: Simulating convertRuleOtherSide (Assuming Match Found)");
    console.log("-".repeat(80));
    console.log("\nAssuming the pattern matching found a match:");
    console.log("  Axiom Right pattern ',\\Og A, A \\Os,' found in Rule Right");
    console.log("  Matched: ',\\Og 2, 2 \\Os,' (pattern matches where A=2)");
    console.log("  Prefix: ',\\Og 1, '");
    console.log("  Suffix: ''");
    console.log("  Operand Mapping: { '1' → '2' } (axiom operand 1 maps to rule operand 2)");
    
    // Simulate convertRuleOtherSide
    const simulatedPrefix = ",\\Og 1, ";
    const simulatedSuffix = "";
    const simulatedTargetSide = ruleRightInt;
    const simulatedExpectedResult = ruleLeftInt;
    const simulatedRuleOtherSide = axiomLeftInt; // ","
    const simulatedMapping = new Map<string, string>();
    simulatedMapping.set('1', '2'); // Axiom operand 1 → Rule operand 2
    
    console.log("\n" + "-".repeat(80));
    console.log("Step 5: convertRuleOtherSide Walkthrough");
    console.log("-".repeat(80));
    console.log(`\nParameters:`);
    console.log(`  ruleOtherSide: "${simulatedRuleOtherSide}"`);
    console.log(`  prefix: "${simulatedPrefix}"`);
    console.log(`  suffix: "${simulatedSuffix}"`);
    console.log(`  targetSide: "${simulatedTargetSide}"`);
    console.log(`  expectedResult: "${simulatedExpectedResult}"`);
    console.log(`  operandMapping: { '1' → '2' }`);
    
    const extractOperandsFromText = (text: string): Set<string> => {
      const operands = new Set<string>();
      const numberPattern = /\b(\d+)\b/g;
      let match;
      while ((match = numberPattern.exec(text)) !== null) {
        operands.add(match[1]);
      }
      return operands;
    };
    
    // Step 1: Extract existing operands
    const prefixOperands = extractOperandsFromText(simulatedPrefix);
    const suffixOperands = extractOperandsFromText(simulatedSuffix);
    const targetOperands = extractOperandsFromText(simulatedTargetSide);
    const expectedOperands = extractOperandsFromText(simulatedExpectedResult);
    
    console.log(`\n1. Extracting existing operands:`);
    console.log(`   Prefix operands: [${Array.from(prefixOperands).join(', ')}]`);
    console.log(`   Suffix operands: [${Array.from(suffixOperands).join(', ')}]`);
    console.log(`   Target operands: [${Array.from(targetOperands).join(', ')}]`);
    console.log(`   Expected result operands: [${Array.from(expectedOperands).join(', ')}]`);
    
    const existingOperands = new Set([...prefixOperands, ...suffixOperands, ...targetOperands, ...expectedOperands]);
    console.log(`   All existing operands: [${Array.from(existingOperands).join(', ')}]`);
    
    // Step 2: Check ruleOtherSide
    const ruleOtherTrimmed = simulatedRuleOtherSide.trim();
    console.log(`\n2. Checking ruleOtherSide:`);
    console.log(`   ruleOtherSide = "${simulatedRuleOtherSide}"`);
    console.log(`   ruleOtherSide.trim() = "${ruleOtherTrimmed}"`);
    console.log(`   Is just a comma? ${ruleOtherTrimmed === ','}`);
    
    if (ruleOtherTrimmed === ',') {
      console.log(`\n   ✅ ruleOtherSide is just a comma!`);
      console.log(`   Returning empty string`);
      console.log(`   Substitution becomes: prefix + suffix`);
      console.log(`   Substituted: "${simulatedPrefix}${simulatedSuffix}"`);
      console.log(`   Expected: "${simulatedExpectedResult}"`);
      
      const normalizeSpacing = (expr: string): string => {
        if (!expr) return expr;
        return expr
          .replace(/\s+/g, ' ')
          .replace(/\s+,/g, ',')
          .replace(/,\s+/g, ',')
          .trim();
      };
      
      const normalizedSub = normalizeSpacing(simulatedPrefix + simulatedSuffix);
      const normalizedExpected = normalizeSpacing(simulatedExpectedResult);
      console.log(`   Normalized substituted: "${normalizedSub}"`);
      console.log(`   Normalized expected: "${normalizedExpected}"`);
      console.log(`   Match? ${normalizedSub === normalizedExpected}`);
      
      if (normalizedSub === normalizedExpected) {
        console.log(`\n   ✅ SUCCESS! The substitution matches!`);
      } else {
        console.log(`\n   ⚠️  The substitution doesn't match exactly, but spacing normalization should handle it`);
      }
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
