/**
 * Substitution logic for inference rules
 * Uses DAG isomorphism (VF2) for rule applicability after operand normalization.
 * A single VF2 pass on the full target finds the match and operand mapping.
 */

import type { DAGStructure, ExprNodeData } from '../dag';
import { MatchPosition } from './types';
import { normalizeSpacing, extractOperandTokens } from './utils';
import { exprToDAG, dagToExpr, vf2ExprSubgraphIsomorphism, vf2ExprSubgraphIsomorphismAll, substituteInDAG, extractSubgraphFromNode, augmentTargetDAGForTcMatching } from '../dag';

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
  const prefixOperands = extractOperandsFromText(prefix);
  const suffixOperands = extractOperandsFromText(suffix);
  const targetOperands = extractOperandsFromText(targetSide);
  
  // Also extract operands from expectedResult if provided
  const expectedOperands = expectedResult ? extractOperandsFromText(expectedResult) : new Set<string>();
  
  // All existing operands from the target side (prefix + suffix + target itself + expected result)
  const existingOperands = new Set([...prefixOperands, ...suffixOperands, ...targetOperands, ...expectedOperands]);
  
  const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
  const mapping =
    expectedResult &&
    resolveOperandMapping(ruleOtherTokens, operandMapping, existingOperands, (m) => {
      const converted = applyOperandMapping(ruleOtherSide, ruleOtherTokens, m);
      const isJustComma = converted.trim() === ',';
      const substituted = prefix + (isJustComma ? '' : converted) + suffix;
      return normalizeSpacing(substituted) === normalizeSpacing(expectedResult);
    });

  if (mapping) {
    const converted = applyOperandMapping(ruleOtherSide, ruleOtherTokens, mapping);
    return converted.trim() === ',' ? '' : converted;
  }

  const usedOperands = new Set([...prefixOperands, ...suffixOperands, ...operandMapping.values()]);
  let maxUsed = 0;
  usedOperands.forEach((op) => {
    const n = parseInt(op, 10);
    if (!isNaN(n) && n > maxUsed) maxUsed = n;
  });
  let nextUnused = maxUsed + 1;
  const fallbackMapping = new Map(operandMapping);
  for (const t of ruleOtherTokens) {
    if (!fallbackMapping.has(t.token)) {
      fallbackMapping.set(t.token, (nextUnused++).toString());
    }
  }
  const converted = applyOperandMapping(ruleOtherSide, ruleOtherTokens, fallbackMapping);
  return converted.trim() === ',' ? '' : converted;
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

type OperandToken = { token: string; index: number; endIndex: number };

/** Resolve full operand mapping: try existing operands first, fallback to new. Returns mapping if tryMatch succeeds. */
function resolveOperandMapping(
  ruleOtherTokens: OperandToken[],
  operandMapping: Map<string, string>,
  existingOperands: Set<string>,
  tryMatch: (mapping: Map<string, string>) => boolean
): Map<string, string> | null {
  const unmappedTokens = ruleOtherTokens.filter((t) => !operandMapping.has(t.token));
  if (unmappedTokens.length > 0) {
    const tryAssignExisting = (tokenIdx: number, mapping: Map<string, string>): Map<string, string> | null => {
      if (tokenIdx >= unmappedTokens.length) return tryMatch(mapping) ? new Map(mapping) : null;
      const token = unmappedTokens[tokenIdx];
      if (mapping.has(token.token)) return tryAssignExisting(tokenIdx + 1, mapping);
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
  } else if (tryMatch(operandMapping)) {
    return new Map(operandMapping);
  }
  return null;
}

/** Apply mapping to ruleOtherSide string. */
function applyOperandMapping(ruleOtherSide: string, ruleOtherTokens: OperandToken[], mapping: Map<string, string>): string {
  let converted = ruleOtherSide;
  const sorted = [...ruleOtherTokens].sort((a, b) => b.index - a.index);
  for (const token of sorted) {
    const newOperand = mapping.get(token.token) ?? token.token;
    converted = converted.substring(0, token.index) + newOperand + converted.substring(token.endIndex);
  }
  return converted;
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
  const mapping = resolveTcOperandMapping(patternDAG, targetDAG, nodeMapping, new Map(operandMapping));
  const targetOperands = extractOperandsFromText(targetSide);
  const expectedOperands = expectedResult ? extractOperandsFromText(expectedResult) : new Set<string>();
  const existingOperands = new Set([...targetOperands, ...expectedOperands]);

  // Expand \Tc in pattern before converting to node; one Tc can map to empty operation
  const expandedRuleOtherSide = expandTcInRuleSide(ruleOtherSide, mapping, patternDAG);
  const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
  const replacementDAG = exprToDAG(normalizeSpacing(expandedRuleOtherSide));
  const tryConversion = (m: Map<string, string>): string => {
    const merged = substituteInDAG(targetDAG, patternDAG, replacementDAG, nodeMapping, m);
    return dagToExpr(merged);
  };

  const resolvedMapping =
    expectedResult &&
    resolveOperandMapping(ruleOtherTokens, mapping, existingOperands, (m) => {
      const substituted = tryConversion(m);
      return normalizeSpacing(substituted) === normalizeSpacing(expectedResult);
    });

  if (resolvedMapping) return tryConversion(resolvedMapping);

  const usedOperands = new Set([...targetOperands, ...mapping.values()]);
  let maxUsed = 0;
  usedOperands.forEach((op) => {
    const n = parseInt(op, 10);
    if (!isNaN(n) && n > maxUsed) maxUsed = n;
  });
  let nextUnused = maxUsed + 1;
  const fallbackMapping = new Map(mapping);
  for (const t of ruleOtherTokens) {
    if (!fallbackMapping.has(t.token)) {
      fallbackMapping.set(t.token, (nextUnused++).toString());
    }
  }
  return tryConversion(fallbackMapping);
}

/**
 * For each pattern node with op \Tc, the operand maps to the expression (one or more ops including branch)
 * at the matched target node. Augment operandMapping with these Tc operand -> expression entries.
 * Empty target arms (e.g. tail node) map to ',' (empty operation).
 */
function resolveTcOperandMapping(
  patternDAG: DAGStructure<ExprNodeData>,
  targetDAG: DAGStructure<ExprNodeData>,
  nodeMapping: Map<string, string>,
  operandMapping: Map<string, string>
): Map<string, string> {
  const result = new Map(operandMapping);
  const pNodeMap = new Map(patternDAG.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  for (const [pId, tId] of nodeMapping) {
    const pNode = pNodeMap.get(pId);
    const pData = pNode?.data as ExprNodeData | undefined;
    if (pData?.op !== '\\Tc' || !pData.operands?.length) continue;
    const tcOperand = pData.operands[0];
    const tNode = tNodeMap.get(tId);
    const tData = tNode?.data as ExprNodeData | undefined;
    // Target tail (empty arm): map to empty operation directly
    if (tData?.op?.endsWith?.(':tail')) {
      result.set(tcOperand, ',');
      continue;
    }
    const subgraph = extractSubgraphFromNode(targetDAG, tId);
    if (subgraph.nodes.length === 0) continue;
    const expr = dagToExpr(subgraph);
    const trimmed = expr.replace(/^,\s*|\s*,$/g, '').trim();
    result.set(tcOperand, trimmed ? `,${trimmed},` : ',');
  }
  return result;
}

/**
 * Expand \Tc placeholders in ruleOtherSide with resolved expressions before converting to DAG.
 * Replaces each ,\Tc c_X, with the mapped expression (including empty ',' for empty arms).
 */
function expandTcInRuleSide(ruleOtherSide: string, tcMapping: Map<string, string>, patternDAG: DAGStructure<ExprNodeData>): string {
  let expanded = ruleOtherSide;
  // Replace Tc operands in reverse order of length so c_10 before c_1
  const tcOperands = [...patternDAG.nodes]
    .filter((n) => (n.data as ExprNodeData)?.op === '\\Tc' && (n.data as ExprNodeData)?.operands?.length)
    .map((n) => (n.data as ExprNodeData).operands![0])
    .filter((op) => tcMapping.has(op))
    .sort((a, b) => b.length - a.length);
  for (const op of tcOperands) {
    const value = tcMapping.get(op)!;
    const re = new RegExp(`,\\s*\\\\Tc\\s+${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`, 'g');
    expanded = expanded.replace(re, value);
  }
  return expanded;
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
  let targetDAG = exprToDAG(normalizedTarget);
  const hasTc = patternDAG.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  if (hasTc && patternDAG.nodes.length > targetDAG.nodes.length) {
    targetDAG = augmentTargetDAGForTcMatching(targetDAG) as DAGStructure<ExprNodeData>;
  }
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

/** Get positions where we can insert between top-level comma-separated segments. */
function getCommaBoundaries(expr: string): number[] {
  const boundaries = [0];
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '{') depth++;
    else if (expr[i] === '}') depth--;
    else if (expr[i] === ',' && depth === 0) boundaries.push(i + 1);
  }
  boundaries.push(expr.length);
  return boundaries;
}

/**
 * Helper function to try a substitution and check if it matches.
 * Tries all match candidates (multiple subexpressions can match) until one produces the expected result.
 * Uses DAG-based substitution when available: prefix/suffix/replacement are merged at the DAG level
 * so heads and tails connect correctly (no character-position splicing).
 * When rule side parses to empty DAG (e.g. ","), tries insertion at each top-level comma boundary.
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
  let targetDAG = exprToDAG(normalizedTarget);
  const hasTc = patternDAG.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  if (hasTc && patternDAG.nodes.length > targetDAG.nodes.length) {
    targetDAG = augmentTargetDAGForTcMatching(targetDAG) as DAGStructure<ExprNodeData>;
  }

  // Normalize expected for comparison (roundtrip through parser strips if(...) from conditions)
  let normalizedExpected = normalizeSpacing(expectedResult);
  try {
    normalizedExpected = normalizeSpacing(dagToExpr(exprToDAG(normalizedExpected)));
  } catch {
    // keep original if roundtrip fails
  }

  if (patternDAG.nodes.length > targetDAG.nodes.length) {
    return null;
  }

  // Empty pattern (e.g. rule left ","): try insertion at each top-level comma boundary
  if (patternDAG.nodes.length === 0) {
    const boundaries = getCommaBoundaries(normalizedTarget);
    for (let i = 0; i < boundaries.length; i++) {
      const b = boundaries[i];
      const prefix = normalizedTarget.substring(0, b);
      const suffix = normalizedTarget.substring(b);
      const converted = convertRuleOtherSide(
        otherRuleSide,
        new Map(),
        prefix,
        suffix,
        targetSideForOperands,
        normalizedExpected
      );
      const convertedForSub = converted.trim() === ',' ? '' : converted;
      const result = prefix + convertedForSub + suffix;
      if (normalizeSpacing(result) === normalizedExpected) {
        return {
          match: true,
          reconstructedExpr: result,
          position: {
            side,
            position: b,
            description: `Rule (empty pattern) inserted at position ${b} in ${side} side`,
            prefix: prefix || undefined,
            suffix: suffix || undefined,
            operandMapping: new Map(),
            wasPatternMatch: false,
            targetDAG,
            patternDAG,
            nodeMapping: new Map(),
          },
        };
      }
    }
    return null;
  }

  // DAG-based: try each match candidate until one produces the expected result
  const maxTrials = targetDAG.nodes.length > 12 ? 32 : 64;
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
        normalizedExpected
      );
      if (normalizeSpacing(substituted) === normalizedExpected) {
        return {
          match: true,
          reconstructedExpr: substituted,
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
      continue;
    }
  }

  return null;
};
