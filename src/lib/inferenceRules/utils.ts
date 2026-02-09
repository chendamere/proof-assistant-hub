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
