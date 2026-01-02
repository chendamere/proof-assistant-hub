/**
 * Operand Normalization Module
 * 
 * This module normalizes operands in rules by:
 * 1. Instantiating all operands from left to right
 * 2. Numbering all instantiated operands sequentially
 */

export interface NormalizedOperand {
  original: string;
  normalized: string;
  normalizedNumber: number; // The integer number assigned to this operand
  position: number;
  type: 'variable' | 'node' | 'function' | 'literal';
}

export interface NormalizationResult {
  originalExpression: string;
  normalizedExpression: string; // Expression with operand_number format (e.g., i_1)
  integerExpression: string; // Expression with just integers (e.g., 1)
  operands: NormalizedOperand[];
  operandMap: Map<string, string>; // Maps original operand to normalized version
}

/**
 * Extracts operands from an expression
 * Operands can be:
 * - Single letters/variables: i, j, k, m, n, etc.
 * - Variables with subscripts: i_1, j_2, etc.
 * - Function calls: R(...), Rc(...), Del(...), etc.
 * - Numbers or literals
 */
function extractOperands(expression: string): Array<{ value: string; index: number; type: NormalizedOperand['type'] }> {
  const matches: Array<{ value: string; index: number; type: NormalizedOperand['type']; endIndex: number }> = [];
  
  // Pattern to match various operand types
  // 1. Function calls: R(...), Rc(...), Del(...), Ins(...), etc.
  const functionPattern = /(Rc?\([^)]*\)|Rcpo\([^;)]*;[^)]*\)|Rcpm\([^;)]*;[^)]*\)|Rcpo\([^;)]*;[^)]*\)|IsCpo\([^;)]*;[^)]*\)|Cpo\([^)]*\)|Del\([^)]*\)|Ins\([^,)]*;[^)]*\)|if\([^)]*\))/g;
  
  let match;
  // Match functions first (they're longer and need priority)
  while ((match = functionPattern.exec(expression)) !== null) {
    matches.push({ 
      value: match[1], 
      index: match.index, 
      type: 'function',
      endIndex: match.index + match[1].length
    });
  }
  
  // 2. Variables with subscripts: i_1, j_2, etc.
  const subscriptPattern = /\b([a-z][a-z0-9]*_\d+)\b/g;
  functionPattern.lastIndex = 0;
  while ((match = subscriptPattern.exec(expression)) !== null) {
    // Check if this is not part of a function call we already matched
    const isInFunction = matches.some(m => 
      match.index >= m.index && match.index < m.endIndex
    );
    if (!isInFunction) {
      matches.push({ 
        value: match[1], 
        index: match.index, 
        type: 'variable',
        endIndex: match.index + match[1].length
      });
    }
  }
  
  // 3. Single variables: i, j, k, m, n, etc. (lowercase letters)
  const variablePattern = /\b([a-z])\b/g;
  subscriptPattern.lastIndex = 0;
  while ((match = variablePattern.exec(expression)) !== null) {
    // Skip if it's part of an operator (\Oa, \Ob, \Og, etc.) or branch operator (\Blb, \Br, etc.)
    const beforeContext = expression.substring(Math.max(0, match.index - 3), match.index);
    const isOperator = /\\O[a-z]|\\B[a-z]+/.test(beforeContext + match[1]);
    
    // Skip if it's part of a function call or already matched
    const isInFunction = matches.some(m => 
      match.index >= m.index && match.index < m.endIndex
    );
    
    // Skip if it's already matched as a subscripted variable
    const isSubscripted = matches.some(m => m.value.startsWith(match[1] + '_'));
    
    // Skip common keywords and operators
    const isKeyword = /\\[A-Za-z]+/.test(expression.substring(Math.max(0, match.index - 1), match.index + match[1].length));
    
    if (!isOperator && !isInFunction && !isSubscripted && !isKeyword) {
      matches.push({ 
        value: match[1], 
        index: match.index, 
        type: 'variable',
        endIndex: match.index + match[1].length
      });
    }
  }
  
  // 4. Numbers: 1, 2, 42, etc. (but not as part of functions or subscripts)
  const numberPattern = /\b(\d+)\b/g;
  variablePattern.lastIndex = 0;
  while ((match = numberPattern.exec(expression)) !== null) {
    const isInFunction = matches.some(m => 
      match.index >= m.index && match.index < m.endIndex
    );
    // Skip if it's part of a subscript
    const isSubscript = expression.substring(Math.max(0, match.index - 2), match.index).endsWith('_');
    if (!isInFunction && !isSubscript) {
      matches.push({ 
        value: match[1], 
        index: match.index, 
        type: 'literal',
        endIndex: match.index + match[1].length
      });
    }
  }
  
  // Sort by position (left to right)
  matches.sort((a, b) => a.index - b.index);
  
  // Remove duplicates and overlapping matches (keep longer matches)
  const filtered: Array<{ value: string; index: number; type: NormalizedOperand['type']; endIndex: number }> = [];
  for (const match of matches) {
    // Check if this match overlaps with or is contained in another match
    const hasOverlap = filtered.some(f => {
      const overlap = !(match.endIndex <= f.index || match.index >= f.endIndex);
      const contained = match.index >= f.index && match.endIndex <= f.endIndex;
      const contains = match.index <= f.index && match.endIndex >= f.endIndex;
      return overlap && (contained || (contains && match.value.length > f.value.length));
    });
    
    if (!hasOverlap) {
      filtered.push(match);
    }
  }
  
  // Sort again after filtering
  filtered.sort((a, b) => a.index - b.index);
  
  return filtered.map(({ value, index, type }) => ({ value, index, type }));
}

/**
 * Normalizes operands in an expression by numbering them sequentially from left to right
 */
export function normalizeOperands(expression: string): NormalizationResult {
  const operands = extractOperands(expression);
  const operandMap = new Map<string, string>();
  const normalizedOperands: NormalizedOperand[] = [];
  
  // Track unique operand values and their first occurrence number
  const seenOperands = new Map<string, number>();
  let operandCounter = 1;
  
  // Create normalized operands
  operands.forEach((op, index) => {
    let normalized: string;
    
    // If we've seen this operand value before, reuse its number
    if (seenOperands.has(op.value)) {
      normalized = `${op.value}_${seenOperands.get(op.value)}`;
    } else {
      // First time seeing this operand, assign it a new number
      normalized = `${op.value}_${operandCounter}`;
      seenOperands.set(op.value, operandCounter);
      operandCounter++;
    }
    
    operandMap.set(op.value, normalized);
    const assignedNumber = seenOperands.has(op.value) ? seenOperands.get(op.value)! : operandCounter;
    normalizedOperands.push({
      original: op.value,
      normalized: normalized,
      normalizedNumber: assignedNumber,
      position: index + 1,
      type: op.type,
    });
  });
  
  // Build normalized expression by replacing operands
  let normalizedExpression = expression;
  let integerExpression = expression;
  
  // Replace from right to left to avoid index shifting issues
  const sortedOps = [...operands].sort((a, b) => b.index - a.index);
  sortedOps.forEach(op => {
    const normalized = operandMap.get(op.value)!;
    const normalizedOperand = normalizedOperands.find(no => 
      no.original === op.value && no.normalized === normalized
    );
    const integerValue = normalizedOperand?.normalizedNumber.toString() || '';
    
    // Replace the operand at its specific position
    const before = normalizedExpression.substring(0, op.index);
    const after = normalizedExpression.substring(op.index + op.value.length);
    normalizedExpression = before + normalized + after;
    
    // Also build integer-only expression
    const beforeInt = integerExpression.substring(0, op.index);
    const afterInt = integerExpression.substring(op.index + op.value.length);
    integerExpression = beforeInt + integerValue + afterInt;
  });
  
  return {
    originalExpression: expression,
    normalizedExpression: normalizedExpression,
    integerExpression: integerExpression,
    operands: normalizedOperands,
    operandMap: operandMap,
  };
}

/**
 * Normalizes both sides of a rule together, sharing operand numbering across both sides
 */
export function normalizeRule(leftSide: string, rightSide: string): {
  left: NormalizationResult;
  right: NormalizationResult;
  allOperands: NormalizedOperand[];
} {
  // Extract operands from both sides
  const leftOperands = extractOperands(leftSide);
  const rightOperands = extractOperands(rightSide);
  
  // Create a combined list with side tracking for processing
  const leftOpsWithSide = leftOperands.map(op => ({ ...op, side: 'left' as const }));
  const rightOpsWithSide = rightOperands.map(op => ({ ...op, side: 'right' as const }));
  
  // Combine into a single ordered list (left side first, then right side)
  // Since we want sequential numbering across the entire rule, we process left first, then right
  const allOperandsOrdered = [...leftOpsWithSide, ...rightOpsWithSide];
  
  // Build shared operand map across both sides
  const operandMap = new Map<string, string>();
  const normalizedOperands: NormalizedOperand[] = [];
  const seenOperands = new Map<string, number>();
  let operandCounter = 1;
  
  // Process all operands in order (left side first, then right side)
  allOperandsOrdered.forEach((op, index) => {
    let normalized: string;
    
    // If we've seen this operand value before, reuse its number
    if (seenOperands.has(op.value)) {
      normalized = `${op.value}_${seenOperands.get(op.value)}`;
    } else {
      // First time seeing this operand, assign it a new number
      normalized = `${op.value}_${operandCounter}`;
      seenOperands.set(op.value, operandCounter);
      operandCounter++;
    }
    
    operandMap.set(op.value, normalized);
    const assignedNumber = seenOperands.has(op.value) ? seenOperands.get(op.value)! : operandCounter;
    normalizedOperands.push({
      original: op.value,
      normalized: normalized,
      normalizedNumber: assignedNumber,
      position: index + 1,
      type: op.type,
    });
  });
  
  // Create a map from operand value to its integer number
  const operandToIntegerMap = new Map<string, string>();
  normalizedOperands.forEach(no => {
    if (!operandToIntegerMap.has(no.original)) {
      operandToIntegerMap.set(no.original, no.normalizedNumber.toString());
    }
  });
  
  // Build normalized left side (with operand_number format)
  let normalizedLeftExpression = leftSide;
  let integerLeftExpression = leftSide;
  const sortedLeftOps = [...leftOperands].sort((a, b) => b.index - a.index);
  sortedLeftOps.forEach(op => {
    const normalized = operandMap.get(op.value)!;
    const integerValue = operandToIntegerMap.get(op.value) || '';
    
    const before = normalizedLeftExpression.substring(0, op.index);
    const after = normalizedLeftExpression.substring(op.index + op.value.length);
    normalizedLeftExpression = before + normalized + after;
    
    // Build integer-only expression
    const beforeInt = integerLeftExpression.substring(0, op.index);
    const afterInt = integerLeftExpression.substring(op.index + op.value.length);
    integerLeftExpression = beforeInt + integerValue + afterInt;
  });
  
  // Build normalized right side (with operand_number format)
  let normalizedRightExpression = rightSide;
  let integerRightExpression = rightSide;
  const sortedRightOps = [...rightOperands].sort((a, b) => b.index - a.index);
  sortedRightOps.forEach(op => {
    const normalized = operandMap.get(op.value)!;
    const integerValue = operandToIntegerMap.get(op.value) || '';
    
    const before = normalizedRightExpression.substring(0, op.index);
    const after = normalizedRightExpression.substring(op.index + op.value.length);
    normalizedRightExpression = before + normalized + after;
    
    // Build integer-only expression
    const beforeInt = integerRightExpression.substring(0, op.index);
    const afterInt = integerRightExpression.substring(op.index + op.value.length);
    integerRightExpression = beforeInt + integerValue + afterInt;
  });
  
  return {
    left: {
      originalExpression: leftSide,
      normalizedExpression: normalizedLeftExpression,
      integerExpression: integerLeftExpression,
      operands: normalizedOperands.filter((_, idx) => allOperandsOrdered[idx]?.side === 'left'),
      operandMap: operandMap,
    },
    right: {
      originalExpression: rightSide,
      normalizedExpression: normalizedRightExpression,
      integerExpression: integerRightExpression,
      operands: normalizedOperands.filter((_, idx) => allOperandsOrdered[idx]?.side === 'right'),
      operandMap: operandMap,
    },
    allOperands: normalizedOperands,
  };
}
