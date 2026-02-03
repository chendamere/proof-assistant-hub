/**
 * Inference Rules for proof verification
 * 
 * These rules determine how a target rule can be proven using existing rules:
 * 1. Equivalent Commutativity: A ⟺ B implies B ⟺ A
 * 2. Equivalent Transitivity: A ⟺ B and B ⟺ C implies A ⟺ C
 * 3. Equivalent Substitution: A ⟺ B allows replacing A with B in any context M·A·N → M·B·N
 */

import { InferenceRule } from './types';
import { trySubstitution } from './substitution';

export const InferenceRules: InferenceRule[] = [
  // {
  //   name: 'Equivalent Commutativity',
  //   description: 'A ⟺ B implies B ⟺ A - Exact match (reversed)',
  //   check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
  //     // Check if target matches rule in reverse
  //     if (targetLeft === ruleRight && targetRight === ruleLeft) {
  //       return {
  //         match: true,
  //         position: {
  //           side: 'both',
  //           description: 'Both sides match in reverse order'
  //         }
  //       };
  //     }
  //     return { match: false };
  //   },
  // },
  // {
  //   name: 'Equivalent Transitivity',
  //   description: 'A ⟺ B and B ⟺ C implies A ⟺ C - Chain through common side',
  //   check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
  //     // If target left matches rule left, check if target right matches rule right exactly
  //     if (targetLeft === ruleLeft) {
  //       if (targetRight === ruleRight) {
  //         return {
  //           match: true,
  //           position: {
  //             side: 'both',
  //             description: 'Left sides match, right sides match exactly'
  //           }
  //         };
  //       }
  //     }
  //     // If target left matches rule right, check if target right matches rule left exactly
  //     if (targetLeft === ruleRight) {
  //       if (targetRight === ruleLeft) {
  //         return {
  //           match: true,
  //           position: {
  //             side: 'both',
  //             description: 'Target left matches rule right, target right matches rule left exactly'
  //           }
  //         };
  //       }
  //     }
  //     // If target right matches rule left, check if target left matches rule right exactly
  //     if (targetRight === ruleLeft) {
  //       if (targetLeft === ruleRight) {
  //         return {
  //           match: true,
  //           position: {
  //             side: 'both',
  //             description: 'Target right matches rule left, target left matches rule right exactly'
  //           }
  //         };
  //       }
  //     }
  //     // If target right matches rule right, check if target left matches rule left exactly
  //     if (targetRight === ruleRight) {
  //       if (targetLeft === ruleLeft) {
  //         return {
  //           match: true,
  //           position: {
  //             side: 'both',
  //             description: 'Right sides match, left sides match exactly'
  //           }
  //         };
  //       }
  //     }
  //     return { match: false };
  //   },
  // },
  {
    name: 'Equivalent Substitution',
    description: 'A ⟺ B allows inserting A with B in any context M·A·N ⟺ M·B·N',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Strategy: Operand-Aligned Pattern Matching with Pattern Recognition
      // Extract operand patterns and match patterns rather than exact numbers to handle
      // separately normalized expressions
      
      // Check both sides for substitution
      // Note: targetLeft, targetRight, ruleLeft, ruleRight are already integer expressions
      
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
