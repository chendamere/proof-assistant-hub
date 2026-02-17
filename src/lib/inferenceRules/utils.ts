/**
 * Utility functions for inference rules
 */

/** Replace operator \Oe with \Pe in an expression (same pattern, different operator). */
export const oeToPeInExpression = (expr: string): string => {
  if (!expr || !expr.includes('\\Oe')) return expr;
  return expr.replace(/\\Oe/g, '\\Pe');
};

/** Replace operator \Pe with \Oe in an expression (same pattern, different operator). */
export const peToOeInExpression = (expr: string): string => {
  if (!expr || !expr.includes('\\Pe')) return expr;
  return expr.replace(/\\Pe/g, '\\Oe');
};

/**
 * Generate similar proof steps (or any list of expressions) by replacing \Oe with \Pe in each step.
 * Steps that do not contain \Oe are left unchanged.
 */
export const proofStepsOeToPe = (steps: string[]): string[] =>
  steps.map((s) => oeToPeInExpression(s));

/**
 * Ensure expression string starts and ends with a comma (canonical form for all expression strings).
 * Empty or whitespace-only input returns ",".
 */
export function ensureCommaWrapped(expr: string): string {
  if (expr == null) return ',';
  const s = expr.trim();
  if (!s) return ',';
  let out = s;
  if (!out.startsWith(',')) out = ',' + out;
  if (!out.endsWith(',')) out = out + ',';
  return out;
}

/**
 * Normalize spacing in expressions to handle spacing variations.
 * Handles cases like ", 3 \Oc 4," vs ",3 \Oc 4," or ",3 \Oc 4, 1 \Od 2," vs ",3 \Oc 4,1 \Od 2,"
 * Always returns a comma-wrapped expression (starts and ends with comma).
 */
export const normalizeSpacing = (expr: string): string => {
  if (!expr) return ensureCommaWrapped(expr);
  const result = expr
    // Normalize all whitespace sequences (tabs, multiple spaces, newlines, etc.) to single spaces
    .replace(/\s+/g, ' ')
    // Remove space before comma (handles ", 3" -> ",3" and " ,3" -> ",3")
    .replace(/\s+,/g, ',')
    // Remove space after comma (handles ", 3" -> ",3" and ", 3 " -> ",3")
    .replace(/,\s+/g, ',')
    // Remove leading/trailing spaces
    .trim();
  return ensureCommaWrapped(result);
};

/** Unary \O-prefix ops that axioms/theorems write as "operand op" (e.g. m \Os). Used to canonicalize for comparison. */
const UNARY_OP_OPERAND_FIRST = new Set(['\\Os', '\\Oc', '\\Od', '\\Ob', '\\Og', '\\Oa']);

/**
 * Canonicalize unary op order so "\\Os j" and "j \\Os" compare equal. Rewrites "op operand" -> "operand op" for UNARY_OP_OPERAND_FIRST.
 * Call after normalizeSpacing when comparing substituted vs expected.
 */
export function normalizeUnaryOpOrderForComparison(expr: string): string {
  let s = expr;
  for (const op of UNARY_OP_OPERAND_FIRST) {
    const esc = op.replace(/\\/g, '\\\\');
    // "op operand" (e.g. \Os j) -> "operand op" (j \Os)
    s = s.replace(new RegExp(`${esc}\\s+([a-zA-Z0-9_]+)`, 'g'), '$1 ' + op);
  }
  return s;
}

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
