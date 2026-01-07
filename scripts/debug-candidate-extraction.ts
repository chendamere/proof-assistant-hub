/**
 * Debug script to show all candidate subexpressions extracted during pattern matching
 * Example: Rule ",  \Og x, <=> ,\Og x, \Og m, m \Os," with Axiom ", <=>  ,\Og m, m \Os,"
 */

import { normalizeRule } from '../src/lib/operandNormalizer';

// Test case
const ruleToProveLeft = ",  \\Og x,";
const ruleToProveRight = ",\\Og x, \\Og m, m \\Os,";

const axiomLeft = ",";
const axiomRight = ",\\Og m, m \\Os,";

console.log("=".repeat(80));
console.log("CANDIDATE SUBEXPRESSION EXTRACTION DEBUG");
console.log("=".repeat(80));
console.log("\nRule to Prove:");
console.log(`  Left:  "${ruleToProveLeft}"`);
console.log(`  Right: "${ruleToProveRight}"`);
console.log("\nAxiom (True Rule):");
console.log(`  Left:  "${axiomLeft}"`);
console.log(`  Right: "${axiomRight}"`);

// Normalize
const ruleNormalized = normalizeRule(ruleToProveLeft, ruleToProveRight);
const ruleLeftInt = ruleNormalized.left.integerExpression;
const ruleRightInt = ruleNormalized.right.integerExpression;

const axiomNormalized = normalizeRule(axiomLeft, axiomRight);
const axiomLeftInt = axiomNormalized.left.integerExpression;
const axiomRightInt = axiomNormalized.right.integerExpression;

console.log("\n" + "-".repeat(80));
console.log("Normalized Expressions");
console.log("-".repeat(80));
console.log(`Rule Left:   "${ruleLeftInt}"`);
console.log(`Rule Right:  "${ruleRightInt}"`);
console.log(`Axiom Left:  "${axiomLeftInt}"`);
console.log(`Axiom Right: "${axiomRightInt}"`);

// Simulate findSubstitution logic
console.log("\n" + "=".repeat(80));
console.log("SIMULATING findSubstitution(target=ruleRightInt, ruleSide=axiomRightInt)");
console.log("=".repeat(80));

const target = ruleRightInt;
const ruleSide = axiomRightInt;

console.log(`\nTarget: "${target}"`);
console.log(`Rule Side: "${ruleSide}"`);

// Extract operand tokens
const extractOperandTokens = (expr: string) => {
  const tokens: Array<{ token: string; index: number; endIndex: number }> = [];
  const numberPattern = /\b(\d+)\b/g;
  let match;
  while ((match = numberPattern.exec(expr)) !== null) {
    tokens.push({
      token: match[1],
      index: match.index,
      endIndex: match.index + match[1].length
    });
  }
  return tokens;
};

const targetTokens = extractOperandTokens(target);
const ruleTokens = extractOperandTokens(ruleSide);

console.log(`\nTarget tokens: [${targetTokens.map(t => `"${t.token}" at ${t.index}-${t.endIndex}`).join(', ')}]`);
console.log(`Rule tokens: [${ruleTokens.map(t => `"${t.token}" at ${t.index}-${t.endIndex}`).join(', ')}]`);

// Try each operand-aligned starting position
console.log(`\n${"=".repeat(80)}`);
console.log("TRYING EACH OPERAND-ALIGNED POSITION");
console.log("=".repeat(80));

const ruleTrimmed = ruleSide.trim();
console.log(`\nRule side trimmed: "${ruleTrimmed}"`);
console.log(`Starts with comma? ${ruleTrimmed.startsWith(',')}`);
console.log(`Ends with comma? ${ruleTrimmed.endsWith(',')}`);

for (let startIdx = 0; startIdx <= targetTokens.length - ruleTokens.length; startIdx++) {
  console.log(`\n${"-".repeat(80)}`);
  console.log(`Position ${startIdx}:`);
  console.log("-".repeat(80));
  
  const startToken = targetTokens[startIdx];
  const endTokenIdx = startIdx + ruleTokens.length - 1;
  const endToken = targetTokens[endTokenIdx];
  
  console.log(`  Start token: "${startToken.token}" at index ${startToken.index}, endIndex ${startToken.endIndex}`);
  console.log(`  End token: "${endToken.token}" at index ${endToken.index}, endIndex ${endToken.endIndex}`);
  
  // Initial candidate boundaries (token-only)
  let candidateStart = startToken.index;
  let candidateEnd = endToken.endIndex;
  
  console.log(`  Initial boundaries: start=${candidateStart}, end=${candidateEnd}`);
  console.log(`  Initial candidate: "${target.substring(candidateStart, candidateEnd)}"`);
  
  // Try to extend backwards
  console.log(`\n  Extending backwards (looking for leading comma):`);
  if (ruleTrimmed.startsWith(',')) {
    let foundComma = false;
    for (let i = candidateStart - 1; i >= 0; i--) {
      const char = target[i];
      console.log(`    Position ${i}: "${char}" (code: ${char.charCodeAt(0)})`);
      
      if (char === ',') {
        candidateStart = i;
        foundComma = true;
        console.log(`    ✅ Found comma at position ${i}`);
        break;
      } else if (/\s/.test(char)) {
        console.log(`    → Whitespace, continuing...`);
        continue;
      } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
        console.log(`    → Operator character (backslash or letter), continuing...`);
        continue;
      } else {
        console.log(`    ❌ Hit other character "${char}", stopping`);
        break;
      }
    }
    if (!foundComma) {
      console.log(`    ⚠️  No comma found before candidate start`);
    }
  } else {
    console.log(`    Skipped (rule side doesn't start with comma)`);
  }
  
  // Try to extend forwards
  console.log(`\n  Extending forwards (looking for trailing comma):`);
  if (ruleTrimmed.endsWith(',')) {
    let foundComma = false;
    for (let i = candidateEnd; i < target.length; i++) {
      const char = target[i];
      console.log(`    Position ${i}: "${char}" (code: ${char.charCodeAt(0)})`);
      
      if (char === ',') {
        candidateEnd = i + 1;
        foundComma = true;
        console.log(`    ✅ Found comma at position ${i}`);
        break;
      } else if (/\s/.test(char)) {
        console.log(`    → Whitespace, continuing...`);
        continue;
      } else if (char === '\\' || /[a-zA-Z]/.test(char)) {
        console.log(`    → Operator character (backslash or letter), continuing...`);
        continue;
      } else {
        console.log(`    ❌ Hit other character "${char}", stopping`);
        break;
      }
    }
    if (!foundComma) {
      console.log(`    ⚠️  No comma found after candidate end`);
    }
  } else {
    console.log(`    Skipped (rule side doesn't end with comma)`);
  }
  
  // Final candidate
  const candidate = target.substring(candidateStart, candidateEnd);
  const prefix = target.substring(0, candidateStart);
  const suffix = target.substring(candidateEnd);
  
  console.log(`\n  Final candidate extraction:`);
  console.log(`    Candidate start: ${candidateStart}`);
  console.log(`    Candidate end: ${candidateEnd}`);
  console.log(`    Candidate: "${candidate}"`);
  console.log(`    Prefix: "${prefix}"`);
  console.log(`    Suffix: "${suffix}"`);
  console.log(`    Full: prefix + candidate + suffix = "${prefix}${candidate}${suffix}"`);
  console.log(`    Original target: "${target}"`);
  console.log(`    Match? ${prefix + candidate + suffix === target}`);
  
  // Check exact match
  const normalizeSpacing = (expr: string): string => {
    if (!expr) return expr;
    return expr
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/,\s+/g, ',')
      .trim();
  };
  
  const normalizedCandidate = normalizeSpacing(candidate);
  const normalizedRuleSide = normalizeSpacing(ruleSide);
  
  console.log(`\n  Comparison:`);
  console.log(`    Candidate (normalized): "${normalizedCandidate}"`);
  console.log(`    Rule side (normalized): "${normalizedRuleSide}"`);
  console.log(`    Exact match? ${candidate === ruleSide}`);
  console.log(`    Normalized match? ${normalizedCandidate === normalizedRuleSide}`);
  
  // Pattern matching
  console.log(`\n  Pattern matching:`);
  const extractOperandPattern = (expr: string, tokens: Array<{ token: string; index: number; endIndex: number }>) => {
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
  
  const candidateTokens = extractOperandTokens(candidate);
  if (candidateTokens.length === ruleTokens.length) {
    const candidatePattern = extractOperandPattern(candidate, candidateTokens);
    const rulePattern = extractOperandPattern(ruleSide, ruleTokens);
    
    const normalizedCandidatePattern = normalizeSpacing(candidatePattern.pattern);
    const normalizedRulePattern = normalizeSpacing(rulePattern.pattern);
    
    console.log(`    Candidate tokens: [${candidateTokens.map(t => t.token).join(', ')}]`);
    console.log(`    Candidate pattern: "${candidatePattern.pattern}"`);
    console.log(`    Rule pattern: "${rulePattern.pattern}"`);
    console.log(`    Normalized candidate pattern: "${normalizedCandidatePattern}"`);
    console.log(`    Normalized rule pattern: "${normalizedRulePattern}"`);
    console.log(`    Pattern match? ${normalizedCandidatePattern === normalizedRulePattern}`);
  } else {
    console.log(`    Token count mismatch: candidate has ${candidateTokens.length}, rule has ${ruleTokens.length}`);
  }
}

console.log(`\n${"=".repeat(80)}`);
console.log("SUMMARY");
console.log("=".repeat(80));
console.log("\nThe issue is that when extending backwards, we stop at non-whitespace,");
console.log("non-comma characters (like '\\Og'). We need to continue through operators");
console.log("to find the leading comma and full structure.");
