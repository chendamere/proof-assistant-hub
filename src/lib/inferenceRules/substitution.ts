/**
 * Substitution logic for inference rules
 */

import { MatchPosition } from './types';
import { normalizeSpacing, extractOperandTokens, extractOperandPattern, buildOperandMapping } from './utils';

/**
 * Convert ruleOtherSide using operand mapping
 * For unmapped operands: first try existing operands from targetSide, then try new operands if needed
 */
export const convertRuleOtherSide = (
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

/**
 * Find substitution match in target expression
 */
export const findSubstitution = function findSubstitutionRecursive(
  target: string, 
  ruleSide: string, 
  side: 'left' | 'right'
): { match: boolean; position?: MatchPosition } {
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

/**
 * Helper function to try a substitution and check if it matches
 */
export const trySubstitution = (
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
