/**
 * Grammar checker stub - provides interface for pages that depend on it.
 * Full grammar validation logic was removed; returns valid for all expressions.
 */

export interface GrammarError {
  position: number;
  operand: string;
  message: string;
}

export interface GrammarCheckResult {
  isValid: boolean;
  errors: GrammarError[];
  instantiatedOperands: Set<string>;
}

export function checkGrammar(_expr: string): GrammarCheckResult {
  return {
    isValid: true,
    errors: [],
    instantiatedOperands: new Set(),
  };
}
