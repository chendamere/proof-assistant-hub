/**
 * Diagnostic script for branch substitution issue
 * 
 * Target: ",\Bb{i \Oe j}{,x \Od m, x \Od n,}{,}, <=> ,\Bb{i \Oe j}{, x \Od n,x \Od m,}{,},"
 * Rule: ",x \Od m, x \Od n, <=> , x \Od n,x \Od m,"
 * 
 * The rule should match within the branch content and substitute it.
 */

import { normalizeRule } from '../src/lib/operandNormalizer.ts';
import { checkInferenceRules } from '../src/lib/inferenceRules.ts';

// Test case
const targetLeft = ",\\Bb{i \\Oe j}{,x \\Od m, x \\Od n,}{,},";
const targetRight = ",\\Bb{i \\Oe j}{, x \\Od n,x \\Od m,}{,},";

const ruleLeft = ",x \\Od m, x \\Od n,";
const ruleRight = ", x \\Od n,x \\Od m,";

console.log("=".repeat(80));
console.log("BRANCH SUBSTITUTION DIAGNOSIS");
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

  // Normalize rule
  console.log("\n" + "-".repeat(80));
  console.log("Step 2: Normalizing True Rule");
  console.log("-".repeat(80));
  const ruleNormalized = normalizeRule(ruleLeft, ruleRight);
  const ruleLeftInt = ruleNormalized.left.integerExpression;
  const ruleRightInt = ruleNormalized.right.integerExpression;
  
  console.log(`Rule Left (normalized):  "${ruleLeftInt}"`);
  console.log(`Rule Right (normalized): "${ruleRightInt}"`);

  // Manual branch extraction and matching
  console.log("\n" + "-".repeat(80));
  console.log("Step 3: Manual Branch Extraction");
  console.log("-".repeat(80));
  
  // Extract branch operator from target
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
    const branchRanges: Array<{ start: number; end: number }> = [];
    
    while (currentIndex < expr.length && expr[currentIndex] === '{') {
      let braceCount = 0;
      const branchStart = currentIndex;
      let branchContent = '';
      
      for (let i = currentIndex; i < expr.length; i++) {
        if (expr[i] === '{') {
          braceCount++;
          if (braceCount === 1) continue;
        } else if (expr[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            branchRanges.push({ start: branchStart + 1, end: i });
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
      operatorFull,
      index: opStartIndex,
      endIndex: currentIndex,
      condition,
      branches: resultBranches,
      branchRanges: branchRanges.slice(resultBranches.length === branches.length ? 0 : 1)
    };
  };

  const targetBranch = extractBranchOperator(targetLeftInt);
  const expectedBranch = extractBranchOperator(targetRightInt);
  
  if (targetBranch) {
    console.log(`\nTarget Branch Operator: ${targetBranch.operatorFull}`);
    console.log(`  Condition: "${targetBranch.condition || '(none)'}"`);
    console.log(`  Branches (${targetBranch.branches.length}):`);
    targetBranch.branches.forEach((branch, idx) => {
      console.log(`    [${idx}]: "${branch}"`);
      if (targetBranch.branchRanges && idx < targetBranch.branchRanges.length) {
        const range = targetBranch.branchRanges[idx];
        console.log(`         Range: ${range.start}-${range.end}`);
      }
    });
  } else {
    console.log("\n❌ Could not extract branch operator from target left");
  }

  if (expectedBranch) {
    console.log(`\nExpected Branch Operator: ${expectedBranch.operatorFull}`);
    console.log(`  Condition: "${expectedBranch.condition || '(none)'}"`);
    console.log(`  Branches (${expectedBranch.branches.length}):`);
    expectedBranch.branches.forEach((branch, idx) => {
      console.log(`    [${idx}]: "${branch}"`);
    });
  } else {
    console.log("\n❌ Could not extract branch operator from target right");
  }

  // Check if rule matches within branch content
  console.log("\n" + "-".repeat(80));
  console.log("Step 4: Checking Rule Match in Branch Content");
  console.log("-".repeat(80));
  
  if (targetBranch && targetBranch.branches.length > 0) {
    const branchContent = targetBranch.branches[0]; // First branch (after condition)
    console.log(`\nBranch content to match: "${branchContent}"`);
    console.log(`Rule left to match:        "${ruleLeftInt}"`);
    
    // Manual substring check
    const normalizeSpacing = (expr: string): string => {
      if (!expr) return expr;
      return expr
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ',')
        .trim();
    };
    
    const normalizedBranch = normalizeSpacing(branchContent);
    const normalizedRule = normalizeSpacing(ruleLeftInt);
    
    console.log(`\nNormalized branch: "${normalizedBranch}"`);
    console.log(`Normalized rule:   "${normalizedRule}"`);
    console.log(`\nExact match? ${normalizedBranch === normalizedRule}`);
    console.log(`Branch contains rule? ${normalizedBranch.includes(normalizedRule)}`);
    
    if (normalizedBranch.includes(normalizedRule)) {
      const index = normalizedBranch.indexOf(normalizedRule);
      console.log(`\nFound at normalized index: ${index}`);
      
      // Try to find actual position in original
      for (let i = 0; i <= branchContent.length - ruleLeftInt.length; i++) {
        const candidate = branchContent.substring(i, i + ruleLeftInt.length);
        if (normalizeSpacing(candidate) === normalizedRule) {
          console.log(`Found at actual index: ${i}`);
          const prefix = branchContent.substring(0, i);
          const suffix = branchContent.substring(i + ruleLeftInt.length);
          console.log(`  Prefix: "${prefix}"`);
          console.log(`  Suffix: "${suffix}"`);
          
          // Try substitution
          const substituted = prefix + ruleRightInt + suffix;
          console.log(`  Substituted: "${substituted}"`);
          const expectedBranchContent = expectedBranch?.branches[0] || '';
          console.log(`  Expected:     "${expectedBranchContent}"`);
          console.log(`  Match? ${normalizeSpacing(substituted) === normalizeSpacing(expectedBranchContent)}`);
          break;
        }
      }
    }
  }

  // Check inference rules
  console.log("\n" + "-".repeat(80));
  console.log("Step 5: Checking Inference Rules");
  console.log("-".repeat(80));
  console.log("\nComparing:");
  console.log(`  Target Left:  "${targetLeftInt}"`);
  console.log(`  Target Right: "${targetRightInt}"`);
  console.log(`  Rule Left:    "${ruleLeftInt}"`);
  console.log(`  Rule Right:   "${ruleRightInt}"`);
  
  const result = checkInferenceRules(
    targetLeftInt,
    targetRightInt,
    ruleLeftInt,
    ruleRightInt
  );

  console.log("\nResult:", result);
  
  // Additional verification: Check if substitution would work
  if (result.match && result.matchPosition) {
    console.log("\n" + "-".repeat(80));
    console.log("Step 6: Verifying Substitution");
    console.log("-".repeat(80));
    
    const normalizeSpacing = (expr: string): string => {
      if (!expr) return expr;
      return expr
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,\s+/g, ',')
        .trim();
    };
    
    // Extract branch operator from target
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
      const branchRanges: Array<{ start: number; end: number }> = [];
      
      while (currentIndex < expr.length && expr[currentIndex] === '{') {
        let braceCount = 0;
        const branchStart = currentIndex;
        let branchContent = '';
        
        for (let i = currentIndex; i < expr.length; i++) {
          if (expr[i] === '{') {
            braceCount++;
            if (braceCount === 1) continue;
          } else if (expr[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              branchRanges.push({ start: branchStart + 1, end: i });
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
        operatorFull,
        index: opStartIndex,
        endIndex: currentIndex,
        condition,
        branches: resultBranches,
        branchRanges: branchRanges.slice(resultBranches.length === branches.length ? 0 : 1)
      };
    };
    
    if (result.matchPosition.description?.includes('Rule found in branch')) {
      const branchMatch = result.matchPosition.description.match(/branch (\d+)/);
      if (branchMatch) {
        const branchIndex = parseInt(branchMatch[1]);
        const targetBranch = extractBranchOperator(targetLeftInt);
        const expectedBranch = extractBranchOperator(targetRightInt);
        
        if (targetBranch && expectedBranch) {
          const expectedBranchContent = expectedBranch.branches[branchIndex];
          const normalizedExpectedBranch = normalizeSpacing(expectedBranchContent);
          const normalizedOtherRuleSide = normalizeSpacing(ruleRightInt);
          
          console.log(`\nExpected branch content: "${expectedBranchContent}"`);
          console.log(`Normalized expected:      "${normalizedExpectedBranch}"`);
          console.log(`Rule right side:          "${ruleRightInt}"`);
          console.log(`Normalized rule right:    "${normalizedOtherRuleSide}"`);
          console.log(`\nDirect match? ${normalizedExpectedBranch === normalizedOtherRuleSide}`);
          
          // Try converting rule right side using operand mapping
          if (result.matchPosition.operandMapping) {
            console.log("\nOperand Mapping:");
            result.matchPosition.operandMapping.forEach((value, key) => {
              console.log(`  ${key} → ${value}`);
            });
            
            // Convert rule right side
            const convertOperands = (expr: string, mapping: Map<string, string>): string => {
              let converted = expr;
              const sortedKeys = Array.from(mapping.keys()).sort((a, b) => {
                // Sort by length (longer first) to avoid partial replacements
                return b.length - a.length;
              });
              
              for (const [ruleOp, targetOp] of mapping.entries()) {
                // Replace with word boundaries to avoid partial matches
                const regex = new RegExp(`\\b${ruleOp}\\b`, 'g');
                converted = converted.replace(regex, targetOp);
              }
              return converted;
            };
            
            const convertedRuleRight = convertOperands(ruleRightInt, result.matchPosition.operandMapping!);
            const normalizedConverted = normalizeSpacing(convertedRuleRight);
            
            console.log(`\nConverted rule right:    "${convertedRuleRight}"`);
            console.log(`Normalized converted:    "${normalizedConverted}"`);
            console.log(`\nMatch after conversion? ${normalizedExpectedBranch === normalizedConverted}`);
          }
        }
      }
    }
  }
  
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
    if (result.grammarError) {
      console.log(`Grammar Error: ${result.grammarError}`);
    }
    console.log("The substitution pattern matching did not find a match.");
    
    // Additional diagnostics
    console.log("\n" + "-".repeat(80));
    console.log("Additional Diagnostics");
    console.log("-".repeat(80));
    
    // Check if rule has branch operator
    const ruleBranch = extractBranchOperator(ruleLeftInt);
    if (ruleBranch) {
      console.log("\n⚠️  Rule has branch operator, but target also has branch operator");
      console.log("   This should trigger branch-to-branch matching, not branch content matching");
    } else {
      console.log("\n✓ Rule does not have branch operator");
      console.log("   This should trigger branch content matching");
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
