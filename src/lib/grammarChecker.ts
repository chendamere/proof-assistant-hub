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
  // Bb and Blb have condition + 2 branches, Br has 2 branches (no condition)
  'blb', 'bls', 'brs', 'bb', 'br',
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
  //   - \B operators (Blb, Bls, Brs, Bb, Br)
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
 * Extract branch ranges from branch operators in an expression
 * Returns array of {start, end, isCondition} positions for each branch (excluding the outer braces)
 * Also returns the operator type and whether it has a condition
 */
function extractBranchRanges(expression: string): {
  ranges: Array<{ start: number; end: number; isCondition?: boolean }>;
  operator: string | null;
  hasCondition: boolean;
} {
  const ranges: Array<{ start: number; end: number; isCondition?: boolean }> = [];
  
  // Find all branch operators: \Blb, \Bb, \Bls, \Brs, \Br
  // Pattern matches B followed by one or more of: b, l, r, s (e.g., Bb, Blb, Br, Bls, Brs)
  const branchPattern = /\\(B[blrs]+)\s*\{/g;
  let match;
  
  while ((match = branchPattern.exec(expression)) !== null) {
    const operator = match[1]; // "Bb", "Blb", "Br", etc.
    const operatorEnd = match.index + match[0].length;
    let pos = operatorEnd - 1; // Position of the opening brace
    
    let braceCount = 0;
    let branchStart = pos + 1;
    
    // Extract all branches (brace-delimited sections)
    const allBranches: Array<{ start: number; end: number }> = [];
    for (let i = pos; i < expression.length; i++) {
      if (expression[i] === '{') {
        braceCount++;
        if (braceCount === 1) {
          branchStart = i + 1;
        }
      } else if (expression[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found end of a branch
          allBranches.push({ start: branchStart, end: i });
          branchStart = i + 1;
          
          // Check if there are more branches after whitespace
          let nextPos = i + 1;
          while (nextPos < expression.length && /\s/.test(expression[nextPos])) {
            nextPos++;
          }
          // If no more opening braces, we're done
          if (nextPos >= expression.length || expression[nextPos] !== '{') {
            break;
          }
        }
      }
    }
    
    if (allBranches.length === 0) {
      break;
    }
    
    // Determine structure based on operator type
    // Bb and Blb: first branch is condition, then 2 actual branches
    // Br: no condition, just 2 branches
    // Bls and Brs: similar to Bb/Blb (condition + branches)
    const hasCondition = (operator === 'Bb' || operator === 'Blb' || operator === 'Bls' || operator === 'Brs');
    
    if (hasCondition && allBranches.length >= 3) {
      // First branch is condition, rest are actual branches
      ranges.push({ ...allBranches[0], isCondition: true });
      for (let i = 1; i < allBranches.length; i++) {
        ranges.push({ ...allBranches[i], isCondition: false });
      }
    } else if (!hasCondition && allBranches.length >= 2) {
      // No condition, all branches are actual branches (e.g., Br)
      for (const branch of allBranches) {
        ranges.push({ ...branch, isCondition: false });
      }
    } else {
      // Unexpected structure, just use all branches
      for (const branch of allBranches) {
        ranges.push({ ...branch, isCondition: false });
      }
    }
    
    // Only process one branch operator at a time (nested branches will be handled recursively)
    return { ranges, operator, hasCondition };
  }
  
  return { ranges: [], operator: null, hasCondition: false };
}

/**
 * Check if a position is inside any branch
 * Accepts ranges with optional isCondition property
 */
function isInsideBranch(
  position: number, 
  branchRanges: Array<{ start: number; end: number; isCondition?: boolean }>
): boolean {
  return branchRanges.some(range => position >= range.start && position < range.end);
}

/**
 * Check grammar of an expression with support for branch scoping
 * @param expression - Expression to check
 * @param inheritedOperands - Operands instantiated before this expression (used for branch scoping)
 */
function checkGrammarWithScope(expression: string, inheritedOperands: Set<string> = new Set()): GrammarCheckResult {
  const errors: GrammarError[] = [];
  const instantiatedOperands = new Set<string>(inheritedOperands);
  
  // First, find all branch ranges in this expression
  const { ranges: branchRanges, operator: branchOperatorType, hasCondition } = extractBranchRanges(expression);
  
  // Extract branch contents for recursive checking
  // For operators with conditions (Bb, Blb, Bls, Brs): skip condition, use actual branches
  // For operators without conditions (Br): use all branches
  const branchContents: Array<{ content: string; range: { start: number; end: number } }> = [];
  const actualBranchRanges: Array<{ start: number; end: number }> = [];
  
  for (const range of branchRanges) {
    if (!range.isCondition) {
      // This is an actual branch (not the condition)
      actualBranchRanges.push({ start: range.start, end: range.end });
      branchContents.push({
        content: expression.substring(range.start, range.end),
        range: { start: range.start, end: range.end }
      });
    }
  }
  
  const tokens = extractOperatorTokens(expression);
  
  // Find the first branch operator token to handle branches
  let branchOperatorToken: typeof tokens[0] | null = null;
  for (const token of tokens) {
    const isBranchOperator = token.operator === 'blb' || token.operator === 'bb' || token.operator === 'bls' || token.operator === 'brs' || token.operator === 'br';
    if (isBranchOperator) {
      branchOperatorToken = token;
      break;
    }
  }
  
  // If we found a branch operator, check each branch independently
  // For Bb/Blb/Bls/Brs: we need at least 2 actual branches (condition + 2 branches = 3 total)
  // For Br: we need at least 2 branches (no condition = 2 total)
  const expectedBranchCount = hasCondition ? 2 : 2; // Both cases need 2 actual branches
  if (branchOperatorToken && branchContents.length >= expectedBranchCount) {
    // First, process tokens that appear BEFORE the branch operator
    for (const token of tokens) {
      // Skip tokens at or after the branch operator
      if (token.index >= branchOperatorToken.index) {
        break;
      }
      // Skip tokens inside nested branches or the condition (they'll be handled recursively)
      if (isInsideBranch(token.index, actualBranchRanges) || isInsideBranch(token.index, branchRanges)) {
        continue;
      }
      
      const { operator, operatorFull, operandBefore, operandAfter } = token;
      processToken(token, operator, operatorFull, operandBefore, operandAfter, instantiatedOperands, errors);
    }
    
    // If there's a condition, process it first (it's part of the branch operator but not a branch itself)
    // The condition should be checked with the outer scope's operands
    if (hasCondition) {
      const conditionRange = branchRanges.find(r => r.isCondition);
      if (conditionRange) {
        const conditionContent = expression.substring(conditionRange.start, conditionRange.end);
        const conditionResult = checkGrammarWithScope(conditionContent, new Set(instantiatedOperands));
        // Merge errors from condition (adjust position to be relative to the original expression)
        for (const error of conditionResult.errors) {
          errors.push({
            position: conditionRange.start + error.position,
            message: error.message,
            operand: error.operand
          });
        }
        // Operands instantiated in condition are NOT added to outer scope
        // (condition is checked but doesn't affect operand scoping)
      }
    }
    
    // Now check each actual branch independently with the current state of instantiatedOperands
    // Each branch gets a fresh scope, inheriting from the outer scope
    // We need to collect operands that are instantiated at the END of ANY branch
    // The rule: If an operand is instantiated in ANY branch path (at the end of that branch),
    // it should be considered instantiated in the outer scope after the branch operator.
    // This means we take the UNION of all operands that remain instantiated at the end of each branch.
    const operandsInstantiatedInBranches = new Set<string>();
    
    for (const branch of branchContents) {
      const branchResult = checkGrammarWithScope(branch.content, new Set(instantiatedOperands));
      // Merge errors from branch (adjust position to be relative to the original expression)
      for (const error of branchResult.errors) {
        errors.push({
          position: branch.range.start + error.position,
          message: error.message,
          operand: error.operand
        });
      }
      // Add all operands that are instantiated at the end of this branch
      // This includes:
      // - Operands that were inherited and are still instantiated (not released)
      // - Operands that were instantiated within this branch
      // - Operands that were released and then re-instantiated within this branch
      for (const operand of branchResult.instantiatedOperands) {
        operandsInstantiatedInBranches.add(operand);
      }
    }
    
    // Add operands instantiated in any branch to the outer scope
    // This ensures that operands instantiated inside branches conflict with operands in the outer scope after the branch
    // Important: We take the UNION of all operands that remain instantiated at the end of each branch
    // If an operand was instantiated before the branch but released in all branches and not re-instantiated,
    // it will not be in the union (because it won't be in any branch's final instantiated set)
    // But if an operand is instantiated in at least one branch (at the end of that branch), it's in the union
    for (const operand of operandsInstantiatedInBranches) {
      instantiatedOperands.add(operand);
    }
    
    // Finally, process tokens that appear AFTER the branch operator (outside branches)
    for (const token of tokens) {
      // Skip tokens before or at the branch operator
      if (token.index <= branchOperatorToken.endIndex) {
        continue;
      }
      // Skip tokens inside branches or condition (shouldn't happen, but be safe)
      if (isInsideBranch(token.index, actualBranchRanges) || isInsideBranch(token.index, branchRanges)) {
        continue;
      }
      
      // Process this token normally (it will now see operands instantiated in branches)
      const { operator, operatorFull, operandBefore, operandAfter } = token;
      processToken(token, operator, operatorFull, operandBefore, operandAfter, instantiatedOperands, errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      instantiatedOperands
    };
  }
  
  // No branch operator found, or branch extraction failed - process normally
  for (const token of tokens) {
    const { operator, operatorFull, operandBefore, operandAfter } = token;
    processToken(token, operator, operatorFull, operandBefore, operandAfter, instantiatedOperands, errors);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    instantiatedOperands
  };
}

/**
 * Process a single token for grammar checking
 */
function processToken(
  token: { index: number; endIndex: number },
  operator: string,
  operatorFull: string,
  operandBefore: string | undefined,
  operandAfter: string | undefined,
  instantiatedOperands: Set<string>,
  errors: GrammarError[]
): void {
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

/** Set to true to enable grammar restrictions. When false, all expressions pass. */
const GRAMMAR_CHECK_ENABLED = false;

/**
 * Check grammar of an expression
 */
export function checkGrammar(expression: string): GrammarCheckResult {
  if (!GRAMMAR_CHECK_ENABLED) {
    return { isValid: true, errors: [], instantiatedOperands: new Set() };
  }
  return checkGrammarWithScope(expression, new Set());
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
