/**
 * Grammar Checker Module
 * 
 * Checks if an expression follows the grammar rules:
 * - From left to right, if an operand is instantiated with an operator that instantiates operands,
 *   it cannot be instantiated again in subsequent operations unless it is released with the release operator.
 * 
 * Operators that instantiate operands: Oa, Ob, Oc, Od, Og, Ot, Os
 * Operators that don't instantiate: Or (Error), Oe (Equivalence/Branch), On (Next), Op (Prev)
 */

export interface GrammarError {
  position: number;
  message: string;
  operand: string;
}

export interface GrammarCheckResult {
  isValid: boolean;
  errors: GrammarError[];
  instantiatedOperands: Set<string>; // Operands that are currently instantiated
}

// Operators that instantiate operands (excluding Os which releases)
// For O operators: stored without the 'O' prefix (e.g., 'c' for '\Oc')
// For other operators: stored as full lowercase name (e.g., 'newop' for '\NewOp')
// This allows easy extension to include non-O operators that instantiate operands
const INSTANTIATING_OPERATORS = new Set<string>([
  // O operators (primitive operators)
  'a', 'b', 'c', 'd', 'g', 't',
  // Future non-O operators that instantiate operands can be added here
  // Example: 'newop', 'another'
]);

// Operators that don't instantiate operands
// For O operators: stored without the 'O' prefix (e.g., 'r' for '\Or')
// For other operators: stored as full lowercase name
const NON_INSTANTIATING_OPERATORS = new Set<string>([
  // O operators that don't instantiate
  'r', 'e', 'n', 'p',
  // P operators (propositions) - don't instantiate
  'pe', 'pu', 'ps', 'pc', 'pn', 'pb', 'npe', 'npu', 'nps', 'npc', 'npn', 'npb',
  // B operators (branches) - don't instantiate
  'blb', 'bls', 'brs', 'bb',
  // T operators - don't instantiate
  'tc',
  // Future non-O operators that don't instantiate can be added here
]);

// Release operator (without 'O' prefix to match operatorName from extraction)
const RELEASE_OPERATOR = 's';

/**
 * Extract operator tokens from an expression
 * Expression format: ",i \Od m, j \Oc n," etc.
 * Returns array of { operator, operandBefore, operandAfter, index }
 */
function extractOperatorTokens(expression: string): Array<{
  operator: string;
  operatorFull: string; // Full operator name with prefix (e.g., "Od", "Pc", "Blb")
  operandBefore?: string;
  operandAfter?: string;
  index: number;
  endIndex: number;
}> {
  const tokens: Array<{
    operator: string;
    operatorFull: string;
    operandBefore?: string;
    operandAfter?: string;
    index: number;
    endIndex: number;
  }> = [];
  
  // Pattern to match operators: \ followed by uppercase letter and lowercase letters
  // This handles:
  //   - \O operators (Oa, Ob, Oc, Od, Oe, Og, Ot, On, Op, Os, Or)
  //   - \P operators (Pe, Pu, Ps, Pc, Pn, Pb, nPe, nPu, etc.)
  //   - \B operators (Blb, Bls, Brs, Bb)
  //   - \T operators (Tc)
  //   - Any other future operators
  // Format examples:
  //   ",i \Od m," - binary: operand before, operator, operand after
  //   ",\Og n," - unary: operator, operand after
  //   ",i \On," - unary: operand before, operator
  //   ",\Or," - nullary: operator only
  //   ",i \Pc j," - proposition operator (doesn't instantiate)
  
  const operatorPattern = /\\([A-Z][a-z]*)\b/g;
  let match;
  
  while ((match = operatorPattern.exec(expression)) !== null) {
    const operatorMatch = match[1]; // "Od", "Og", "Pc", "Blb", etc.
    const operatorStart = match.index;
    const operatorEnd = match.index + match[0].length;
    
    // Normalize operator name for consistent checking
    // For O operators, extract just the lowercase letter (e.g., "Od" -> "d")
    // For other operators, keep the full name in lowercase (e.g., "NewOp" -> "newop")
    let operatorName: string;
    if (operatorMatch.startsWith('O') && operatorMatch.length === 2) {
      // O operators: "Od" -> "d" (single letter)
      operatorName = operatorMatch.substring(1);
    } else {
      // Other operators: "NewOp" -> "newop" (full name, lowercase)
      // This allows us to add non-O operators to INSTANTIATING_OPERATORS in the future
      operatorName = operatorMatch.toLowerCase();
    }
    
    let operandBefore: string | undefined;
    let operandAfter: string | undefined;
    
    // Look backwards for operand before operator
    // Pattern: ",i \Od" or "i \Od" (operand before comma/space)
    let beforeStart = operatorStart - 1;
    // Skip whitespace
    while (beforeStart >= 0 && /\s/.test(expression[beforeStart])) {
      beforeStart--;
    }
    // Skip comma if present
    if (beforeStart >= 0 && expression[beforeStart] === ',') {
      beforeStart--;
      while (beforeStart >= 0 && /\s/.test(expression[beforeStart])) {
        beforeStart--;
      }
    }
    
    // Extract operand before (variable name or integer)
    // Supports both: letters (i, j, m) and integers (1, 2, 3) for normalized expressions
    if (beforeStart >= 0) {
      // Match variable: single letter or letter with subscript (i_1, j_2, etc.)
      // OR integer: single or multiple digits (1, 2, 123, etc.)
      const beforePattern = /([a-z](?:_\d+)?|\d+)\s*$/;
      const beforeText = expression.substring(Math.max(0, beforeStart - 10), beforeStart + 1);
      const beforeMatch = beforeText.match(beforePattern);
      if (beforeMatch) {
        operandBefore = beforeMatch[1];
      }
    }
    
    // Look forwards for operand after operator
    let afterEnd = operatorEnd;
    // Skip whitespace
    while (afterEnd < expression.length && /\s/.test(expression[afterEnd])) {
      afterEnd++;
    }
    
    // Extract operand after (variable name or integer)
    // Supports both: letters (i, j, m) and integers (1, 2, 3) for normalized expressions
    if (afterEnd < expression.length) {
      // Match variable: single letter or letter with subscript
      // OR integer: single or multiple digits
      const afterPattern = /^([a-z](?:_\d+)?|\d+)/;
      const afterText = expression.substring(afterEnd);
      const afterMatch = afterText.match(afterPattern);
      if (afterMatch) {
        operandAfter = afterMatch[1];
        // Check if there's a comma after the operand (end of this operator expression)
        const afterOperandEnd = afterEnd + afterMatch[0].length;
        if (afterOperandEnd < expression.length && expression[afterOperandEnd] === ',') {
          // This is the end of this operator expression
        }
      }
    }
    
    tokens.push({
      operator: operatorName,
      operatorFull: operatorMatch, // Store full operator name for display purposes
      operandBefore,
      operandAfter,
      index: operatorStart,
      endIndex: operatorEnd
    });
  }
  
  return tokens;
}

/**
 * Check grammar of an expression
 */
export function checkGrammar(expression: string): GrammarCheckResult {
  const errors: GrammarError[] = [];
  const instantiatedOperands = new Set<string>();
  
  const tokens = extractOperatorTokens(expression);
  
  for (const token of tokens) {
    const { operator, operatorFull, operandBefore, operandAfter } = token;
    
    // Handle release operator separately (it doesn't instantiate, it releases)
    if (operator === 's') {
      // Release operator: releases the operand before it
      if (operandBefore) {
        if (!instantiatedOperands.has(operandBefore)) {
          errors.push({
            position: token.index,
            message: `Operand "${operandBefore}" is being released but was not instantiated in previous operations`,
            operand: operandBefore
          });
        } else {
          instantiatedOperands.delete(operandBefore);
        }
      }
    }
    // Check if this operator instantiates operands
    else if (INSTANTIATING_OPERATORS.has(operator)) {
      // Determine which operand(s) are instantiated by this operator
      const instantiated: string[] = [];
      
      // Determine which operand(s) are instantiated by this operator
      // For O operators: 'g' and 't' are unary (instantiate operand after), others are binary (instantiate operand after)
      // For future non-O operators: determine based on operator type or add specific logic here
      
      // Check if this is a unary operator that instantiates operand after
      // Currently: Og, Ot are unary. Future non-O unary operators can be added here.
      const isUnaryAfter = operator === 'g' || operator === 't';
      
      if (isUnaryAfter) {
        // Unary operators that instantiate the operand after
        if (operandAfter) {
          if (instantiatedOperands.has(operandAfter)) {
            const opDisplay = operator.length === 1 ? `\\O${operator}` : `\\${operatorFull}`;
            errors.push({
              position: token.index,
              message: `Operand "${operandAfter}" is already instantiated and cannot be instantiated again by ${opDisplay}`,
              operand: operandAfter
            });
          } else {
            instantiatedOperands.add(operandAfter);
            instantiated.push(operandAfter);
          }
        }
      } else {
        // Binary operators (Oa, Ob, Oc, Od) and future binary operators: 
        // instantiate the operand after (the second operand, the target)
        // e.g., in "i \Od m", m is instantiated (the target), not i (the source)
        if (operandAfter) {
          if (instantiatedOperands.has(operandAfter)) {
            const opDisplay = operator.length === 1 ? `\\O${operator}` : `\\${operatorFull}`;
            errors.push({
              position: token.index,
              message: `Operand "${operandAfter}" is already instantiated and cannot be instantiated again by ${opDisplay}`,
              operand: operandAfter
            });
          } else {
            instantiatedOperands.add(operandAfter);
            instantiated.push(operandAfter);
          }
        }
      }
    } else if (NON_INSTANTIATING_OPERATORS.has(operator)) {
      // These O operators don't instantiate operands, so no action needed
      // Or (Error), Oe (Equivalence/Branch), On (Next), Op (Prev)
    } else {
      // Unknown operator or non-O operator (P, B, T, etc.)
      // These don't instantiate operands, so we ignore them for grammar checking
      // This makes the grammar checker extensible - new operators won't break it
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    instantiatedOperands
  };
}

/**
 * Get which operands are instantiated by each operator
 * @param operator - Operator name (without 'O' prefix for O operators, full lowercase name for others)
 * @param operandBefore - Operand before the operator (if any)
 * @param operandAfter - Operand after the operator (if any)
 * @returns Array of operand names that are instantiated by this operator
 */
export function getInstantiatingOperands(operator: string, operandBefore?: string, operandAfter?: string): string[] {
  if (!INSTANTIATING_OPERATORS.has(operator)) {
    return [];
  }
  
  if (operator === 's') {
    // Release doesn't instantiate, it releases
    return [];
  }
  
  // Check if this is a unary operator that instantiates operand after
  // Currently: Og, Ot are unary. Future non-O unary operators can be added here.
  const isUnaryAfter = operator === 'g' || operator === 't';
  
  if (isUnaryAfter) {
    // Unary: instantiate operand after
    return operandAfter ? [operandAfter] : [];
  } else {
    // Binary: instantiate operand after (the second operand, the target)
    return operandAfter ? [operandAfter] : [];
  }
}

/**
 * Check if an operator instantiates operands
 */
export function doesOperatorInstantiate(operator: string): boolean {
  return INSTANTIATING_OPERATORS.has(operator);
}

/**
 * Check if an operator is the release operator
 */
export function isReleaseOperator(operator: string): boolean {
  return operator === RELEASE_OPERATOR;
}
