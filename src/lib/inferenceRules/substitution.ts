/**
 * Substitution logic for inference rules
 * Uses DAG isomorphism (VF2) for rule applicability after operand normalization.
 * A single VF2 pass on the full target finds the match and operand mapping.
 */

import type { DAGStructure, ExprNodeData } from '../dag';
import { MatchPosition } from './types';
import { normalizeSpacing, extractOperandTokens } from './utils';
import { exprToDAG, dagToExpr, vf2ExprSubgraphIsomorphism, vf2ExprSubgraphIsomorphismAll, substituteInDAG } from '../dag';

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

/** Extract operand tokens (numbers, identifiers) from text for mapping */
function extractOperandsFromText(text: string): Set<string> {
  const operands = new Set<string>();
  const numberPattern = /\b(\d+)\b/g;
  const identPattern = /\b([a-zA-Z](?:_\d+)?)\b/g;
  let match;
  while ((match = numberPattern.exec(text)) !== null) operands.add(match[1]);
  while ((match = identPattern.exec(text)) !== null) operands.add(match[1]);
  return operands;
}

/**
 * Convert ruleOtherSide using DAG-based substitution.
 * Replaces the matched sub-DAG in target with the rule's other side,
 * connecting prefix DAG tails to replacement heads and replacement tails to suffix DAG heads.
 */
function convertRuleOtherSideWithDAG(
  ruleOtherSide: string,
  operandMapping: Map<string, string>,
  targetDAG: DAGStructure<ExprNodeData>,
  patternDAG: DAGStructure<ExprNodeData>,
  nodeMapping: Map<string, string>,
  targetSide: string,
  expectedResult?: string
): string {
  const targetOperands = extractOperandsFromText(targetSide);
  const expectedOperands = expectedResult ? extractOperandsFromText(expectedResult) : new Set<string>();
  const existingOperands = new Set([...targetOperands, ...expectedOperands]);

  const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
  const unmappedTokens = ruleOtherTokens.filter((t) => !operandMapping.has(t.token));

  const replacementDAG = exprToDAG(normalizeSpacing(ruleOtherSide));

  const tryConversion = (mapping: Map<string, string>): string => {
    const merged = substituteInDAG(targetDAG, patternDAG, replacementDAG, nodeMapping, mapping);
    return dagToExpr(merged);
  };

  const testMatch = (mapping: Map<string, string>): boolean => {
    const substituted = tryConversion(mapping);
    return normalizeSpacing(substituted) === normalizeSpacing(expectedResult ?? '');
  };

  if (unmappedTokens.length > 0 && expectedResult) {
    const tryAssignExisting = (tokenIdx: number, mapping: Map<string, string>): string | null => {
      if (tokenIdx >= unmappedTokens.length) {
        return testMatch(mapping) ? tryConversion(mapping) : null;
      }
      const token = unmappedTokens[tokenIdx];
      if (mapping.has(token.token)) {
        return tryAssignExisting(tokenIdx + 1, mapping);
      }
      for (const existingOp of existingOperands) {
        const nextMap = new Map(mapping);
        nextMap.set(token.token, existingOp);
        const result = tryAssignExisting(tokenIdx + 1, nextMap);
        if (result !== null) return result;
      }
      return null;
    };
    const result = tryAssignExisting(0, new Map(operandMapping));
    if (result !== null) return result;
  }

  const usedOperands = new Set([...targetOperands, ...operandMapping.values()]);
  let maxUsed = 0;
  usedOperands.forEach((op) => {
    const num = parseInt(op, 10);
    if (!isNaN(num) && num > maxUsed) maxUsed = num;
  });
  let nextUnused = maxUsed + 1;
  const fullMapping = new Map(operandMapping);
  for (const t of ruleOtherTokens) {
    if (!fullMapping.has(t.token)) {
      fullMapping.set(t.token, (nextUnused++).toString());
    }
  }
  return tryConversion(fullMapping);
}

/**
 * Find substitution match in target expression using DAG isomorphism.
 * Rule applicability after operand normalization is equivalent to DAG isomorphism:
 * the rule matches if its expression DAG is isomorphic to a subgraph of the target's DAG.
 */
export const findSubstitution = function findSubstitutionRecursive(
  target: string,
  ruleSide: string,
  side: 'left' | 'right'
): { match: boolean; position?: MatchPosition } {
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
        },
      };
    }

    // ruleSide has operators but no operands - use normalized spacing matching
    const normalizedRule = normalizeSpacing(ruleSide);
    const normalizedTarget = normalizeSpacing(target);
    if (normalizedRule === normalizedTarget) {
      return {
        match: true,
        position: {
          side: side,
          position: 0,
          description: `Rule (operators only) matches exactly in ${side} side`,
          prefix: undefined,
          suffix: undefined,
        },
      };
    }

    const index = target.indexOf(ruleSide);
    if (index !== -1) {
      return {
        match: true,
        position: {
          side: side,
          position: index,
          description: `Rule (operators only, no operands) found at position ${index} in ${side} side`,
          prefix: target.substring(0, index) || undefined,
          suffix: target.substring(index + ruleSide.length) || undefined,
        },
      };
    }

    return { match: false };
  }

  const normalizedTarget = normalizeSpacing(target);
  const normalizedRule = normalizeSpacing(ruleSide);

  // DAG isomorphism: single pass on full target. Rule DAG uses original operands (i, m, j).
  const patternDAG = exprToDAG(normalizedRule);
  const targetDAG = exprToDAG(normalizedTarget);

  if (patternDAG.nodes.length === 0 || patternDAG.nodes.length > targetDAG.nodes.length) {
    return { match: false };
  }

  const result = vf2ExprSubgraphIsomorphism(patternDAG, targetDAG);
  if (result === null) {
    return { match: false };
  }

  // Get match region from matched target nodes' positions
  let candidateStart = target.length;
  let candidateEnd = 0;
  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  for (const targetId of result.mapping.values()) {
    const node = tNodeMap.get(targetId);
    const data = node?.data as { start?: number; end?: number } | undefined;
    if (data?.start != null) candidateStart = Math.min(candidateStart, data.start);
    if (data?.end != null) candidateEnd = Math.max(candidateEnd, data.end);
  }

  if (candidateStart >= candidateEnd) {
    return { match: false };
  }

  // Character-based prefix/suffix (kept for fallback; substitution uses DAG structure)
  const prefix = normalizedTarget.substring(0, candidateStart);
  const suffix = normalizedTarget.substring(candidateEnd);

  // result.operandMapping already maps rule operand -> target operand
  const operandMapping = result.operandMapping.size > 0 ? result.operandMapping : undefined;

  return {
    match: true,
    position: {
      side,
      position: candidateStart,
      description: `Rule found (DAG isomorphism) in ${side} side`,
      prefix: prefix || undefined,
      suffix: suffix || undefined,
      operandMapping,
      wasPatternMatch: true,
      targetDAG,
      patternDAG,
      nodeMapping: result.mapping,
    },
  };
};

/**
 * Helper function to try a substitution and check if it matches.
 * Tries all match candidates (multiple subexpressions can match) until one produces the expected result.
 * Uses DAG-based substitution when available: prefix/suffix/replacement are merged at the DAG level
 * so heads and tails connect correctly (no character-position splicing).
 */
export const trySubstitution = (
  target: string,
  ruleSide: string,
  otherRuleSide: string,
  expectedResult: string,
  targetSideForOperands: string,
  side: 'left' | 'right',
  stepCounter?: { count: number }
) => {
  const normalizedTarget = normalizeSpacing(target);
  const normalizedRule = normalizeSpacing(ruleSide);
  const patternDAG = exprToDAG(normalizedRule);
  const targetDAG = exprToDAG(normalizedTarget);

  if (patternDAG.nodes.length > targetDAG.nodes.length) {
    return null;
  }

  // DAG-based: try each match candidate until one produces the expected result
  // Cap iterations to avoid freeze on complex branch expressions (VF2 can yield exponentially many matches)
  const maxTrials = targetDAG.nodes.length > 12 ? 32 : 64;
  if (patternDAG.nodes.length > 0) {
    let trialCount = 0;
    const sc = stepCounter ?? { count: 0 };
    if (stepCounter) stepCounter.count = 0;
    for (const vf2Result of vf2ExprSubgraphIsomorphismAll(patternDAG, targetDAG, { stepCounter: sc })) {
      if (++trialCount > maxTrials) break;
      const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
      let candidateStart = normalizedTarget.length;
      let candidateEnd = 0;
      for (const targetId of vf2Result.mapping.values()) {
        const node = tNodeMap.get(targetId);
        const data = node?.data as { start?: number; end?: number } | undefined;
        if (data?.start != null) candidateStart = Math.min(candidateStart, data.start);
        if (data?.end != null) candidateEnd = Math.max(candidateEnd, data.end);
      }
      if (candidateStart >= candidateEnd) continue;

      const operandMapping = vf2Result.operandMapping.size > 0 ? vf2Result.operandMapping : undefined;
      if (!operandMapping) continue;

      try {
        const substituted = convertRuleOtherSideWithDAG(
          otherRuleSide,
          operandMapping,
          targetDAG,
          patternDAG,
          vf2Result.mapping,
          targetSideForOperands,
          expectedResult
        );
        if (normalizeSpacing(substituted) === normalizeSpacing(expectedResult)) {
          return {
            match: true,
            position: {
              side,
              position: candidateStart,
              description: `Rule found (DAG isomorphism) in ${side} side`,
              prefix: normalizedTarget.substring(0, candidateStart) || undefined,
              suffix: normalizedTarget.substring(candidateEnd) || undefined,
              operandMapping,
              wasPatternMatch: true,
              targetDAG,
              patternDAG,
              nodeMapping: vf2Result.mapping,
            },
          };
        }
      } catch {
        // DAG merge/serialize failed; try next match
      }
    }
  }

  // Fallback: try findSubstitution for non-DAG cases (operators only, no operands)
  const result = findSubstitution(target, ruleSide, side);
  if (!result.match || !result.position) return null;
  if (result.position.wasPatternMatch) return null; // already tried above
  let converted = otherRuleSide;
  const substituted = (result.position.prefix || '') + converted + (result.position.suffix || '');
  if (normalizeSpacing(substituted) === normalizeSpacing(expectedResult)) {
    return result;
  }
  return null;
};
