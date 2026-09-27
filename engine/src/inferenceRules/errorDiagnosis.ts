/**
 * Error diagnosis for failed proof transitions.
 * Analyzes why a transition verification failed and provides helpful insights.
 */

import type { DAGStructure } from '../dag';
import type { ExprNodeData } from '../dag/types';
import { exprToDAG, countOperations, extractOperators } from '../dag';
import { normalizeSpacing } from './utils';
import type { RuleIndex } from './ruleIndex';

export interface TransitionCharacteristics {
  /** Operation count delta (right - left) */
  delta: number;
  /** Operators in left side */
  operatorsLeft: Set<string>;
  /** Operators in right side */
  operatorsRight: Set<string>;
  /** All operators in transition */
  operatorsAll: Set<string>;
  /** Has branches? */
  hasBranches: boolean;
  /** Left side operation count */
  opCountLeft: number;
  /** Right side operation count */
  opCountRight: number;
}

export interface RuleAttemptInfo {
  ruleId: string;
  ruleLeft: string;
  ruleRight: string;
  /** Why this rule was considered */
  reason: string;
  /** Why it didn't match */
  failureReason?: string;
}

export interface DiagnosisResult {
  /** Transition characteristics */
  characteristics: TransitionCharacteristics;
  /** Rules that were tried */
  rulesTried: RuleAttemptInfo[];
  /** Total rules tried */
  totalRulesTried: number;
  /** Rules filtered out before trying */
  rulesFiltered: number;
  /** Possible reasons for failure */
  possibleReasons: string[];
  /** Suggestions for fixing */
  suggestions: string[];
  /** Rules with similar characteristics that might work */
  similarRules?: Array<{ ruleId: string; similarity: number; reason: string }>;
  /** LLM-based diagnosis (hidden for now; type kept for compatibility) */
  llmDiagnosis?: {
    explanation: string;
    analysis?: string;
    suggestions: string[];
    rootCauses: string[];
    success: boolean;
    error?: string;
    provider?: string;
  };
}

/**
 * Analyze transition characteristics
 */
export function analyzeTransition(
  targetLeft: string,
  targetRight: string
): TransitionCharacteristics | null {
  try {
    const leftDAG = exprToDAG(normalizeSpacing(targetLeft));
    const rightDAG = exprToDAG(normalizeSpacing(targetRight));
    const opLeft = countOperations(leftDAG);
    const opRight = countOperations(rightDAG);
    const delta = opRight - opLeft;

    const opsLeft = extractOperators(leftDAG);
    const opsRight = extractOperators(rightDAG);
    const opsAll = new Set<string>([...opsLeft, ...opsRight]);

    const hasBranches =
      /\\B[lr]?b/.test(targetLeft) || /\\B[lr]?b/.test(targetRight);

    return {
      delta,
      operatorsLeft: opsLeft,
      operatorsRight: opsRight,
      operatorsAll: opsAll,
      hasBranches,
      opCountLeft: opLeft,
      opCountRight: opRight,
    };
  } catch (e) {
    console.warn('Failed to analyze transition:', e);
    return null;
  }
}

/**
 * Diagnose why a transition verification failed
 */
export function diagnoseFailure(
  targetLeft: string,
  targetRight: string,
  rulesTried: Array<{ ruleId: string; matched: boolean; matchTime: number }>,
  allRules: Array<{ id: string; leftSide: string; rightSide: string }>,
  ruleIndex: RuleIndex
): DiagnosisResult {
  const characteristics = analyzeTransition(targetLeft, targetRight);
  const possibleReasons: string[] = [];
  const suggestions: string[] = [];

  if (!characteristics) {
    return {
      characteristics: {
        delta: 0,
        operatorsLeft: new Set(),
        operatorsRight: new Set(),
        operatorsAll: new Set(),
        hasBranches: false,
        opCountLeft: 0,
        opCountRight: 0,
      },
      rulesTried: [],
      totalRulesTried: rulesTried.length,
      rulesFiltered: 0,
      possibleReasons: ['Failed to parse transition expressions'],
      suggestions: ['Check expression syntax'],
    };
  }

  // Analyze rules tried
  const ruleAttempts: RuleAttemptInfo[] = rulesTried.map((attempt) => {
    const rule = allRules.find((r) => r.id === attempt.ruleId);
    if (!rule) {
      return {
        ruleId: attempt.ruleId,
        ruleLeft: '',
        ruleRight: '',
        reason: 'Unknown rule',
      };
    }

    // Determine why rule was considered
    let reason = 'Matched filter criteria';
    const ruleOps = ruleIndex.ruleOpSets.get(rule.id);
    if (ruleOps) {
      const overlap = [...characteristics.operatorsAll].filter((op) =>
        ruleOps.has(op)
      ).length;
      if (overlap > 0) {
        reason = `Operator overlap (${overlap} operators)`;
      }
    }

    // Determine why it failed
    let failureReason: string | undefined;
    try {
      const ruleLeftDAG = exprToDAG(normalizeSpacing(rule.leftSide));
      const ruleRightDAG = exprToDAG(normalizeSpacing(rule.rightSide));
      const ruleOpLeft = countOperations(ruleLeftDAG);
      const ruleOpRight = countOperations(ruleRightDAG);
      const ruleDelta = ruleOpRight - ruleOpLeft;

      if (ruleDelta !== characteristics.delta && ruleDelta !== -characteristics.delta) {
        failureReason = `Delta mismatch (rule: ${ruleDelta}, target: ${characteristics.delta})`;
      } else if (ruleOps && characteristics.operatorsAll.size > 0) {
        const missingOps = [...ruleOps].filter(
          (op) => !characteristics.operatorsAll.has(op)
        );
        if (missingOps.length > 0) {
          failureReason = `Missing operators in target: ${missingOps.slice(0, 3).join(', ')}`;
        }
      }
    } catch (e) {
      failureReason = 'Failed to analyze rule';
    }

    return {
      ruleId: attempt.ruleId,
      ruleLeft: rule.leftSide,
      ruleRight: rule.rightSide,
      reason,
      failureReason,
    };
  });

  // Generate possible reasons
  if (rulesTried.length === 0) {
    possibleReasons.push('No rules matched the filter criteria');
    suggestions.push('Check if transition operators match any rule operators');
  } else {
    possibleReasons.push(
      `Tried ${rulesTried.length} rule(s) but none matched`
    );

    // Check delta mismatch
    const deltaMismatches = ruleAttempts.filter(
      (r) => r.failureReason?.includes('Delta mismatch')
    ).length;
    if (deltaMismatches > 0) {
      possibleReasons.push(
        `${deltaMismatches} rule(s) had delta mismatch`
      );
      suggestions.push(
        `Look for rules with delta = ${characteristics.delta} or ${-characteristics.delta}`
      );
    }

    // Check operator mismatches
    const operatorMismatches = ruleAttempts.filter((r) =>
      r.failureReason?.includes('Missing operators')
    ).length;
    if (operatorMismatches > 0) {
      possibleReasons.push(
        `${operatorMismatches} rule(s) required operators not present in target`
      );
      suggestions.push(
        'Ensure target contains all operators required by matching rules'
      );
    }

    // Check if transition is complex
    if (characteristics.hasBranches) {
      possibleReasons.push('Transition involves branches');
      suggestions.push(
        'Branch matching may require specific structure alignment'
      );
    }

    if (characteristics.opCountLeft === 0 || characteristics.opCountRight === 0) {
      possibleReasons.push('One side is empty');
      suggestions.push('Check if empty side handling is correct');
    }
  }

  // Find similar rules that weren't tried
  const similarRules: Array<{
    ruleId: string;
    similarity: number;
    reason: string;
  }> = [];
  for (const rule of allRules) {
    if (rulesTried.some((r) => r.ruleId === rule.id)) continue;

    try {
      const ruleLeftDAG = exprToDAG(normalizeSpacing(rule.leftSide));
      const ruleRightDAG = exprToDAG(normalizeSpacing(rule.rightSide));
      const ruleOpLeft = countOperations(ruleLeftDAG);
      const ruleOpRight = countOperations(ruleRightDAG);
      const ruleDelta = ruleOpRight - ruleOpLeft;

      const ruleOps = ruleIndex.ruleOpSets.get(rule.id);
      let similarity = 0;

      // Delta similarity
      if (ruleDelta === characteristics.delta || ruleDelta === -characteristics.delta) {
        similarity += 0.4;
      }

      // Operator overlap
      if (ruleOps) {
        const overlap = [...characteristics.operatorsAll].filter((op) =>
          ruleOps.has(op)
        ).length;
        const union = new Set([
          ...characteristics.operatorsAll,
          ...ruleOps,
        ]).size;
        if (union > 0) {
          similarity += 0.3 * (overlap / union);
        }
      }

      // Pattern size similarity
      const rulePatternSize = Math.min(ruleOpLeft, ruleOpRight);
      const targetPatternSize = Math.min(
        characteristics.opCountLeft,
        characteristics.opCountRight
      );
      if (targetPatternSize > 0) {
        const sizeRatio = Math.min(rulePatternSize, targetPatternSize) /
          Math.max(rulePatternSize, targetPatternSize);
        similarity += 0.3 * sizeRatio;
      }

      if (similarity > 0.3) {
        let reason = '';
        if (ruleDelta === characteristics.delta || ruleDelta === -characteristics.delta) {
          reason = 'Same delta';
        } else if (ruleOps) {
          const overlap = [...characteristics.operatorsAll].filter((op) =>
            ruleOps.has(op)
          ).length;
          if (overlap > 0) {
            reason = `${overlap} operator(s) overlap`;
          }
        }

        similarRules.push({
          ruleId: rule.id,
          similarity,
          reason: reason || 'Similar characteristics',
        });
      }
    } catch (e) {
      // Skip rules that can't be analyzed
    }
  }

  similarRules.sort((a, b) => b.similarity - a.similarity);
  const topSimilar = similarRules.slice(0, 5);

  // Estimate how many rules were filtered
  const totalRules = allRules.length;
  const rulesFiltered = Math.max(0, totalRules - rulesTried.length);

  return {
    characteristics,
    rulesTried: ruleAttempts,
    totalRulesTried: rulesTried.length,
    rulesFiltered,
    possibleReasons,
    suggestions,
    similarRules: topSimilar.length > 0 ? topSimilar : undefined,
  };
}
