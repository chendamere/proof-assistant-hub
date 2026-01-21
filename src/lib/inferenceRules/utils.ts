/**
 * Utility functions for inference rules
 */

/**
 * Normalize spacing in expressions to handle spacing variations
 * Handles cases like ", 3 \Oc 4," vs ",3 \Oc 4," or ",3 \Oc 4, 1 \Od 2," vs ",3 \Oc 4,1 \Od 2,"
 * The main issue is spacing around commas - we normalize to remove spaces around commas
 */
export const normalizeSpacing = (expr: string): string => {
  if (!expr) return expr;
  return expr
    // Normalize all whitespace sequences (tabs, multiple spaces, newlines, etc.) to single spaces
    .replace(/\s+/g, ' ')
    // Remove space before comma (handles ", 3" -> ",3" and " ,3" -> ",3")
    .replace(/\s+,/g, ',')
    // Remove space after comma (handles ", 3" -> ",3" and ", 3 " -> ",3")
    .replace(/,\s+/g, ',')
    // Remove leading/trailing spaces
    .trim();
};

/**
 * Extract operand tokens and their positions from expressions
 * Operands can be either digits (e.g., "1", "22") or single letters (e.g., "i", "j", "m")
 */
export const extractOperandTokens = (expr: string): Array<{ token: string; index: number; endIndex: number }> => {
  const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
  // Match either digits or single letters as operands
  // Pattern: \b(\d+|[a-z])\b matches word boundaries around digits or single lowercase letters
  const operandPattern = /\b(\d+|[a-z])\b/g;
  let match;
  while ((match = operandPattern.exec(expr)) !== null) {
    tokens.push({
      token: match[1],
      index: match.index,
      endIndex: match.index + match[1].length
    });
  }
  return tokens;
};

/**
 * Extract operand pattern: convert numbers to pattern variables (A, B, C, ...)
 */
export const extractOperandPattern = (
  expr: string, 
  tokens: Array<{ token: string; index: number; endIndex: number }>
): { pattern: string; operandToVar: Map<string, string> } => {
  const patternVars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const operandToVar = new Map<string, string>();
  let patternVarIdx = 0;
  
  tokens.forEach(token => {
    if (!operandToVar.has(token.token)) {
      operandToVar.set(token.token, patternVars[patternVarIdx++]);
    }
  });
  
  let pattern = expr;
  const sortedTokens = [...tokens].sort((a, b) => b.index - a.index);
  sortedTokens.forEach(token => {
    const patternVar = operandToVar.get(token.token)!;
    pattern = pattern.substring(0, token.index) + patternVar + pattern.substring(token.endIndex);
  });
  
  return { pattern, operandToVar };
};

/**
 * Build operand mapping from ruleSide to candidate based on pattern matching
 */
export const buildOperandMapping = (
  ruleTokens: Array<{ token: string; index: number; endIndex: number }>,
  candidateTokens: Array<{ token: string; index: number; endIndex: number }>,
  ruleOperandToVar: Map<string, string>
): Map<string, string> => {
  const mapping = new Map<string, string>();
  const candidateVarToOperand = new Map<string, string>();
  
  candidateTokens.forEach((token, idx) => {
    const ruleToken = ruleTokens[idx];
    const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
    if (!candidateVarToOperand.has(ruleVar)) {
      candidateVarToOperand.set(ruleVar, token.token);
    }
  });
  
  ruleTokens.forEach((ruleToken, idx) => {
    const ruleVar = ruleOperandToVar.get(ruleToken.token)!;
    const candidateOperand = candidateVarToOperand.get(ruleVar)!;
    mapping.set(ruleToken.token, candidateOperand);
  });
  
  return mapping;
};
