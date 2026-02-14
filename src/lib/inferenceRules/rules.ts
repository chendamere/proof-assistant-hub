/**
 * Inference Rules for proof verification
 * 
 * These rules determine how a target rule can be proven using existing rules:
 * 1. Equivalent Commutativity: A ⟺ B implies B ⟺ A
 * 2. Equivalent Transitivity: A ⟺ B and B ⟺ C implies A ⟺ C
 * 3. Equivalent Substitution: A ⟺ B allows replacing A with B in any context M·A·N → M·B·N
 */

import { InferenceRule } from './types';
import { trySubstitution, trySubstitutionByMatchPairs } from './substitution';
import { normalizeSpacing } from './utils';
import { normalizeRule as normalizeRuleOperands } from '../operandNormalizer';

export const InferenceRules: InferenceRule[] = [
  {
    name: 'Equivalent Commutativity',
    description: 'A ⟺ B implies B ⟺ A - Exact match (reversed)',
    check: (targetLeft, targetRight, ruleLeft, ruleRight, _context) => {
      const targetNorm = normalizeRuleOperands(targetLeft, targetRight);
      const ruleNorm = normalizeRuleOperands(ruleLeft, ruleRight);
      const tL = normalizeSpacing(targetNorm.left.integerExpression);
      const tR = normalizeSpacing(targetNorm.right.integerExpression);
      const rL = normalizeSpacing(ruleNorm.left.integerExpression);
      const rR = normalizeSpacing(ruleNorm.right.integerExpression);
      // Check if target matches rule in reverse
      if (tL === rR && tR === rL) {
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
    check: (targetLeft, targetRight, ruleLeft, ruleRight, _context) => {
      const targetNorm = normalizeRuleOperands(targetLeft, targetRight);
      const ruleNorm = normalizeRuleOperands(ruleLeft, ruleRight);
      const tL = normalizeSpacing(targetNorm.left.integerExpression);
      const tR = normalizeSpacing(targetNorm.right.integerExpression);
      const rL = normalizeSpacing(ruleNorm.left.integerExpression);
      const rR = normalizeSpacing(ruleNorm.right.integerExpression);
      // If target left matches rule left, check if target right matches rule right exactly
      if (tL === rL) {
        if (tR === rR) {
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
      if (tL === rR) {
        if (tR === rL) {
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
      if (tR === rL) {
        if (tL === rR) {
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
      if (tR === rR) {
        if (tL === rL) {
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
    description: 'A ⟺ B allows inserting A with B in any context M·A·N ⟺ M·B·N',
    check: (targetLeft, targetRight, ruleLeft, ruleRight, context) => {
      const stepCounter = context?.stepCounter;
      const dagCache = context?.dagCache;

      // Alternative: injection-only match pairs. If complementary directions match (e.g. ruleLeft in targetLeft
      // AND ruleRight in targetRight), reconstruction exists—skip expensive construction.
      const matchPairsResult = trySubstitutionByMatchPairs(targetLeft, targetRight, ruleLeft, ruleRight, stepCounter);
      if (matchPairsResult?.match) return matchPairsResult;

      // Fallback: try all 4 substitution directions with full construction
      // let result = trySubstitution(targetLeft, ruleLeft, ruleRight, targetRight, targetLeft, 'left', stepCounter, dagCache);
      // if (result) return result;

      // result = trySubstitution(targetLeft, ruleRight, ruleLeft, targetRight, targetLeft, 'left', stepCounter, dagCache);
      // if (result) return result;

      // result = trySubstitution(targetRight, ruleLeft, ruleRight, targetLeft, ruleRight, 'right', stepCounter, dagCache);
      // if (result) return result;

      // result = trySubstitution(targetRight, ruleRight, ruleLeft, targetLeft, ruleRight, 'right', stepCounter, dagCache);
      // if (result) return result;

      return { match: false };
    },
  },
];
