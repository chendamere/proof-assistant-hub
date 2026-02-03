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

/**
 * Check if a rule matches the target using inference rules.
 * Operand mapping is handled by VF2 during substitution; no pre-normalization to integers needed.
 *
 * @param targetLeft - Target left expression
 * @param targetRight - Target right expression
 * @param ruleLeft - Rule left expression
 * @param ruleRight - Rule right expression
 */
export const checkInferenceRules = (
  targetLeft: string,
  targetRight: string,
  ruleLeft: string,
  ruleRight: string
): { match: boolean; inferenceRule?: string; matchPosition?: MatchPosition; grammarError?: string } => {
  const targetLeftGrammar = checkGrammar(targetLeft);
  if (!targetLeftGrammar.isValid) {
    const errors = targetLeftGrammar.errors.map(e => e.message).join('; ');
    return {
      match: false,
      grammarError: `Target left side has grammar errors: ${errors}`
    };
  }

  const targetRightGrammar = checkGrammar(targetRight);
  if (!targetRightGrammar.isValid) {
    const errors = targetRightGrammar.errors.map(e => e.message).join('; ');
    return {
      match: false,
      grammarError: `Target right side has grammar errors: ${errors}`
    };
  }

  if (targetLeft === ruleLeft && targetRight === ruleRight) {
    return {
      match: true,
      inferenceRule: 'Exact Match',
      matchPosition: {
        side: 'both',
        description: 'Both sides match exactly'
      }
    };
  }

  for (const infRule of InferenceRules) {
    const result = infRule.check(targetLeft, targetRight, ruleLeft, ruleRight);
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
