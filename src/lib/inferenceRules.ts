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

      // Extract operand tokens and their positions from integer expressions
      const extractOperandTokens = (expr: string): Array<{ token: string; index: number; endIndex: number }> => {
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

      const findSubstitution = (target: string, ruleSide: string, side: 'left' | 'right') => {

        // Extract operand pattern: convert numbers to pattern variables (A, B, C, ...)
        // e.g., ", 1 \Oc 2, 2 \Os," → ", A \Oc B, B \Os,"
        // Maps each unique operand number to a pattern variable, preserving operand reuse
        // Returns both the pattern string and the operand-to-variable mapping
        const extractOperandPattern = (
          expr: string, 
          tokens: Array<{ token: string; index: number; endIndex: number }>
        ): { pattern: string; operandToVar: Map<string, string> } => {
          const patternVars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
          const operandToVar = new Map<string, string>(); // Maps operand number to pattern variable
          let patternVarIdx = 0;
          
          // Build mapping: first occurrence of each operand number gets next pattern variable
          tokens.forEach(token => {
            if (!operandToVar.has(token.token)) {
              operandToVar.set(token.token, patternVars[patternVarIdx++]);
            }
          });
          
          // Build pattern string by replacing operand numbers with pattern variables
          let pattern = expr;
          // Replace from right to left to avoid index shifting issues
          // 
          // Why right-to-left? When replacing substrings, each replacement creates a new string.
          // If we replace left-to-right, each replacement can change the length of the string,
          // which shifts the indices of all tokens that come after it. For example:
          //   Original: ", 1 \\Oc 22, 3 \\Os," (indices: "1" at 2, "22" at 7, "3" at 13)
          //   If we replace "1" with "ABC" (3 chars), the string becomes:
          //   ", ABC \\Oc 22, 3 \\Os," (new indices: "22" at 9, "3" at 15)
          //   The stored index 7 for "22" is now invalid!
          //
          // By replacing right-to-left, we process tokens in descending index order.
          // Each replacement only affects positions AFTER the current token, but we've
          // already processed those tokens, so the stored indices remain valid.
          const sortedTokens = [...tokens].sort((a, b) => b.index - a.index);
          sortedTokens.forEach(token => {
            const patternVar = operandToVar.get(token.token)!;
            pattern = pattern.substring(0, token.index) + patternVar + pattern.substring(token.endIndex);
          });
          
          return { pattern, operandToVar };
        };

        // Build operand mapping from ruleSide to candidate based on pattern matching
        // Returns a map from ruleSide operand numbers to candidate operand numbers
        const buildOperandMapping = (
          ruleTokens: Array<{ token: string; index: number; endIndex: number }>,
          candidateTokens: Array<{ token: string; index: number; endIndex: number }>,
          ruleOperandToVar: Map<string, string>
        ): Map<string, string> => {
          const mapping = new Map<string, string>();
          
          // Build var-to-candidate mapping
          const candidateVarToOperand = new Map<string, string>();
          candidateTokens.forEach((token, idx) => {
            // Find which pattern variable this corresponds to (by position)
            // We need to match by pattern variable order, not by operand value
            const ruleToken = ruleTokens[idx];
            const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
            if (!candidateVarToOperand.has(ruleVar)) {
              candidateVarToOperand.set(ruleVar, token.token);
            }
          });
          
          // Build ruleSide operand -> candidate operand mapping
          ruleTokens.forEach((ruleToken, idx) => {
            const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
            const candidateOperand = candidateVarToOperand.get(ruleVar)!;
            mapping.set(ruleToken.token, candidateOperand);
          });
          
          return mapping;
        };

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
          
          // ruleSide has operators but no operands - use simple string matching
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
