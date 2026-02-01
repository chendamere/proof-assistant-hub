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
