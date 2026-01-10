/**
 * Shared Inference Rules Module
 * 
 * This module contains the inference rules used for proof verification.
 * These rules determine if a target rule can be proven using existing rules.
 */

import { checkGrammar } from './grammarChecker';

export interface MatchPosition {
  side: 'left' | 'right' | 'both';
  position?: number;
  description: string;
  prefix?: string;
  suffix?: string;
  operandMapping?: Map<string, string>; // Maps ruleSide operand numbers to target operand numbers (for pattern matching)
  wasPatternMatch?: boolean; // Indicates if this match was via pattern matching
}

export interface InferenceRule {
  name: string;
  description: string;
  check: (
    targetLeft: string,
    targetRight: string,
    ruleLeft: string,
    ruleRight: string
  ) => { match: boolean; position?: MatchPosition };
}

/**
 * Inference Rules for proof verification
 * 
 * These rules determine how a target rule can be proven using existing rules:
 * 1. Equivalent Commutativity: A ⟺ B implies B ⟺ A
 * 2. Equivalent Transitivity: A ⟺ B and B ⟺ C implies A ⟺ C
 * 3. Equivalent Substitution: A ⟺ B allows replacing A with B in any context M·A·N → M·B·N
 */
export const InferenceRules: InferenceRule[] = [
  {
    name: 'Equivalent Commutativity',
    description: 'A ⟺ B implies B ⟺ A - Exact match (reversed)',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if target matches rule in reverse
      if (targetLeft === ruleRight && targetRight === ruleLeft) {
        return {
          match: true,
          position: {
            side: 'both',
            description: 'Both sides match in reverse order'
          }
        };
      }
      return { match: false };
    },
  },
  {
    name: 'Equivalent Transitivity',
    description: 'A ⟺ B and B ⟺ C implies A ⟺ C - Chain through common side',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // If target left matches rule left, check if target right matches rule right exactly
      if (targetLeft === ruleLeft) {
        if (targetRight === ruleRight) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Left sides match, right sides match exactly'
            }
          };
        }
      }
      // If target left matches rule right, check if target right matches rule left exactly
      if (targetLeft === ruleRight) {
        if (targetRight === ruleLeft) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Target left matches rule right, target right matches rule left exactly'
            }
          };
        }
      }
      // If target right matches rule left, check if target left matches rule right exactly
      if (targetRight === ruleLeft) {
        if (targetLeft === ruleRight) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Target right matches rule left, target left matches rule right exactly'
            }
          };
        }
      }
      // If target right matches rule right, check if target left matches rule left exactly
      if (targetRight === ruleRight) {
        if (targetLeft === ruleLeft) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Right sides match, left sides match exactly'
            }
          };
        }
      }
      return { match: false };
    },
  },
  {
    name: 'Equivalent Substitution',
    description: 'A ⟺ B allows replacing A with B in any context M·A·N → M·B·N',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Strategy: Operand-Aligned Pattern Matching with Pattern Recognition
      // Extract operand patterns and match patterns rather than exact numbers to handle
      // separately normalized expressions
      
      // Normalize spacing in expressions to handle spacing variations
      // Handles cases like ", 3 \Oc 4," vs ",3 \Oc 4," or ",3 \Oc 4, 1 \Od 2," vs ",3 \Oc 4,1 \Od 2,"
      // The main issue is spacing around commas - we normalize to remove spaces around commas
      const normalizeSpacing = (expr: string): string => {
        if (!expr) return expr;
        return expr
          // Normalize all whitespace sequences (tabs, multiple spaces, newlines, etc.) to single spaces
          .replace(/\s+/g, ' ')
          // Remove space before comma (handles ", 3" -> ",3" and " ,3" -> ",3")
          .replace(/\s+,/g, ',')
          // Remove space after comma (handles ", 3" -> ",3" and ", 3 " -> ",3")
          .replace(/,\s+/g, ',')
          // Remove leading/trailing spaces
          .trim();
      };

      // Extract operand tokens and their positions from expressions
      // Operands can be either digits (e.g., "1", "22") or single letters (e.g., "i", "j", "m")
      const extractOperandTokens = (expr: string): Array<{ token: string; index: number; endIndex: number }> => {
        const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
        // Match either digits or single letters as operands
        // Pattern: \b(\d+|[a-z])\b matches word boundaries around digits or single lowercase letters
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

      // Convert ruleOtherSide using operand mapping
      // For unmapped operands: first try existing operands from targetSide, then try new operands if needed
      const convertRuleOtherSide = (
        ruleOtherSide: string,
        operandMapping: Map<string, string>,
        prefix: string,
        suffix: string,
        targetSide: string, // The target side passed to findSubstitution (to extract existing operands)
        expectedResult?: string // The expected result to match against (optional, for testing)
      ): string => {
        // Extract operands from prefix and suffix to find unused integers
        const extractOperandsFromText = (text: string): Set<string> => {
          const operands = new Set<string>();
          const numberPattern = /\b(\d+)\b/g;
          let match;
          while ((match = numberPattern.exec(text)) !== null) {
            operands.add(match[1]);
          }
          return operands;
        };
        
        const prefixOperands = extractOperandsFromText(prefix);
        const suffixOperands = extractOperandsFromText(suffix);
        const targetOperands = extractOperandsFromText(targetSide);
        
        // Also extract operands from expectedResult if provided
        const expectedOperands = expectedResult ? extractOperandsFromText(expectedResult) : new Set<string>();
        
        // All existing operands from the target side (prefix + suffix + target itself + expected result)
        const existingOperands = new Set([...prefixOperands, ...suffixOperands, ...targetOperands, ...expectedOperands]);
        
        // Operands already used in the mapping
        const mappedOperands = new Set(Array.from(operandMapping.values()));
        
        // Extract operands from ruleOtherSide
        const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
        const unmappedTokens = ruleOtherTokens.filter(token => !operandMapping.has(token.token));
        
        // If there are unmapped operands and we have an expected result, try existing operands first
        if (unmappedTokens.length > 0 && expectedResult) {
          // Try mapping unmapped operands to existing operands from target side
          const tryMappingWithExisting = (mapping: Map<string, string>): string | null => {
            const newMapping = new Map(mapping);
            
            // For each unmapped token, try each existing operand
            const tryAssignExisting = (tokenIdx: number): string | null => {
              if (tokenIdx >= unmappedTokens.length) {
                // All unmapped tokens assigned, test the conversion
                const testMapping = new Map(newMapping);
                ruleOtherTokens.forEach(token => {
                  if (!testMapping.has(token.token)) {
                    // Shouldn't happen, but fallback
                    return null;
                  }
                });
                
                // Convert ruleOtherSide with this mapping
                let converted = ruleOtherSide;
                const sortedTokens = [...ruleOtherTokens].sort((a, b) => b.index - a.index);
                sortedTokens.forEach(token => {
                  const newOperand = testMapping.get(token.token)!;
                  converted = converted.substring(0, token.index) + newOperand + converted.substring(token.endIndex);
                });
                
                // If the converted string only contains a comma (after trimming whitespace),
                // treat it as empty (will result in prefix + suffix)
                const convertedTrimmed = converted.trim();
                const isJustComma = convertedTrimmed === ',';
                const convertedForSubstitution = isJustComma ? '' : converted;
                
                // Test if this matches expected result
                const substituted = prefix + convertedForSubstitution + suffix;
                if (normalizeSpacing(substituted) === normalizeSpacing(expectedResult)) {
                  // Return empty string if it was just a comma, otherwise return converted
                  return isJustComma ? '' : converted;
                }
                return null;
              }
              
              const token = unmappedTokens[tokenIdx];
              
              // Check if this token value is already mapped (same token value should map to same operand)
              if (newMapping.has(token.token)) {
                // This token value is already mapped, use the same mapping
                const result = tryAssignExisting(tokenIdx + 1);
                if (result !== null) {
                  return result;
                }
                return null;
              }
              
              // Try each existing operand
              // Note: We allow multiple different token values to map to the same existing operand
              // but the same token value should always map to the same operand
              const availableOperands = Array.from(existingOperands);
              
              for (const existingOp of availableOperands) {
                newMapping.set(token.token, existingOp);
                const result = tryAssignExisting(tokenIdx + 1);
                if (result !== null) {
                  return result;
                }
                newMapping.delete(token.token);
              }
              
              return null;
            };
            
            return tryAssignExisting(0);
          };
          
          const resultWithExisting = tryMappingWithExisting(operandMapping);
          if (resultWithExisting !== null) {
            return resultWithExisting;
          }
        }
        
        // If no match with existing operands, or no expected result provided, use new operands
        const usedOperands = new Set([...prefixOperands, ...suffixOperands, ...Array.from(operandMapping.values())]);
        
        // Find the maximum used operand number
        let maxUsed = 0;
        usedOperands.forEach(op => {
          const num = parseInt(op, 10);
          if (!isNaN(num) && num > maxUsed) {
            maxUsed = num;
          }
        });
        
        const newOperandMapping = new Map<string, string>();
        let nextUnused = maxUsed + 1;
        
        // Map operands: use existing mapping if available, otherwise assign new unused integer
        ruleOtherTokens.forEach(token => {
          if (operandMapping.has(token.token)) {
            // Use existing mapping
            newOperandMapping.set(token.token, operandMapping.get(token.token)!);
          } else {
            // Assign new unused integer
            const newOp = nextUnused.toString();
            newOperandMapping.set(token.token, newOp);
            nextUnused++;
          }
        });
        
        // Replace operands in ruleOtherSide
        let converted = ruleOtherSide;
        const sortedTokens = [...ruleOtherTokens].sort((a, b) => b.index - a.index);
        sortedTokens.forEach(token => {
          const newOperand = newOperandMapping.get(token.token)!;
          converted = converted.substring(0, token.index) + newOperand + converted.substring(token.endIndex);
        });
        
        // If the converted string only contains a comma (after trimming whitespace),
        // return empty string. The caller will handle prefix + suffix.
        // This is because when we replace a comma-started candidate with empty,
        // we need to preserve the comma structure, which is handled in the substitution check.
        const convertedTrimmed = converted.trim();
        if (convertedTrimmed === ',') {
          return '';
        }
        
        return converted;
      };

      // Extract branch operator and its branches from an expression
      interface BranchInfo {
        operator: string;
        operatorFull: string;
        index: number;
        endIndex: number;
        condition: string | null;
        branches: string[];
        branchRanges: Array<{ start: number; end: number }>;
      }

      const extractBranchOperator = (expr: string, startIndex: number = 0): BranchInfo | null => {
        const branchOpRegex = /\\(B[blrs]+)/g;
        branchOpRegex.lastIndex = startIndex;
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

      const branchOperatorsCompatible = (ruleOp: string, targetOp: string): boolean => {
        if (targetOp === 'Bb') {
          return ruleOp === 'Bb' || ruleOp === 'Blb' || ruleOp === 'Br';
        }
        return ruleOp === targetOp;
      };

      // Extract operand pattern: convert numbers to pattern variables (A, B, C, ...)
      const extractOperandPattern = (
        expr: string, 
        tokens: Array<{ token: string; index: number; endIndex: number }>
      ): { pattern: string; operandToVar: Map<string, string> } => {
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

      // Build operand mapping from ruleSide to candidate based on pattern matching
      const buildOperandMapping = (
        ruleTokens: Array<{ token: string; index: number; endIndex: number }>,
        candidateTokens: Array<{ token: string; index: number; endIndex: number }>,
        ruleOperandToVar: Map<string, string>
      ): Map<string, string> => {
        const mapping = new Map<string, string>();
        const candidateVarToOperand = new Map<string, string>();
        
        candidateTokens.forEach((token, idx) => {
          const ruleToken = ruleTokens[idx];
          const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
          if (!candidateVarToOperand.has(ruleVar)) {
            candidateVarToOperand.set(ruleVar, token.token);
          }
        });
        
        ruleTokens.forEach((ruleToken, idx) => {
          const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
          const candidateOperand = candidateVarToOperand.get(ruleVar)!;
          mapping.set(ruleToken.token, candidateOperand);
        });
        
        return mapping;
      };

      // Internal function to find ALL matches (not just the first one) - for N*M generation
      // This duplicates the matching logic but collects all matches instead of returning early
      const findAllSubstitutionsInternal = function findAllSubstitutionsInternalRecursive(
        target: string,
        ruleSide: string,
        side: 'left' | 'right',
        findAllFunc: (target: string, ruleSide: string, side: 'left' | 'right', findAllFunc: any) => Array<{ match: boolean; position?: MatchPosition }>
      ): Array<{ match: boolean; position?: MatchPosition }> {
        const allMatches: Array<{ match: boolean; position?: MatchPosition }> = [];

        // Check for branch operators first
        const targetBranch = extractBranchOperator(target);
        const ruleBranch = extractBranchOperator(ruleSide);
        
        if (targetBranch && ruleBranch) {
          // Both have branch operators - handle branch matching with N*M generation
          if (!branchOperatorsCompatible(ruleBranch.operator, targetBranch.operator)) {
            return [];
          }
          
          // Check condition match (if both have conditions)
          if (ruleBranch.condition && targetBranch.condition) {
            const conditionMatches = findAllFunc(targetBranch.condition, ruleBranch.condition, side, findAllFunc);
            if (conditionMatches.length === 0) {
              return [];
            }
          } else if (ruleBranch.condition && !targetBranch.condition) {
            return [];
          }
          
          // Match branches with N*M generation
          if (ruleBranch.branches.length === 2 && targetBranch.branches.length >= 2) {
            // Find ALL matches for the first rule branch in the first target branch (N matches)
            const matches1 = findAllFunc(targetBranch.branches[0], ruleBranch.branches[0], side, findAllFunc);
            
            // Find ALL matches for the second rule branch in the second target branch (M matches)
            // Handle direction based on operator type
            let matches2: Array<{ match: boolean; position?: MatchPosition }>;
            if (ruleBranch.operator === 'Br') {
              // For \Br, match in reverse order (right-to-left): 
              // first rule branch matches last target branch, second rule branch matches second-to-last target branch
              matches2 = findAllFunc(targetBranch.branches[targetBranch.branches.length - 1], ruleBranch.branches[0], side, findAllFunc);
              // Note: For Br with 2 branches, we need to match both branches in reverse
              // This is a simplified version - full implementation would match second rule branch to second-to-last target branch
            } else {
              // For \Blb and \Bb, match left-to-right: first to first, second to second
              matches2 = findAllFunc(targetBranch.branches[1], ruleBranch.branches[1], side, findAllFunc);
            }
            
            // Generate N*M combinations
            for (const match1 of matches1) {
              for (const match2 of matches2) {
                if (match1.match && match2.match) {
                  const prefix = target.substring(0, targetBranch.index);
                  const suffix = target.substring(targetBranch.endIndex);
                  
                  const operandMapping = new Map<string, string>();
                  if (match1.position?.operandMapping) {
                    match1.position.operandMapping.forEach((v, k) => operandMapping.set(k, v));
                  }
                  if (match2.position?.operandMapping) {
                    match2.position.operandMapping.forEach((v, k) => operandMapping.set(k, v));
                  }
                  
                  allMatches.push({
                    match: true,
                    position: {
                      side: side,
                      position: targetBranch.index,
                      description: `Branch operator match: ${ruleBranch.operatorFull} matches ${targetBranch.operatorFull} (${matches1.length}*${matches2.length} combinations)`,
                      prefix: prefix || undefined,
                      suffix: suffix || undefined,
                      operandMapping: operandMapping.size > 0 ? operandMapping : undefined,
                      wasPatternMatch: operandMapping.size > 0,
                    }
                  });
                }
              }
            }
            
            // Return all N*M combinations
            if (allMatches.length > 0) {
              return allMatches;
            }
          }
          
          // If no N*M combinations found, also try matching the branches as substrings
          // This handles cases where the rule branch is embedded within the target branch
          // (e.g., rule branch ",i \Op," matches within target branch ",i \Op, i \On,")
          // For now, we've already tried exact branch matching above
          // The regular matching logic below will handle substring matching
          
          // If branch structure doesn't match, return empty
          return [];
        } else if (ruleBranch && !targetBranch) {
          // Rule has branch operator but target doesn't - no match possible
          return [];
        } else if (targetBranch && !ruleBranch) {
          // Target has branch operator but rule doesn't - try to match rule within each branch
          // This handles cases like target: ", \Blb{...}{,}{,}" and rule: ", "
          // We need to check if the rule matches within any branch of the target
          
          // Try to match the rule within each branch of the target
          for (let i = 0; i < targetBranch.branches.length; i++) {
            const branch = targetBranch.branches[i];
            const branchMatches = findAllFunc(branch, ruleSide, side, findAllFunc);
            if (branchMatches.length > 0) {
              // Found a match in this branch - construct a match position
              // Use branchRanges to get the correct position of this branch in the original target
              if (targetBranch.branchRanges && i < targetBranch.branchRanges.length) {
                const branchRange = targetBranch.branchRanges[i];
                const branchStartIndex = branchRange.start;
                
                // Use the first match from this branch
                const match = branchMatches[0];
                if (match.match && match.position) {
                  // Calculate prefix and suffix relative to the entire target
                  const prefix = target.substring(0, branchStartIndex);
                  const suffix = target.substring(branchRange.end);
                  
                  allMatches.push({
                    match: true,
                    position: {
                      side: side,
                      position: branchStartIndex + (match.position.position || 0),
                      description: `Rule found in branch ${i} at position ${branchStartIndex} in ${side} side`,
                      prefix: prefix || undefined,
                      suffix: suffix || undefined,
                      operandMapping: match.position.operandMapping,
                      wasPatternMatch: match.position.wasPatternMatch,
                    }
                  });
                }
              }
            }
          }
          
          if (allMatches.length > 0) {
            return allMatches;
          }
          
          // If no match found in branches, also try matching the rule against the condition
          // and the entire branch structure (for cases where the rule matches the prefix/suffix)
          // This will be handled by the regular matching below
        }
        
        // Continue with regular (non-branch) matching - collect ALL matches
        const targetTokens = extractOperandTokens(target);
        const ruleTokens = extractOperandTokens(ruleSide);

        // Handle case where ruleSide has no operands
        if (ruleTokens.length === 0) {
          const trimmedRuleSide = ruleSide.trim();
          if (trimmedRuleSide === '') {
            allMatches.push({
              match: true,
              position: {
                side: side,
                position: 0,
                description: `Empty rule found in ${side} side`,
                prefix: undefined,
                suffix: target || undefined,
              }
            });
            return allMatches;
          }
          
          // For rules with no operands (just commas/spaces/operators), use normalized spacing matching
          const normalizedRule = normalizeSpacing(ruleSide);
          const normalizedTarget = normalizeSpacing(target);
          
          // Check if normalized rule matches normalized target exactly
          if (normalizedRule === normalizedTarget) {
            // Exact match after normalization - the entire target matches the rule
            allMatches.push({
              match: true,
              position: {
                side: side,
                position: 0,
                description: `Rule (operators only) matches exactly in ${side} side`,
                prefix: undefined,
                suffix: undefined,
              }
            });
            return allMatches;
          }
          
          // Check if normalized rule is a prefix/substring of normalized target
          if (normalizedTarget.startsWith(normalizedRule)) {
            // Rule matches as a prefix - find all positions where this could occur
            // Try each position in the target to see if normalizing from that position matches
            for (let startIndex = 0; startIndex < target.length; startIndex++) {
              // Try to match from this starting position
              let matchedLength = 0;
              let normalizedMatched = '';
              
              for (let i = startIndex; i < target.length; i++) {
                const char = target[i];
                // Build normalized string incrementally
                if (!/\s/.test(char)) {
                  normalizedMatched += char;
                  matchedLength++;
                } else if (char === ' ' && normalizedMatched.length > 0 && !normalizedMatched.endsWith(' ')) {
                  // Skip spaces unless they're meaningful (e.g., between tokens)
                  // For simple comma-space patterns, we can skip spaces
                  if (normalizedRule.includes(',')) {
                    // For comma patterns, skip spaces
                    continue;
                  }
                  normalizedMatched += ' ';
                  matchedLength++;
                } else if (char === ',') {
                  normalizedMatched += ',';
                  matchedLength++;
                }
                
                // Check if we've matched enough
                if (normalizedMatched === normalizedRule) {
                  // Found a match! 
                  const prefix = target.substring(0, startIndex);
                  const suffix = target.substring(i + 1);
                  
                  allMatches.push({
                    match: true,
                    position: {
                      side: side,
                      position: startIndex,
                      description: `Rule (operators only) found at position ${startIndex} in ${side} side`,
                      prefix: prefix || undefined,
                      suffix: suffix || undefined,
                    }
                  });
                  break;
                }
                
                // If we've exceeded the normalized rule length, this position won't work
                if (normalizedMatched.length > normalizedRule.length) {
                  break;
                }
              }
            }
            
            if (allMatches.length > 0) {
              return allMatches;
            }
          }
          
          // Fallback: try exact string matching (original behavior)
          let searchIndex = 0;
          while (searchIndex < target.length) {
            const index = target.indexOf(ruleSide, searchIndex);
            if (index === -1) break;
            
            const prefix = target.substring(0, index);
            const suffix = target.substring(index + ruleSide.length);
            
            allMatches.push({
              match: true,
              position: {
                side: side,
                position: index,
                description: `Rule (operators only) found at position ${index} in ${side} side`,
                prefix: prefix || undefined,
                suffix: suffix || undefined,
              }
            });
            
            searchIndex = index + 1;
          }
          
          return allMatches;
        }

        // If ruleSide has more operands than target, no match possible (unless it's a substring)
        if (ruleTokens.length > targetTokens.length) {
          // For substring matching (e.g., when matching branch content), check if rule matches as a prefix
          const normalizedTarget = normalizeSpacing(target);
          const normalizedRule = normalizeSpacing(ruleSide);
          if (normalizedTarget.startsWith(normalizedRule)) {
            // Rule matches as a prefix - extract the match
            // Find the actual match position in the original (non-normalized) string
            const rulePattern = normalizedRule;
            // Try to find where the rule starts in the target
            for (let i = 0; i <= target.length - ruleSide.length; i++) {
              const candidate = target.substring(i, i + ruleSide.length);
              if (normalizeSpacing(candidate) === normalizedRule) {
                allMatches.push({
                  match: true,
                  position: {
                    side: side,
                    position: i,
                    description: `Rule found as substring prefix in ${side} side`,
                    prefix: i > 0 ? target.substring(0, i) : undefined,
                    suffix: i + ruleSide.length < target.length ? target.substring(i + ruleSide.length) : undefined,
                    wasPatternMatch: false,
                  }
                });
              }
            }
          }
          return allMatches;
        }

        // For substring matching (when rule has fewer or equal operands), also try direct substring search
        // This handles cases like matching ",i \Op," within ",i \Op, i \On,"
        const normalizedTarget = normalizeSpacing(target);
        const normalizedRule = normalizeSpacing(ruleSide);
        
        // Try direct substring match first (sliding window approach)
        if (normalizedTarget.includes(normalizedRule)) {
          // Find all positions where the normalized rule appears in the normalized target
          // Then map back to original positions
          const rulePatternLength = normalizedRule.length;
          let searchStart = 0;
          while (searchStart < normalizedTarget.length) {
            const pos = normalizedTarget.indexOf(normalizedRule, searchStart);
            if (pos === -1) break;
            
            // Try to extract the actual substring from original target that corresponds to this position
            // This is approximate - we look for the rule pattern in the target
            // by trying different starting positions
            for (let i = 0; i <= target.length - ruleSide.length; i++) {
              const candidate = target.substring(i, i + ruleSide.length);
              if (normalizeSpacing(candidate) === normalizedRule) {
                allMatches.push({
                  match: true,
                  position: {
                    side: side,
                    position: i,
                    description: `Rule found as substring at position ${i} in ${side} side`,
                    prefix: i > 0 ? target.substring(0, i) : undefined,
                    suffix: i + ruleSide.length < target.length ? target.substring(i + ruleSide.length) : undefined,
                    wasPatternMatch: false,
                  }
                });
                break; // Found one match at this normalized position, move to next
              }
            }
            
            searchStart = pos + 1;
          }
          
          // If we found direct substring matches, return them (they're more accurate)
          // But also continue with operand-aligned matching for pattern matching
          if (allMatches.length > 0 && ruleTokens.length === targetTokens.length) {
            // If operand counts match, prefer operand-aligned matches for pattern matching
            // But if they don't match, substring matches are what we want
            // For now, continue with operand-aligned matching below
          }
        }

        // Extract rule pattern once
        const { pattern: rulePattern, operandToVar: ruleOperandToVar } = extractOperandPattern(ruleSide, ruleTokens);

        // Try each operand-aligned starting position - collect ALL matches
        // For substring matching, we need to allow matching when target has more operands
        for (let startIdx = 0; startIdx <= targetTokens.length - ruleTokens.length; startIdx++) {
          const startToken = targetTokens[startIdx];
          const endTokenIdx = startIdx + ruleTokens.length - 1;
          const endToken = targetTokens[endTokenIdx];
          
          const ruleTrimmed = ruleSide.trim();
          let candidateStart = startToken.index;
          let candidateEnd = endToken.endIndex;
          
          // Extend backwards for leading comma
          if (ruleTrimmed.startsWith(',')) {
            for (let i = candidateStart - 1; i >= 0; i--) {
              const char = target[i];
              if (char === ',') {
                candidateStart = i;
                break;
              } else if (/\s/.test(char) || char === '\\' || /[a-zA-Z]/.test(char)) {
                continue;
              } else {
                break;
              }
            }
          }
          
          // For substring matching (when matching branch content), we need to be more careful
          // Find the comma that immediately follows the operator after the last operand token
          // We need to find the comma that comes after the operator (e.g., \Op), not skip to the next operand
          if (ruleTrimmed.endsWith(',')) {
            // Look for comma after the operator that follows the endToken
            // First, find where the operator ends (skip past the operand and its operator)
            let operatorEnd = endToken.endIndex;
            // Skip whitespace
            while (operatorEnd < target.length && /\s/.test(target[operatorEnd])) {
              operatorEnd++;
            }
            // Skip the operator (backslash followed by letters)
            if (operatorEnd < target.length && target[operatorEnd] === '\\') {
              operatorEnd++; // Skip backslash
              while (operatorEnd < target.length && /[a-zA-Z]/.test(target[operatorEnd])) {
                operatorEnd++;
              }
            }
            // Now look for comma immediately after the operator (allowing whitespace)
            let foundComma = false;
            for (let i = operatorEnd; i < target.length; i++) {
              const char = target[i];
              if (char === ',') {
                candidateEnd = i + 1;
                foundComma = true;
                break;
              } else if (/\s/.test(char)) {
                continue; // Allow whitespace
              } else {
                // Hit something else (likely another operand or operator) - stop
                break;
              }
            }
            // If we didn't find a comma after the operator, don't extend
            if (!foundComma) {
              candidateEnd = endToken.endIndex; // Don't extend
            }
          }
          
          const candidate = target.substring(candidateStart, candidateEnd);
          let prefix = target.substring(0, candidateStart);
          let suffix = target.substring(candidateEnd);

          // Try exact string match (after normalization)
          const normalizedCandidate = normalizeSpacing(candidate);
          const normalizedRule = normalizeSpacing(ruleSide);
          if (normalizedCandidate === normalizedRule) {
            allMatches.push({
              match: true,
              position: {
                side: side,
                position: candidateStart,
                description: `Rule found at operand-aligned position ${startIdx} in ${side} side`,
                prefix: prefix || undefined,
                suffix: suffix || undefined,
                wasPatternMatch: false,
              }
            });
            continue; // Don't check pattern matching for this candidate
          }
          
          // Also check if the normalized rule is a prefix of the normalized candidate
          // This handles substring matching when the rule is embedded within the target
          // For example: rule ",i \Op," matches within target ",i \Op, i \On,"
          if (normalizedCandidate.startsWith(normalizedRule)) {
            // Find where the rule actually ends in the target (accounting for spacing differences)
            // Try to match the rule pattern at the start of the candidate
            const candidateTokensForPattern = extractOperandTokens(candidate);
            if (candidateTokensForPattern.length >= ruleTokens.length) {
              // Get the first ruleTokens.length tokens
              const tokensToUse = candidateTokensForPattern.slice(0, ruleTokens.length);
              // Find where these tokens end - this is where the rule match ends
              const ruleMatchEnd = tokensToUse[tokensToUse.length - 1].endIndex;
              
              // Extend to include trailing comma if rule ends with comma
              let actualMatchEnd = ruleMatchEnd;
              if (ruleTrimmed.endsWith(',')) {
                // Look for comma after the last token
                const searchStart = candidateStart + ruleMatchEnd;
                for (let i = searchStart; i < target.length; i++) {
                  const char = target[i];
                  if (char === ',') {
                    actualMatchEnd = i + 1 - candidateStart; // Relative to candidate
                    break;
                  } else if (/\s/.test(char)) {
                    continue;
                  } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
                    continue; // Skip operators
                  } else {
                    break;
                  }
                }
              }
              
              // Extract the actual match
              const actualMatch = candidate.substring(0, actualMatchEnd);
              const actualNormalizedMatch = normalizeSpacing(actualMatch);
              
              if (actualNormalizedMatch === normalizedRule) {
                const actualSuffix = target.substring(candidateStart + actualMatchEnd);
                allMatches.push({
                  match: true,
                  position: {
                    side: side,
                    position: candidateStart,
                    description: `Rule found at operand-aligned position ${startIdx} (substring prefix match) in ${side} side`,
                    prefix: prefix || undefined,
                    suffix: actualSuffix || undefined,
                    wasPatternMatch: false,
                  }
                });
                continue;
              }
            }
          }

          // Try pattern matching - extract tokens from candidate and match patterns
          const candidateTokens = extractOperandTokens(candidate);
          // For substring matching, candidate might have more tokens, so we only use the first ruleTokens.length tokens
          if (candidateTokens.length >= ruleTokens.length) {
            // Use only the first ruleTokens.length tokens for pattern matching
            const candidateTokensToUse = candidateTokens.slice(0, ruleTokens.length);
            // Re-extract candidate to match the tokens we're using
            const candidateEndForPattern = candidateTokensToUse[candidateTokensToUse.length - 1].endIndex;
            const candidateForPattern = candidate.substring(0, candidateEndForPattern);
            
            // Extend candidateForPattern to include trailing comma if ruleSide ends with comma
            let finalCandidateEnd = candidateEndForPattern;
            if (ruleTrimmed.endsWith(',')) {
              for (let i = finalCandidateEnd; i < candidate.length && i < target.length; i++) {
                const char = candidate[i];
                if (char === ',') {
                  finalCandidateEnd = i + 1;
                  break;
                } else if (/\s/.test(char)) {
                  continue;
                } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
                  continue;
                } else {
                  break;
                }
              }
            }
            const finalCandidate = candidate.substring(0, finalCandidateEnd);
            const finalCandidateTokens = extractOperandTokens(finalCandidate);
            
            if (finalCandidateTokens.length === ruleTokens.length) {
              const { pattern: candidatePattern } = extractOperandPattern(finalCandidate, finalCandidateTokens);
              
              if (normalizeSpacing(candidatePattern) === normalizeSpacing(rulePattern)) {
                const operandMapping = buildOperandMapping(ruleTokens, finalCandidateTokens, ruleOperandToVar);
                
                // Adjust prefix/suffix to account for the actual match
                const actualSuffix = target.substring(candidateStart + finalCandidate.length);
                
                allMatches.push({
                  match: true,
                  position: {
                    side: side,
                    position: candidateStart,
                    description: `Rule found at operand-aligned position ${startIdx} (pattern match) in ${side} side`,
                    prefix: prefix || undefined,
                    suffix: actualSuffix || undefined,
                    operandMapping: operandMapping,
                    wasPatternMatch: true,
                  }
                });
              }
            }
          }
        }

        return allMatches;
      };

      // Find all matches for branch content (for N*M generation)  
      // This will be used to find all matches of a rule branch within a target branch
      const findAllMatchesInBranchContent = (
        targetBranchContent: string,
        ruleBranchContent: string,
        side: 'left' | 'right',
        findAllFunc: (target: string, ruleSide: string, side: 'left' | 'right', findAllFunc: any) => Array<{ match: boolean; position?: MatchPosition }>
      ): Array<{ match: { match: boolean; position?: MatchPosition }; startIndex: number; endIndex: number }> => {
        const matches: Array<{ match: { match: boolean; position?: MatchPosition }; startIndex: number; endIndex: number }> = [];
        
        // Use findAllFunc to get ALL matches (not just the first one)
        const allMatches = findAllFunc(targetBranchContent, ruleBranchContent, side, findAllFunc);
        
        // Convert matches to the format needed by generateBranchCandidates
        for (const match of allMatches) {
          if (match.match && match.position) {
            const prefix = match.position.prefix || '';
            const suffix = match.position.suffix || '';
            const startIdx = prefix.length > 0 ? targetBranchContent.indexOf(prefix) + prefix.length : (match.position.position || 0);
            const endIdx = suffix.length > 0 ? targetBranchContent.lastIndexOf(suffix) : targetBranchContent.length;
            
            matches.push({
              match: match,
              startIndex: startIdx >= 0 ? startIdx : 0,
              endIndex: endIdx >= startIdx ? endIdx : targetBranchContent.length
            });
          }
        }
        
        return matches;
      };

      const findSubstitution = function findSubstitutionRecursive(target: string, ruleSide: string, side: 'left' | 'right'): { match: boolean; position?: MatchPosition } {
        // First check for branch operators
        const targetBranch = extractBranchOperator(target);
        const ruleBranch = extractBranchOperator(ruleSide);
        
        if (targetBranch && ruleBranch) {
          // Both have branch operators - handle branch matching with N*M generation
          if (!branchOperatorsCompatible(ruleBranch.operator, targetBranch.operator)) {
            return { match: false };
          }
          
          // Check condition match (if both have conditions) - use findAllSubstitutionsInternal to get all matches
          if (ruleBranch.condition && targetBranch.condition) {
            const conditionMatches = findAllSubstitutionsInternal(targetBranch.condition, ruleBranch.condition, side, findAllSubstitutionsInternal);
            if (conditionMatches.length === 0) {
              return { match: false };
            }
            // For backward compatibility, we still only return the first match, but internally we've checked all
          } else if (ruleBranch.condition && !targetBranch.condition) {
            return { match: false };
          }
          
          // Match branches with N*M generation
          if (ruleBranch.branches.length === 2 && targetBranch.branches.length >= 2) {
            // Find ALL matches for the first rule branch in the first target branch (N matches)
            const matches1 = findAllSubstitutionsInternal(targetBranch.branches[0], ruleBranch.branches[0], side, findAllSubstitutionsInternal);
            
            // Find ALL matches for the second rule branch in the second target branch (M matches)
            // Handle direction based on operator type
            let matches2: Array<{ match: boolean; position?: MatchPosition }>;
            if (ruleBranch.operator === 'Br') {
              // For \Br, match in reverse order (right-to-left)
              matches2 = findAllSubstitutionsInternal(targetBranch.branches[targetBranch.branches.length - 1], ruleBranch.branches[1], side, findAllSubstitutionsInternal);
            } else {
              // For \Blb and \Bb, match left-to-right
              matches2 = findAllSubstitutionsInternal(targetBranch.branches[1], ruleBranch.branches[1], side, findAllSubstitutionsInternal);
            }
            
            // Debug: Check if we got any matches
            if (matches1.length === 0 || matches2.length === 0) {
              // No matches found for branches - fall through to regular matching
              // This handles cases where branch content doesn't match as expected
            } else {
              // Generate N*M combinations - return the first one for backward compatibility
              // All combinations are valid, but we return the first to maintain the existing interface
              for (const match1 of matches1) {
                for (const match2 of matches2) {
                  if (match1.match && match2.match) {
                    const prefix = target.substring(0, targetBranch.index);
                    const suffix = target.substring(targetBranch.endIndex);
                    
                    const operandMapping = new Map<string, string>();
                    if (match1.position?.operandMapping) {
                      match1.position.operandMapping.forEach((v, k) => operandMapping.set(k, v));
                    }
                    if (match2.position?.operandMapping) {
                      match2.position.operandMapping.forEach((v, k) => operandMapping.set(k, v));
                    }
                    
                    // Return the first valid N*M combination
                    return {
                      match: true,
                      position: {
                        side: side,
                        position: targetBranch.index,
                        description: `Branch operator match: ${ruleBranch.operatorFull} matches ${targetBranch.operatorFull} (found ${matches1.length}*${matches2.length} combinations)`,
                        prefix: prefix || undefined,
                        suffix: suffix || undefined,
                        operandMapping: operandMapping.size > 0 ? operandMapping : undefined,
                        wasPatternMatch: operandMapping.size > 0,
                      }
                    };
                  }
                }
              }
            }
          }
          
          // If branch matching failed, fall through to regular matching
        } else if (ruleBranch && !targetBranch) {
          return { match: false };
        } else if (targetBranch && !ruleBranch) {
          // Target has branch operator but rule doesn't - try to match rule within each branch
          // This handles cases like target: ", \Blb{...}{,}{,}" and rule: ", "
          for (let i = 0; i < targetBranch.branches.length; i++) {
            const branch = targetBranch.branches[i];
            const branchMatches = findAllSubstitutionsInternal(branch, ruleSide, side, findAllSubstitutionsInternal);
            if (branchMatches.length > 0) {
              // Found a match in this branch - return the first match
              const match = branchMatches[0];
              if (match.match && match.position) {
                // Use branchRanges to get the correct position of this branch in the original target
                if (targetBranch.branchRanges && i < targetBranch.branchRanges.length) {
                  const branchRange = targetBranch.branchRanges[i];
                  const branchStartIndex = branchRange.start;
                  
                  // Calculate prefix and suffix relative to the entire target
                  const prefix = target.substring(0, branchStartIndex);
                  const suffix = target.substring(branchRange.end);
                  
                  return {
                    match: true,
                    position: {
                      side: side,
                      position: branchStartIndex + (match.position.position || 0),
                      description: `Rule found in branch ${i} at position ${branchStartIndex} in ${side} side`,
                      prefix: prefix || undefined,
                      suffix: suffix || undefined,
                      operandMapping: match.position.operandMapping,
                      wasPatternMatch: match.position.wasPatternMatch,
                    }
                  };
                }
              }
            }
          }
          // If no match found in branches, fall through to regular matching below
        }


        const targetTokens = extractOperandTokens(target);
        const ruleTokens = extractOperandTokens(ruleSide);

        // Handle case where ruleSide has no operands (empty or operators only)
        if (ruleTokens.length === 0) {
          const trimmedRuleSide = ruleSide.trim();
          if (trimmedRuleSide === '') {
            return {
              match: true,
              position: {
                side: side,
                position: 0,
                description: `Empty rule found in ${side} side`,
                prefix: undefined,
                suffix: target || undefined,
              }
            };
          }
          
          // ruleSide has operators but no operands - use normalized spacing matching
          const normalizedRule = normalizeSpacing(ruleSide);
          const normalizedTarget = normalizeSpacing(target);
          
          // Check if normalized rule matches normalized target exactly
          if (normalizedRule === normalizedTarget) {
            return {
              match: true,
              position: {
                side: side,
                position: 0,
                description: `Rule (operators only) matches exactly in ${side} side`,
                prefix: undefined,
                suffix: undefined,
              }
            };
          }
          
          // Try exact string matching as fallback
          const index = target.indexOf(ruleSide);
          if (index !== -1) {
            const prefix = target.substring(0, index);
            const suffix = target.substring(index + ruleSide.length);
            
            return {
              match: true,
              position: {
                side: side,
                position: index,
                description: `Rule (operators only, no operands) found at position ${index} in ${side} side`,
                prefix: prefix || undefined,
                suffix: suffix || undefined,
              }
            };
          }
          
          // If exact match fails, try matching with normalization
          // Find where the normalized rule could match in the normalized target
          if (normalizedTarget === normalizedRule) {
            // The entire target matches the rule after normalization
            // Find a reasonable position (usually 0 for simple cases)
            return {
              match: true,
              position: {
                side: side,
                position: 0,
                description: `Rule (operators only) matches after normalization in ${side} side`,
                prefix: undefined,
                suffix: undefined,
              }
            };
          }
          
          return { match: false };
        }

        // If ruleSide has more operands than target, no match possible
        if (ruleTokens.length > targetTokens.length) {
          return { match: false };
        }

        // Extract rule pattern once (pattern caching optimization)
        const { pattern: rulePattern, operandToVar: ruleOperandToVar } = extractOperandPattern(ruleSide, ruleTokens);

        // Try each operand-aligned starting position in target
        for (let startIdx = 0; startIdx <= targetTokens.length - ruleTokens.length; startIdx++) {
          // Extract the substring that spans from the start operand to the end operand
          const startToken = targetTokens[startIdx];
          const endTokenIdx = startIdx + ruleTokens.length - 1;
          const endToken = targetTokens[endTokenIdx];
          
          // Extend candidate boundaries to include surrounding characters (commas, operators, etc.)
          // that match the rule side structure. The rule side may have commas before the first token
          // and after the last token that need to be included in the candidate.
          let candidateStart = startToken.index;
          let candidateEnd = endToken.endIndex;
          
          // Try to extend backwards to include leading comma/operators if rule side starts with comma
          const ruleTrimmed = ruleSide.trim();
          if (ruleTrimmed.startsWith(',')) {
            // Look backwards from candidateStart to find the preceding comma
            // Continue through operators (backslashes and letters) and whitespace
            for (let i = candidateStart - 1; i >= 0; i--) {
              const char = target[i];
              if (char === ',') {
                candidateStart = i;
                break;
              } else if (/\s/.test(char)) {
                // Continue through whitespace
                continue;
              } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
                // Continue through operators (backslash and letters like \Og, \Os, etc.)
                continue;
              } else {
                // Hit something else, stop
                break;
              }
            }
          }
          
          // Try to extend forwards to include trailing comma/operators if rule side ends with comma
          if (ruleTrimmed.endsWith(',')) {
            // Look forwards from candidateEnd to find the following comma
            // Continue through operators (backslashes and letters) and whitespace
            for (let i = candidateEnd; i < target.length; i++) {
              const char = target[i];
              if (char === ',') {
                candidateEnd = i + 1;
                break;
              } else if (/\s/.test(char)) {
                // Continue through whitespace
                continue;
              } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
                // Continue through operators (backslash and letters like \Og, \Os, etc.)
                continue;
              } else {
                // Hit something else, stop
                break;
              }
            }
          }
          
          const candidate = target.substring(candidateStart, candidateEnd);
          let prefix = target.substring(0, candidateStart);
          let suffix = target.substring(candidateEnd);
          
          // Special handling: if candidate starts with comma and we're replacing with empty/comma-only,
          // we may need to preserve the comma structure. But actually, the prefix should already
          // be correct - if candidate starts at a comma, that comma is part of what we're removing.
          // The issue might be that we need to check if prefix ends with the right structure.

          // Fast path: try exact string match first (very fast, O(1) for many cases)
          // Normalize spacing to handle spacing variations
          if (normalizeSpacing(candidate) === normalizeSpacing(ruleSide)) {
            return {
              match: true,
              position: {
                side: side,
                position: candidateStart,
                description: `Rule found at operand-aligned position ${startIdx} in ${side} side`,
                prefix: prefix || undefined,
                suffix: suffix || undefined,
                wasPatternMatch: false,
              }
            };
          }

          // Pattern matching: extract candidate pattern and compare with rule pattern
          const candidateTokens = extractOperandTokens(candidate);
          if (candidateTokens.length === ruleTokens.length) {
            const { pattern: candidatePattern } = extractOperandPattern(candidate, candidateTokens);
            
            // Patterns match if they have the same structure (same pattern variables in same positions)
            if (normalizeSpacing(candidatePattern) === normalizeSpacing(rulePattern)) {
              // Build operand mapping from ruleSide to candidate
              const operandMapping = buildOperandMapping(ruleTokens, candidateTokens, ruleOperandToVar);
              
              return {
                match: true,
                position: {
                  side: side,
                  position: candidateStart,
                  description: `Rule found at operand-aligned position ${startIdx} (pattern match) in ${side} side`,
                  prefix: prefix || undefined,
                  suffix: suffix || undefined,
                  operandMapping: operandMapping,
                  wasPatternMatch: true,
                }
              };
            }
          }
        }

        return { match: false };
      };

      // Check both sides for substitution
      // Note: targetLeft, targetRight, ruleLeft, ruleRight are already integer expressions
      
      // Helper function to try a substitution and check if it matches
      const trySubstitution = (
        target: string,
        ruleSide: string,
        otherRuleSide: string,
        expectedResult: string,
        targetSideForOperands: string,
        side: 'left' | 'right'
      ) => {
        const result = findSubstitution(target, ruleSide, side);
        if (!result.match || !result.position) {
          return null;
        }
        
        // Special handling for branch operator matches
        // When we match branch operators (e.g., \Blb in \Bb), we've already verified
        // that the branches are compatible. For branch matching, we should verify
        // that the original target matches the expected result directly.
        if (result.position.description?.includes('Branch operator match')) {
          const normalizedTarget = normalizeSpacing(target);
          const normalizedExpected = normalizeSpacing(expectedResult);
          
          if (normalizedTarget === normalizedExpected) {
            return result;
          }
        }
        
        // Special handling for matches within branches
        // When a rule is matched within a branch (e.g., ", " matched in "{,}"),
        // we need to verify that substituting otherRuleSide into that branch location
        // produces the expected result
        if (result.position.description?.includes('Rule found in branch')) {
          // Extract the branch index from the description
          const branchMatch = result.position.description.match(/branch (\d+)/);
          if (branchMatch) {
            const branchIndex = parseInt(branchMatch[1]);
            
            // Extract branch operators from target and expected result
            const targetBranch = extractBranchOperator(target);
            const expectedBranch = extractBranchOperator(expectedResult);
            
            if (targetBranch && expectedBranch && targetBranch.operator === expectedBranch.operator) {
              // Both have the same branch operator - verify substitution works
              if (branchIndex < targetBranch.branches.length && branchIndex < expectedBranch.branches.length) {
                // Check if substituting otherRuleSide into the matched branch produces the expected branch
                const expectedBranchContent = expectedBranch.branches[branchIndex];
                const normalizedExpectedBranch = normalizeSpacing(expectedBranchContent);
                const normalizedOtherRuleSide = normalizeSpacing(otherRuleSide);
                
                // Check if expected branch matches otherRuleSide
                if (normalizedExpectedBranch === normalizedOtherRuleSide) {
                  // Verify condition matches (if both have conditions)
                  const conditionMatches = 
                    (!targetBranch.condition && !expectedBranch.condition) ||
                    (targetBranch.condition && expectedBranch.condition && 
                     normalizeSpacing(targetBranch.condition) === normalizeSpacing(expectedBranch.condition));
                  
                  if (conditionMatches) {
                    // Verify all other branches match
                    // First, check that both have the same number of branches
                    if (targetBranch.branches.length !== expectedBranch.branches.length) {
                      // Different number of branches - can't match, continue to regular substitution
                    } else {
                      let allOtherBranchesMatch = true;
                      for (let i = 0; i < targetBranch.branches.length; i++) {
                        if (i !== branchIndex) {
                          if (normalizeSpacing(targetBranch.branches[i]) !== normalizeSpacing(expectedBranch.branches[i])) {
                            allOtherBranchesMatch = false;
                            break;
                          }
                        }
                      }
                      
                      if (allOtherBranchesMatch) {
                        // Verify prefix and suffix match
                        const targetPrefix = target.substring(0, targetBranch.index);
                        const expectedPrefix = expectedResult.substring(0, expectedBranch.index);
                        const targetSuffix = target.substring(targetBranch.endIndex);
                        const expectedSuffix = expectedResult.substring(expectedBranch.endIndex);
                        
                        // Normalize prefixes and suffixes
                        const normalizedTargetPrefix = normalizeSpacing(targetPrefix);
                        const normalizedExpectedPrefix = normalizeSpacing(expectedPrefix);
                        const normalizedTargetSuffix = normalizeSpacing(targetSuffix);
                        const normalizedExpectedSuffix = normalizeSpacing(expectedSuffix);
                        
                        // For suffix, be more lenient - if one is empty and the other is just whitespace/comma, consider them equivalent
                        let suffixMatches = normalizedTargetSuffix === normalizedExpectedSuffix;
                        if (!suffixMatches) {
                          // Check if one is empty and the other is just comma/whitespace
                          const targetSuffixTrimmed = normalizedTargetSuffix.replace(/^[, ]+$/, '');
                          const expectedSuffixTrimmed = normalizedExpectedSuffix.replace(/^[, ]+$/, '');
                          suffixMatches = targetSuffixTrimmed === expectedSuffixTrimmed;
                        }
                        
                        const prefixMatches = normalizedTargetPrefix === normalizedExpectedPrefix;
                        
                        if (prefixMatches && suffixMatches) {
                          // All parts match - substitution is valid
                          return result;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // Convert otherRuleSide if pattern matching was used
        let converted = otherRuleSide;
        if (result.position.wasPatternMatch && result.position.operandMapping) {
          converted = convertRuleOtherSide(
            otherRuleSide,
            result.position.operandMapping,
            result.position.prefix || '',
            result.position.suffix || '',
            targetSideForOperands,
            expectedResult
          );
        }
        
        // Special handling: if converted is empty (because otherRuleSide was just a comma),
        // check if we should preserve a comma from the original candidate structure
        let finalConverted = converted;
        if (!finalConverted || finalConverted.trim() === '') {
          const prefix = result.position.prefix || '';
          const suffix = result.position.suffix || '';
          const currentResult = prefix + finalConverted + suffix;
          const normalizedCurrent = normalizeSpacing(currentResult);
          const normalizedExpected = normalizeSpacing(expectedResult);
          
          // If current result doesn't match, and expected ends with comma but current doesn't,
          // try adding a comma (this handles the case where candidate started with comma)
          if (normalizedCurrent !== normalizedExpected) {
            if (normalizedExpected.endsWith(',') && !normalizedCurrent.endsWith(',')) {
              const withComma = prefix + ',' + suffix;
              if (normalizeSpacing(withComma) === normalizedExpected) {
                finalConverted = ',';
              }
            }
          }
        }
        
        // Check if substitution matches expected result
        const substituted = (result.position.prefix || '') + finalConverted + (result.position.suffix || '');
        if (normalizeSpacing(substituted) === normalizeSpacing(expectedResult)) {
          return result;
        }
        
        return null;
      };
      
      // Try all 4 substitution directions
      let result = trySubstitution(targetLeft, ruleLeft, ruleRight, targetRight, targetLeft, 'left');
      if (result) return result;
      
      result = trySubstitution(targetLeft, ruleRight, ruleLeft, targetRight, targetLeft, 'left');
      if (result) return result;
      
      result = trySubstitution(targetRight, ruleLeft, ruleRight, targetLeft, targetRight, 'right');
      if (result) return result;
      
      result = trySubstitution(targetRight, ruleRight, ruleLeft, targetLeft, targetRight, 'right');
      if (result) return result;

      return { match: false };
    },
  },
];

/**
 * Check if a normalized rule matches the target using inference rules
 * 
 * @param targetIntegerLeft - Normalized integer expression of target left side
 * @param targetIntegerRight - Normalized integer expression of target right side
 * @param ruleIntegerLeft - Normalized integer expression of rule left side
 * @param ruleIntegerRight - Normalized integer expression of rule right side
 * @returns Object with match status, inference rule name, and match position
 */
export const checkInferenceRules = (
  targetIntegerLeft: string,
  targetIntegerRight: string,
  ruleIntegerLeft: string,
  ruleIntegerRight: string
): { match: boolean; inferenceRule?: string; matchPosition?: MatchPosition; grammarError?: string } => {
  // First, check grammar for target expressions
  const targetLeftGrammar = checkGrammar(targetIntegerLeft);
  if (!targetLeftGrammar.isValid) {
    const errors = targetLeftGrammar.errors.map(e => e.message).join('; ');
    return {
      match: false,
      grammarError: `Target left side has grammar errors: ${errors}`
    };
  }

  const targetRightGrammar = checkGrammar(targetIntegerRight);
  if (!targetRightGrammar.isValid) {
    const errors = targetRightGrammar.errors.map(e => e.message).join('; ');
    return {
      match: false,
      grammarError: `Target right side has grammar errors: ${errors}`
    };
  }

  // Try exact match first (fastest check)
  if (targetIntegerLeft === ruleIntegerLeft && targetIntegerRight === ruleIntegerRight) {
    return {
      match: true,
      inferenceRule: 'Exact Match',
      matchPosition: {
        side: 'both',
        description: 'Both sides match exactly'
      }
    };
  }

  // Try each inference rule (ordered by likelihood/fastest checks first)
  for (const infRule of InferenceRules) {
    const result = infRule.check(targetIntegerLeft, targetIntegerRight, ruleIntegerLeft, ruleIntegerRight);
    if (result.match) {
      return {
        match: true,
        inferenceRule: infRule.name,
        matchPosition: result.position
      };
    }
  }

  return { match: false };
};
