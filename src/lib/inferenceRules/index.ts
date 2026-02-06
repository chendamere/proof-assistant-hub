/**
 * Main entry point for inference rules
 * 
 * This module contains the inference rules used for proof verification.
 * These rules determine if a target rule can be proven using existing rules.
 */

import { checkGrammar } from '../grammarChecker';
import { MatchPosition, InferenceRule } from './types';
import { InferenceRules } from './rules';

// Re-export types and interfaces
export type { MatchPosition, InferenceRule } from './types';

// Re-export rules
export { InferenceRules } from './rules';

// Re-export subexpression generation
export { generateSubexpressions } from './subexpressions';

// Re-export branch tree formatting for terminal display
export { formatBranchTree, logBranchTree } from './branchTreeFormat';

export interface CheckInferenceRulesOptions {
  onProgress?: (info: { inferenceRule: string; matched: boolean; vf2Steps?: number }) => void;
}

/**
 * Check if a rule matches the target using inference rules.
 * Operand mapping is handled by VF2 during substitution; no pre-normalization to integers needed.
 *
 * @param targetLeft - Target left expression
 * @param targetRight - Target right expression
 * @param ruleLeft - Rule left expression
 * @param ruleRight - Rule right expression
 * @param options - Optional { onProgress } for debug logging (rule name, matched, VF2 steps)
 */
export const checkInferenceRules = (
  targetLeft: string,
  targetRight: string,
  ruleLeft: string,
  ruleRight: string,
  options?: CheckInferenceRulesOptions
): { match: boolean; inferenceRule?: string; matchPosition?: MatchPosition; grammarError?: string } => {

  const stepCounter = options?.onProgress ? { count: 0 } : undefined;
  const context = stepCounter ? { stepCounter } : undefined;

  for (const infRule of InferenceRules) {
    if (stepCounter) stepCounter.count = 0;
    const result = infRule.check(targetLeft, targetRight, ruleLeft, ruleRight, context);
    options?.onProgress?.({
      inferenceRule: infRule.name,
      matched: result.match,
      vf2Steps: infRule.name === 'Equivalent Substitution' ? stepCounter?.count : undefined,
    });
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
