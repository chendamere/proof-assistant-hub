/**
 * End-to-end test for branch substitution
 * This simulates what happens in trySubstitution to verify the fix works
 */

import { normalizeRule } from '../src/lib/operandNormalizer.ts';
import { checkInferenceRules } from '../src/lib/inferenceRules.ts';

// Test case
const targetLeft = ",\\Bb{i \\Oe j}{,x \\Od m, x \\Od n,}{,},";
const targetRight = ",\\Bb{i \\Oe j}{, x \\Od n,x \\Od m,}{,},";

const ruleLeft = ",x \\Od m, x \\Od n,";
const ruleRight = ", x \\Od n,x \\Od m,";

console.log("=".repeat(80));
console.log("END-TO-END BRANCH SUBSTITUTION TEST");
console.log("=".repeat(80));

try {
  // Normalize
  const targetNormalized = normalizeRule(targetLeft, targetRight);
  const ruleNormalized = normalizeRule(ruleLeft, ruleRight);
  
  const targetLeftInt = targetNormalized.left.integerExpression;
  const targetRightInt = targetNormalized.right.integerExpression;
  const ruleLeftInt = ruleNormalized.left.integerExpression;
  const ruleRightInt = ruleNormalized.right.integerExpression;
  
  console.log("\nNormalized:");
  console.log(`Target: ${targetLeftInt} <=> ${targetRightInt}`);
  console.log(`Rule:   ${ruleLeftInt} <=> ${ruleRightInt}`);
  
  // Check inference rules - this should now work with the fix
  console.log("\n" + "-".repeat(80));
  console.log("Testing Inference Rules");
  console.log("-".repeat(80));
  
  const result = checkInferenceRules(
    targetLeftInt,
    targetRightInt,
    ruleLeftInt,
    ruleRightInt
  );

  if (result.match) {
    console.log("\n✅ SUCCESS: Match found!");
    console.log(`Inference Rule: ${result.inferenceRule}`);
    console.log(`Description: ${result.matchPosition?.description}`);
    
    // Verify the substitution would actually work
    if (result.matchPosition) {
      console.log("\n" + "-".repeat(80));
      console.log("Verifying Substitution");
      console.log("-".repeat(80));
      
      const normalizeSpacing = (expr: string): string => {
        if (!expr) return expr;
        return expr
          .replace(/\s+/g, ' ')
          .replace(/\s+,/g, ',')
          .replace(/,\s+/g, ',')
          .trim();
      };
      
      // Extract branch operator
      const extractBranchOperator = (expr: string) => {
        const branchOpRegex = /\\(B[blrs]+)/g;
        const match = branchOpRegex.exec(expr);
        if (!match) return null;
        
        const operatorFull = match[0];
        const operator = match[1];
        const opStartIndex = match.index;
        let currentIndex = match.index + operatorFull.length;
        
        while (currentIndex < expr.length && /\s/.test(expr[currentIndex])) {
          currentIndex++;
        }
        
        const branches: string[] = [];
        
        while (currentIndex < expr.length && expr[currentIndex] === '{') {
          let braceCount = 0;
          let branchContent = '';
          
          for (let i = currentIndex; i < expr.length; i++) {
            if (expr[i] === '{') {
              braceCount++;
              if (braceCount === 1) continue;
            } else if (expr[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                branches.push(branchContent);
                currentIndex = i + 1;
                break;
              }
            }
            if (braceCount > 0) {
              branchContent += expr[i];
            }
          }
          
          if (braceCount !== 0) return null;
          
          while (currentIndex < expr.length && /\s/.test(expr[currentIndex])) {
            currentIndex++;
          }
        }
        
        if (branches.length === 0) return null;
        
        let condition: string | null = null;
        let resultBranches: string[] = [];
        
        if (operator === 'Bb' || operator === 'Blb') {
          if (branches.length >= 1) {
            condition = branches[0];
            resultBranches = branches.slice(1);
          }
        } else if (operator === 'Br') {
          resultBranches = branches;
        } else {
          if (branches.length >= 1) {
            condition = branches[0];
            resultBranches = branches.slice(1);
          }
        }
        
        return {
          operator,
          index: opStartIndex,
          endIndex: currentIndex,
          condition,
          branches: resultBranches
        };
      };
      
      const targetBranch = extractBranchOperator(targetLeftInt);
      const expectedBranch = extractBranchOperator(targetRightInt);
      
      if (targetBranch && expectedBranch && result.matchPosition.description?.includes('Rule found in branch')) {
        const branchMatch = result.matchPosition.description.match(/branch (\d+)/);
        if (branchMatch) {
          const branchIndex = parseInt(branchMatch[1]);
          const expectedBranchContent = expectedBranch.branches[branchIndex];
          
          console.log(`\nBranch ${branchIndex} content:`);
          console.log(`  Target:   "${targetBranch.branches[branchIndex]}"`);
          console.log(`  Expected: "${expectedBranchContent}"`);
          
          if (result.matchPosition.operandMapping) {
            console.log("\nOperand Mapping:");
            result.matchPosition.operandMapping.forEach((value, key) => {
              console.log(`  ${key} → ${value}`);
            });
            
            // Convert rule right side
            const convertOperands = (expr: string, mapping: Map<string, string>): string => {
              // Extract tokens and replace from right to left (like the actual function does)
              const extractOperandTokens = (expr: string): Array<{ token: string; index: number; endIndex: number }> => {
                const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
                const operandPattern = /\b(\d+|[a-z])\b/g;
                let match;
                while ((match = operandPattern.exec(expr)) !== null) {
                  tokens.push({
                    token: match[1],
                    index: match.index,
                    endIndex: match.index + match[1].length
                  });
                }
                return tokens;
              };
              
              const tokens = extractOperandTokens(expr);
              let converted = expr;
              const sortedTokens = [...tokens].sort((a, b) => b.index - a.index);
              sortedTokens.forEach(token => {
                const newOperand = mapping.get(token.token);
                if (newOperand) {
                  converted = converted.substring(0, token.index) + newOperand + converted.substring(token.endIndex);
                }
              });
              return converted;
            };
            
            const convertedRuleRight = convertOperands(ruleRightInt, result.matchPosition.operandMapping);
            console.log(`\nRule right side: "${ruleRightInt}"`);
            console.log(`Converted:       "${convertedRuleRight}"`);
            console.log(`Expected:       "${expectedBranchContent}"`);
            
            const normalizedConverted = normalizeSpacing(convertedRuleRight);
            const normalizedExpected = normalizeSpacing(expectedBranchContent);
            
            console.log(`\nNormalized converted: "${normalizedConverted}"`);
            console.log(`Normalized expected:   "${normalizedExpected}"`);
            console.log(`Match? ${normalizedConverted === normalizedExpected}`);
          }
        }
      }
    }
  } else {
    console.log("\n❌ FAILURE: No match found");
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
