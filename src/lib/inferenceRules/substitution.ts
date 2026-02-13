/**
 * Substitution logic for inference rules
 * Uses DAG injection (VF2) for rule applicability after operand normalization.
 * A single VF2 pass on the full target finds the match and operand mapping.
 */

import type { DAGStructure, ExprNodeData } from '../dag';
import { MatchPosition } from './types';
import { normalizeSpacing, ensureCommaWrapped, normalizeUnaryOpOrderForComparison, extractOperandTokens, oeToPeInExpression } from './utils';
import { exprToDAG, dagToExpr, SingleRootDAGInjection, substituteInDAG, substituteInDAGPartialFactor, extractSubgraphFromNode, extractSubgraphIncomingFromNode, augmentTargetDAGForTcMatching, patternOpMultisetContainedInTarget } from '../dag';

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
      return normalizeUnaryOpOrderForComparison(normalizeSpacing(substituted)) === normalizeUnaryOpOrderForComparison(normalizeSpacing(expectedResult));
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
  // Try identity mapping first when all unmapped tokens exist in existingOperands (common for empty-pattern Oe→Pe)
  if (unmappedTokens.length > 0 && unmappedTokens.every((t) => existingOperands.has(t.token))) {
    const identityMap = new Map(operandMapping);
    for (const t of unmappedTokens) identityMap.set(t.token, t.token);
    if (tryMatch(identityMap)) return identityMap;
  }
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
  const { mapping, partialFactorOperands, tcExpressionsByOperand } = resolveTcOperandMapping(
    patternDAG,
    targetDAG,
    nodeMapping,
    new Map(operandMapping)
  );
  const targetOperands = extractOperandsFromText(targetSide);
  const expectedOperands = expectedResult ? extractOperandsFromText(expectedResult) : new Set<string>();
  const existingOperands = new Set([...targetOperands, ...expectedOperands]);

  // \Tc operands map to sequences of operations (used only for expanding the rule string), not for DAG operand substitution
  const tcOperands = new Set(
    patternDAG.nodes
      .filter((n) => (n.data as ExprNodeData)?.op === '\\Tc' && (n.data as ExprNodeData)?.operands?.length)
      .map((n) => (n.data as ExprNodeData).operands![0])
  );
  const operandsOnly = (m: Map<string, string>) => new Map([...m].filter(([k]) => !tcOperands.has(k)));

  let expandedRuleOtherSide: string;
  let usePartialFactorMerge = false;
  let arm1DAG: DAGStructure<ExprNodeData> | null = null;
  let arm2DAG: DAGStructure<ExprNodeData> | null = null;
  let suffixInsertDAG: DAGStructure<ExprNodeData> | null = null;

  if (partialFactorOperands.size > 0 && tcExpressionsByOperand.size > 0) {
    const tcOp = [...partialFactorOperands][0];
    const exprs = tcExpressionsByOperand.get(tcOp);
    const commonSuffix = mapping.get(tcOp) ?? ',';
    if (exprs && exprs.length >= 2) {
      const trimmed1 = trimSuffix(exprs[0], commonSuffix);
      const trimmed2 = trimSuffix(exprs[1], commonSuffix);
      const brs = findBrsArms(ruleOtherSide);
      if (brs) {
        usePartialFactorMerge = true;
        arm1DAG = exprToDAG(normalizeSpacing(trimmed1)) as DAGStructure<ExprNodeData>;
        arm2DAG = exprToDAG(normalizeSpacing(trimmed2)) as DAGStructure<ExprNodeData>;
        suffixInsertDAG = exprToDAG(normalizeSpacing(commonSuffix)) as DAGStructure<ExprNodeData>;
        if (typeof process !== 'undefined' && process.env.DEBUG_PARTIAL_FACTOR === '1') {
          console.error('[DEBUG_PARTIAL_FACTOR] convertRuleOtherSideWithDAG (partial factor path):');
          console.error('  exprs[0]:', JSON.stringify(exprs[0]), 'exprs[1]:', JSON.stringify(exprs[1]));
          console.error('  commonSuffix:', JSON.stringify(commonSuffix));
          console.error('  trimmed1:', JSON.stringify(trimmed1), 'trimmed2:', JSON.stringify(trimmed2));
          console.error('  arm1DAG nodes:', arm1DAG.nodes.length, 'arm2DAG:', arm2DAG.nodes.length, 'suffixInsertDAG:', suffixInsertDAG.nodes.length);
        }
        const beforeBrs = ruleOtherSide.slice(0, brs.start);
        const afterBrs = ruleOtherSide.slice(brs.end);
        const ruleWithArms = beforeBrs + '{' + trimmed1 + '}{' + trimmed2 + '}' + afterBrs;
        expandedRuleOtherSide = expandTcInRuleSide(ruleWithArms, mapping, patternDAG);
      } else {
        expandedRuleOtherSide = expandTcInRuleSide(ruleOtherSide, mapping, patternDAG);
      }
    } else {
      expandedRuleOtherSide = expandTcInRuleSide(ruleOtherSide, mapping, patternDAG);
    }
  } else {
    expandedRuleOtherSide = expandTcInRuleSide(ruleOtherSide, mapping, patternDAG);
  }

  const ruleOtherTokens = extractOperandTokens(ruleOtherSide);
  const replacementDAG = exprToDAG(normalizeSpacing(expandedRuleOtherSide));
  const tryConversion = (m: Map<string, string>): string => {
    if (usePartialFactorMerge && arm1DAG && arm2DAG && suffixInsertDAG) {
      const merged = substituteInDAGPartialFactor(
        targetDAG,
        patternDAG,
        nodeMapping,
        arm1DAG,
        arm2DAG,
        suffixInsertDAG,
        operandsOnly(m)
      );
      // Don't pass operand mapping to dagToExpr: replacement nodes already have operands substituted via applySubst during merge,
      // and target nodes should keep their original operands (not be mapped).
      return dagToExpr(merged, undefined, { literalTc: true });
    }
    const merged = substituteInDAG(targetDAG, patternDAG, replacementDAG, nodeMapping, operandsOnly(m));
    // Don't pass operand mapping to dagToExpr: replacement nodes already have operands substituted via applySubst during merge,
    // and target nodes should keep their original operands (not be mapped).
    return dagToExpr(merged, undefined, { literalTc: true });
  };

  const resolvedMapping =
    expectedResult &&
    resolveOperandMapping(ruleOtherTokens, mapping, existingOperands, (m) => {
      const substituted = tryConversion(m);
      return normalizeUnaryOpOrderForComparison(normalizeSpacing(substituted)) === normalizeUnaryOpOrderForComparison(normalizeSpacing(expectedResult));
    });

  if (resolvedMapping) return tryConversion(resolvedMapping);

  const usedOperands = new Set([...targetOperands, ...mapping.values()]);
  let maxUsed = 0;
  usedOperands.forEach((op) => {
    const n = parseInt(op, 10);
    if (!isNaN(n) && n > maxUsed) maxUsed = n;
  });
  let nextUnused = maxUsed + 1;
  const fallbackMapping = new Map<string, string>(mapping);
  for (const t of ruleOtherTokens) {
    if (!fallbackMapping.has(t.token)) {
      // Prefer same token from existing operands (e.g. expected uses "j") so output format matches expected
      const preferred = existingOperands.has(t.token) ? t.token : (nextUnused++).toString();
      fallbackMapping.set(t.token, preferred);
    }
  }
  return tryConversion(fallbackMapping);
}

/** Longest common suffix of normalized expressions (for partial \Tc factor). */
function longestCommonSuffix(exprs: string[]): string {
  if (exprs.length === 0) return ',';
  const normalized = exprs.map((e) => normalizeSpacing(e));
  let suf = normalized[0];
  for (let i = 1; i < normalized.length; i++) {
    const b = normalized[i];
    let j = suf.length - 1;
    let k = b.length - 1;
    while (j >= 0 && k >= 0 && suf[j] === b[k]) {
      j--;
      k--;
    }
    suf = suf.slice(j + 1);
  }
  return suf || ',';
}

/** Longest common suffix without normalizing (preserves leading space for correct arm trim). */
function longestCommonSuffixRaw(exprs: string[]): string {
  if (exprs.length === 0) return ',';
  let suf = exprs[0];
  for (let i = 1; i < exprs.length; i++) {
    const b = exprs[i];
    let j = suf.length - 1;
    let k = b.length - 1;
    while (j >= 0 && k >= 0 && suf[j] === b[k]) {
      j--;
      k--;
    }
    suf = suf.slice(j + 1);
  }
  return suf || ',';
}

/** Trim suffix from end of expression (for partial factor arms). */
function trimSuffix(expr: string, suffix: string): string {
  if (!suffix || !expr.endsWith(suffix)) return expr;
  const t = expr.slice(0, expr.length - suffix.length).trimEnd();
  return t || ',';
}

/**
 * Find \Brs{arm1}{arm2} in s. Returns indices so slice(0,start) is before first '{', slice(end) is after second '}'.
 * Handles nested braces.
 */
function findBrsArms(s: string): { start: number; end: number; arm1: string; arm2: string } | null {
  const brs = s.indexOf('\\Brs');
  if (brs === -1) return null;
  const firstBrace = s.indexOf('{', brs);
  if (firstBrace === -1) return null;
  let depth = 1;
  let pos = firstBrace + 1;
  while (pos < s.length && depth > 0) {
    if (s[pos] === '{') depth++;
    else if (s[pos] === '}') depth--;
    pos++;
  }
  const arm1End = pos - 1;
  const arm1 = s.slice(firstBrace + 1, arm1End);
  const secondBrace = s.indexOf('{', pos);
  if (secondBrace === -1) return null;
  depth = 1;
  pos = secondBrace + 1;
  while (pos < s.length && depth > 0) {
    if (s[pos] === '{') depth++;
    else if (s[pos] === '}') depth--;
    pos++;
  }
  const arm2End = pos - 1;
  const arm2 = s.slice(secondBrace + 1, arm2End);
  return { start: firstBrace, end: arm2End + 1, arm1, arm2 };
}

/**
 * For each pattern node with op \Tc, the operand maps to the expression (one or more ops including branch)
 * at the matched target node. Augment operandMapping with these Tc operand -> expression entries.
 * Empty target arms (e.g. tail node) map to ',' (empty operation).
 * When the same \Tc operand appears in multiple arms with different expressions (partial factor),
 * use the longest common suffix for the single value; return the per-arm expressions for building
 * the replacement with trimmed arms.
 */
function resolveTcOperandMapping(
  patternDAG: DAGStructure<ExprNodeData>,
  targetDAG: DAGStructure<ExprNodeData>,
  nodeMapping: Map<string, string>,
  operandMapping: Map<string, string>
): { mapping: Map<string, string>; partialFactorOperands: Set<string>; tcExpressionsByOperand: Map<string, string[]> } {
  const result = new Map(operandMapping);
  const pNodeMap = new Map(patternDAG.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const tcExpressions = new Map<string, Array<{ armType: number; expr: string }>>();
  const patternTailId = patternDAG.nodes.find((n) => (n.data as ExprNodeData)?.op?.endsWith?.(':tail'))?.id;
  const tailIncomingByFrom = new Map<string, number>();
  if (patternTailId) {
    for (const e of patternDAG.edges) {
      if (e.to === patternTailId) tailIncomingByFrom.set(e.from, (e.edgeType ?? 0) as number);
    }
  }
  const targetTailId = patternTailId ? nodeMapping.get(patternTailId) ?? null : null;
  let condId: string | null = null;
  if (targetTailId) {
    for (const e of patternDAG.edges) {
      if (e.to === patternTailId && ((e.edgeType ?? 0) as number) === 3) {
        const armHead = nodeMapping.get(e.from);
        if (armHead) {
          for (const te of targetDAG.edges) {
            if (te.to === armHead && ((te.edgeType ?? 0) as number) === 1) {
              condId = te.from;
              break;
            }
          }
          break;
        }
      }
    }
  }
  const excludeForArm = new Set<string>();
  if (targetTailId) excludeForArm.add(targetTailId);
  if (condId) excludeForArm.add(condId);

  for (const [pId, tId] of nodeMapping) {
    const pNode = pNodeMap.get(pId);
    const pData = pNode?.data as ExprNodeData | undefined;
    if (pData?.op !== '\\Tc' || !pData.operands?.length) continue;
    const tcOperand = pData.operands[0];
    const armType = tailIncomingByFrom.get(pId) ?? 0;
    const tNode = tNodeMap.get(tId);
    const tData = tNode?.data as ExprNodeData | undefined;
    if (tData?.op?.endsWith?.(':tail')) {
      if (!tcExpressions.has(tcOperand)) tcExpressions.set(tcOperand, []);
      tcExpressions.get(tcOperand)!.push({ armType, expr: ',' });
      continue;
    }
    const useIncoming = excludeForArm.size >= 1;
    const subgraph = useIncoming
      ? extractSubgraphIncomingFromNode(targetDAG, tId, excludeForArm)
      : extractSubgraphFromNode(targetDAG, tId);
    if (subgraph.nodes.length === 0) continue;
    const expr = dagToExpr(subgraph);
    const trimmed = expr.replace(/^,\s*|\s*,$/g, '').trim();
    const wrapped = trimmed ? `, ${trimmed},` : ',';
    if (!tcExpressions.has(tcOperand)) tcExpressions.set(tcOperand, []);
    tcExpressions.get(tcOperand)!.push({ armType, expr: wrapped });
  }
  const partialFactorOperands = new Set<string>();
  const tcExpressionsByOperand = new Map<string, string[]>();
  for (const [tcOperand, pairs] of tcExpressions) {
    const exprs = pairs.sort((a, b) => a.armType - b.armType).map((p) => p.expr);
    const value = exprs.length === 1 ? exprs[0]! : longestCommonSuffixRaw(exprs);
    result.set(tcOperand, value);
    if (exprs.length > 1) {
      partialFactorOperands.add(tcOperand);
      tcExpressionsByOperand.set(tcOperand, exprs);
    }
  }
  return { mapping: result, partialFactorOperands, tcExpressionsByOperand };
}

/**
 * Expand \Tc placeholders in ruleOtherSide with resolved expressions (operation sequences) before converting to DAG.
 * Replaces every \Tc <operand> with the mapped operation(s) so Tc operands are always mapped to the sequence.
 * Handles both comma context (,\Tc c,) and branch-arm context ({\Tc c,).
 */
function expandTcInRuleSide(ruleOtherSide: string, tcMapping: Map<string, string>, patternDAG: DAGStructure<ExprNodeData>): string {
  let expanded = normalizeSpacing(ruleOtherSide);
  // Replace Tc operands in reverse order of length so c_10 before c_1
  const tcOperands = [...patternDAG.nodes]
    .filter((n) => (n.data as ExprNodeData)?.op === '\\Tc' && (n.data as ExprNodeData)?.operands?.length)
    .map((n) => (n.data as ExprNodeData).operands![0])
    .filter((op) => tcMapping.has(op))
    .sort((a, b) => b.length - a.length);
  for (const op of tcOperands) {
    const value = tcMapping.get(op)!;
    const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Comma context: ",\Tc c," or " ,\Tc c,"
    expanded = expanded.replace(new RegExp(`\\s*,\\s*\\\\Tc\\s+${escapedOp}\\s*,`, 'g'), value);
    // Branch-arm context: "{\Tc c," inside \Brs{...}{...} or \Bb{...}{...}{...}
    expanded = expanded.replace(new RegExp(`{\\s*\\\\Tc\\s+${escapedOp}\\s*,`, 'g'), '{' + value);
  }
  return expanded;
}

/**
 * Find substitution match in target expression using DAG injection.
 * Rule applicability after operand normalization is equivalent to DAG injection:
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

  // DAG injection: single pass on full target. Rule DAG uses original operands (i, m, j).
  const patternDAG = exprToDAG(normalizedRule);
  let targetDAG = exprToDAG(normalizedTarget);
  const hasTc = patternDAG.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  if (hasTc && patternDAG.nodes.length > targetDAG.nodes.length) {
    targetDAG = augmentTargetDAGForTcMatching(targetDAG) as DAGStructure<ExprNodeData>;
  }
  if (patternDAG.nodes.length === 0 || patternDAG.nodes.length > targetDAG.nodes.length) {
    return { match: false };
  }

  let result: { mapping: Map<string, string>; operandMapping: Map<string, string> } | null = null;
  for (const r of SingleRootDAGInjection(patternDAG, targetDAG)) {
    result = r;
    break;
  }
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
      description: `Rule found (DAG injection) in ${side} side`,
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
function getCachedOrCreateDAG(
  expr: string,
  cache?: Map<string, DAGStructure<ExprNodeData>>
): DAGStructure<ExprNodeData> {
  const normalized = normalizeSpacing(expr);
  const cached = cache?.get(normalized);
  if (cached) return cached;
  const dag = exprToDAG(normalized) as DAGStructure<ExprNodeData>;
  if (cache) cache.set(normalized, dag);
  return dag;
}

export const trySubstitution = (
  target: string,
  ruleSide: string,
  otherRuleSide: string,
  expectedResult: string,
  targetSideForOperands: string,
  side: 'left' | 'right',
  stepCounter?: { count: number },
  dagCache?: Map<string, DAGStructure<ExprNodeData>>
) => {
  const normalizedTarget = normalizeSpacing(target);
  const normalizedRule = normalizeSpacing(ruleSide);
  const normalizedOther = normalizeSpacing(otherRuleSide);
  const normalizedExpectedForOePe = normalizeSpacing(expectedResult);
  const targetOrExpectedHasPe = normalizedTarget.includes('\\Pe') || normalizedExpectedForOePe.includes('\\Pe');
  const ruleHasOe = normalizedRule.includes('\\Oe') || normalizedOther.includes('\\Oe');

  // When target or expected has \Pe and either side of the rule has \Oe, use the \Pe variant for replacement so result matches expected
  let effectiveRuleSide = ruleSide;
  let effectiveOtherRuleSide = otherRuleSide;
  if (targetOrExpectedHasPe && ruleHasOe) {
    effectiveRuleSide = oeToPeInExpression(ruleSide);
    effectiveOtherRuleSide = oeToPeInExpression(otherRuleSide);
  }

  // For matching: look for the pattern as it appears in the target. If target has \Oe use ruleSide (unconverted).
  const patternForMatch =
    targetOrExpectedHasPe && ruleHasOe && normalizedTarget.includes('\\Oe') ? ruleSide : effectiveRuleSide;
  const patternDAG = getCachedOrCreateDAG(patternForMatch, dagCache);
  let targetDAG = getCachedOrCreateDAG(target, dagCache);
  const hasTc = patternDAG.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  if (hasTc && patternDAG.nodes.length > targetDAG.nodes.length) {
    targetDAG = augmentTargetDAGForTcMatching(targetDAG) as DAGStructure<ExprNodeData>;
  }

  // Normalize expected for comparison (roundtrip through parser strips if(...) from conditions)
  let normalizedExpected = normalizeSpacing(expectedResult);
  try {
    normalizedExpected = normalizeSpacing(dagToExpr(getCachedOrCreateDAG(expectedResult, dagCache)));
  } catch {
    // keep original if roundtrip fails
  }

  if (patternDAG.nodes.length > targetDAG.nodes.length) {
    return null;
  }

  // Empty pattern (e.g. rule left ","): try insertion at each top-level comma boundary.
  // Skip this path when the other side contains \+ or \times (3-operand form); matching must go through DAG injection so the target actually has that structure.
  const otherDAG = getCachedOrCreateDAG(effectiveOtherRuleSide, dagCache);
  const otherHasSpecialOp = otherDAG.nodes.some((n) => {
    const op = (n.data as ExprNodeData)?.op ?? '';
    return op === '\\+' || op === '\\times';
  });
  if (patternDAG.nodes.length === 0 && !otherHasSpecialOp) {
    const boundaries = getCommaBoundaries(normalizedTarget);
    for (let i = 0; i < boundaries.length; i++) {
      const b = boundaries[i];
      const prefix = normalizedTarget.substring(0, b);
      const suffix = normalizedTarget.substring(b);
      const converted = convertRuleOtherSide(
        effectiveOtherRuleSide,
        new Map(),
        prefix,
        suffix,
        targetSideForOperands,
        normalizedExpected
      );
      const convertedForSub = converted.trim() === ',' ? '' : converted;
      let result = prefix + convertedForSub + suffix;
      // When converted used fallback mapping (e.g. 1,2), try raw insert of effectiveOtherRuleSide so Oe→Pe insert can match
      if (normalizeSpacing(result) !== normalizedExpected) {
        let toInsert = effectiveOtherRuleSide.trim() === ',' ? '' : effectiveOtherRuleSide;
        // Avoid double comma: if prefix ends with comma and toInsert starts with comma, drop leading ", " from toInsert
        if (prefix.endsWith(',') && /^,\s*/.test(toInsert)) toInsert = toInsert.replace(/^,\s*/, '');
        const rawInsert = prefix + toInsert + suffix;
        if (normalizeSpacing(rawInsert) === normalizedExpected) result = rawInsert;
      }
      if (normalizeSpacing(result) === normalizedExpected) {
        return {
          match: true,
          reconstructedExpr: ensureCommaWrapped(result),
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

  // Pre-filter: pattern (op, count) multiset must be contained in target (no match possible otherwise)
  if (!patternOpMultisetContainedInTarget(patternDAG, targetDAG)) {
    return null;
  }

  // DAG-based: try each match candidate until one produces the expected result
  const patternHasTc = patternDAG.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  const nodeCount = targetDAG.nodes.length;
  const maxTrials =
    nodeCount > 24 ? 4 : nodeCount > 20 ? 8 : nodeCount > 12 ? 32 : 64;
  let trialCount = 0;
  for (const vf2Result of SingleRootDAGInjection(patternDAG, targetDAG)) {
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
    if (!operandMapping && !patternHasTc) continue;

    try {
      // Pass raw expectedResult so resolveOperandMapping gets correct existingOperands (e.g. "j") and compares to raw expected
      const substituted = convertRuleOtherSideWithDAG(
        effectiveOtherRuleSide,
        operandMapping,
        targetDAG,
        patternDAG,
        vf2Result.mapping,
        targetSideForOperands,
        expectedResult
      );
      const normalizedSubst = normalizeSpacing(substituted);
      const expectedNorm = normalizeUnaryOpOrderForComparison(normalizeSpacing(expectedResult));
      const normSubst = normalizeUnaryOpOrderForComparison(normalizedSubst);
      const normExpected = normalizeUnaryOpOrderForComparison(normalizedExpected);
      const stripTrailingComma = (s: string) => (s.endsWith(',') ? s.slice(0, -1) : s);
      let matchesRoundtrip = normSubst === normExpected;
      if (!matchesRoundtrip) {
        try {
          const canonicalSubst = normalizeSpacing(
            dagToExpr(getCachedOrCreateDAG(substituted, dagCache), undefined, { literalTc: true })
          );
          matchesRoundtrip = normalizeUnaryOpOrderForComparison(canonicalSubst) === normExpected;
        } catch {
          // ignore
        }
      }
      if (!matchesRoundtrip && stripTrailingComma(normSubst) === stripTrailingComma(normExpected)) {
        matchesRoundtrip = true;
      }
      const matchesRaw = normSubst === expectedNorm || stripTrailingComma(normSubst) === stripTrailingComma(expectedNorm);
      if (matchesRoundtrip || matchesRaw) {
        return {
          match: true,
          reconstructedExpr: ensureCommaWrapped(substituted),
          position: {
            side,
            position: candidateStart,
            description: `Rule found (DAG injection) in ${side} side`,
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
      if (typeof process !== 'undefined' && process.env.DEBUG_SUBSTITUTION === '1') {
        console.error('[trySubstitution] substituted !== expected');
        console.error('  substituted (normalized):', JSON.stringify(normalizedSubst));
        console.error('  expected (normalized):    ', JSON.stringify(normalizedExpected));
      }
    } catch (e) {
      if (typeof process !== 'undefined' && process.env.DEBUG_SUBSTITUTION === '1') {
        console.error('[trySubstitution] convertRuleOtherSideWithDAG threw:', e);
      }
      continue;
    }
  }

  return null;
};
