/**
 * Debug why the substitution case doesn't work
 * Rule: ",  \Og x, <=> ,\Og x, \Og m, m \Os,"
 * Axiom: ", <=>  ,\Og m, m \Os,"
 */

import { normalizeRule } from '../src/lib/operandNormalizer';
import { checkInferenceRules } from '../src/lib/inferenceRules';

const ruleToProveLeft = ",  \\Og x,";
const ruleToProveRight = ",\\Og x, \\Og m, m \\Os,";

const axiomLeft = ",";
const axiomRight = ",\\Og m, m \\Os,";

console.log("=".repeat(80));
console.log("DEBUGGING SUBSTITUTION CASE");
console.log("=".repeat(80));

const ruleNormalized = normalizeRule(ruleToProveLeft, ruleToProveRight);
const axiomNormalized = normalizeRule(axiomLeft, axiomRight);

const ruleLeftInt = ruleNormalized.left.integerExpression;
const ruleRightInt = ruleNormalized.right.integerExpression;
const axiomLeftInt = axiomNormalized.left.integerExpression;
const axiomRightInt = axiomNormalized.right.integerExpression;

console.log("\nNormalized:");
console.log(`Rule Left:   "${ruleLeftInt}"`);
console.log(`Rule Right:  "${ruleRightInt}"`);
console.log(`Axiom Left:  "${axiomLeftInt}"`);
console.log(`Axiom Right: "${axiomRightInt}"`);

console.log("\n" + "=".repeat(80));
console.log("Testing each substitution direction:");
console.log("=".repeat(80));

// Direction 1: targetLeft contains ruleLeft, replace with ruleRight → check targetRight
console.log("\n1. targetLeft contains ruleLeft?");
console.log(`   targetLeft: "${ruleLeftInt}"`);
console.log(`   ruleLeft:   "${axiomLeftInt}"`);
const contains1 = ruleLeftInt.includes(axiomLeftInt);
console.log(`   Contains? ${contains1}`);

// Direction 2: targetLeft contains ruleRight, replace with ruleLeft → check targetRight
console.log("\n2. targetLeft contains ruleRight?");
console.log(`   targetLeft: "${ruleLeftInt}"`);
console.log(`   ruleRight:  "${axiomRightInt}"`);
const contains2 = ruleLeftInt.includes(axiomRightInt);
console.log(`   Contains? ${contains2}`);

// Direction 3: targetRight contains ruleLeft, replace with ruleRight → check targetLeft
console.log("\n3. targetRight contains ruleLeft?");
console.log(`   targetRight: "${ruleRightInt}"`);
console.log(`   ruleLeft:    "${axiomLeftInt}"`);
const contains3 = ruleRightInt.includes(axiomLeftInt);
console.log(`   Contains? ${contains3}`);

// Direction 4: targetRight contains ruleRight, replace with ruleLeft → check targetLeft
console.log("\n4. targetRight contains ruleRight (pattern)?");
console.log(`   targetRight: "${ruleRightInt}"`);
console.log(`   ruleRight:   "${axiomRightInt}"`);
console.log(`   This is the one we expect to work!`);

// Check pattern matching manually
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

const normalizeSpacing = (expr: string): string => {
  if (!expr) return expr;
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ',')
    .trim();
};

const targetTokens = extractOperandTokens(ruleRightInt);
const ruleTokens = extractOperandTokens(axiomRightInt);

console.log(`\n   Target tokens: [${targetTokens.map(t => `"${t.token}" at ${t.index}`).join(', ')}]`);
console.log(`   Rule tokens: [${ruleTokens.map(t => `"${t.token}" at ${t.index}`).join(', ')}]`);

const rulePattern = extractOperandPattern(axiomRightInt, ruleTokens);
console.log(`   Rule pattern: "${rulePattern.pattern}"`);

// Try position 1
const startIdx = 1;
const startToken = targetTokens[startIdx];
const endTokenIdx = startIdx + ruleTokens.length - 1;
const endToken = targetTokens[endTokenIdx];

let candidateStart = startToken.index;
let candidateEnd = endToken.endIndex;

// Extend backwards
const ruleTrimmed = axiomRightInt.trim();
if (ruleTrimmed.startsWith(',')) {
  for (let i = candidateStart - 1; i >= 0; i--) {
    const char = ruleRightInt[i];
    if (char === ',') {
      candidateStart = i;
      break;
    } else if (/\s/.test(char) || char === '\\' || /[a-zA-Z]/.test(char)) {
      continue;
    } else {
      break;
    }
  }
}

// Extend forwards
if (ruleTrimmed.endsWith(',')) {
  for (let i = candidateEnd; i < ruleRightInt.length; i++) {
    const char = ruleRightInt[i];
    if (char === ',') {
      candidateEnd = i + 1;
      break;
    } else if (/\s/.test(char) || char === '\\' || /[a-zA-Z]/.test(char)) {
      continue;
    } else {
      break;
    }
  }
}

const candidate = ruleRightInt.substring(candidateStart, candidateEnd);
const prefix = ruleRightInt.substring(0, candidateStart);
const suffix = ruleRightInt.substring(candidateEnd);

console.log(`\n   At position ${startIdx}:`);
console.log(`     Candidate start: ${candidateStart}, end: ${candidateEnd}`);
console.log(`     Full target: "${ruleRightInt}"`);
console.log(`     Full target with positions:`);
for (let i = 0; i < ruleRightInt.length; i++) {
  const char = ruleRightInt[i];
  const marker = (i === candidateStart) ? ' [START]' : (i === candidateEnd) ? ' [END]' : '';
  console.log(`       ${i}: "${char}" (code: ${char.charCodeAt(0)})${marker}`);
}
console.log(`     Character at start-1: "${ruleRightInt[candidateStart - 1]}" (code: ${ruleRightInt.charCodeAt(candidateStart - 1)})`);
console.log(`     Character at start: "${ruleRightInt[candidateStart]}" (code: ${ruleRightInt.charCodeAt(candidateStart)})`);
console.log(`     Character at end-1: "${ruleRightInt[candidateEnd - 1]}" (code: ${ruleRightInt.charCodeAt(candidateEnd - 1)})`);
if (candidateEnd < ruleRightInt.length) {
  console.log(`     Character at end: "${ruleRightInt[candidateEnd]}" (code: ${ruleRightInt.charCodeAt(candidateEnd)})`);
}
console.log(`     Candidate: "${candidate}"`);
console.log(`     Prefix: "${prefix}"`);
console.log(`     Suffix: "${suffix}"`);
console.log(`     Reconstructed: prefix + candidate + suffix = "${prefix}${candidate}${suffix}"`);
console.log(`     Matches original? ${prefix + candidate + suffix === ruleRightInt}`);

const candidateTokens = extractOperandTokens(candidate);
if (candidateTokens.length === ruleTokens.length) {
  const candidatePattern = extractOperandPattern(candidate, candidateTokens);
  console.log(`     Candidate pattern: "${candidatePattern.pattern}"`);
  
  const normalizedCandidatePattern = normalizeSpacing(candidatePattern.pattern);
  const normalizedRulePattern = normalizeSpacing(rulePattern.pattern);
  console.log(`     Normalized candidate: "${normalizedCandidatePattern}"`);
  console.log(`     Normalized rule: "${normalizedRulePattern}"`);
  console.log(`     Pattern match? ${normalizedCandidatePattern === normalizedRulePattern}`);
  
  if (normalizedCandidatePattern === normalizedRulePattern) {
    console.log(`\n   ✅ Pattern matches! Now checking substitution...`);
    
    // Build operand mapping
    const operandMapping = new Map<string, string>();
    candidateTokens.forEach((candidateToken, idx) => {
      const ruleToken = ruleTokens[idx];
      operandMapping.set(ruleToken.token, candidateToken.token);
    });
    
    console.log(`     Operand mapping:`);
    operandMapping.forEach((value, key) => {
      console.log(`       ${key} → ${value}`);
    });
    
    // Convert ruleLeft (axiomLeft) using the mapping
    const ruleOtherSide = axiomLeftInt; // ","
    console.log(`\n     Converting ruleOtherSide: "${ruleOtherSide}"`);
    
    // Check if it's just a comma
    const ruleOtherTrimmed = ruleOtherSide.trim();
    if (ruleOtherTrimmed === ',') {
      console.log(`     ✅ ruleOtherSide is just a comma, returning empty string`);
      const converted = '';
      const substituted = prefix + converted + suffix;
      console.log(`     Substituted: "${substituted}"`);
      console.log(`     Expected: "${ruleLeftInt}"`);
      
      const normalizedSub = normalizeSpacing(substituted);
      const normalizedExpected = normalizeSpacing(ruleLeftInt);
      console.log(`     Normalized substituted: "${normalizedSub}"`);
      console.log(`     Normalized expected: "${normalizedExpected}"`);
      console.log(`     Match? ${normalizedSub === normalizedExpected}`);
      
      if (normalizedSub !== normalizedExpected) {
        console.log(`\n     ⚠️  Mismatch! Let's check what we need:`);
        console.log(`     The prefix is: "${prefix}"`);
        console.log(`     The candidate starts with: "${candidate[0]}"`);
        console.log(`     When we remove the candidate, we lose its starting comma.`);
        console.log(`     But maybe the prefix should preserve structure?`);
        console.log(`     Or maybe we need to check if prefix needs a trailing comma?`);
        
        // Check if prefix should end with comma
        console.log(`\n     Checking if we need to adjust prefix/suffix:`);
        console.log(`     Original: "${ruleRightInt}"`);
        console.log(`     Removing candidate: "${candidate}"`);
        console.log(`     Should result in: "${ruleLeftInt}"`);
        console.log(`     But we get: "${substituted}"`);
        
        // Maybe the issue is that when candidate starts with comma and space,
        // and we replace with empty, we should keep the comma?
        if (candidate.startsWith(', ')) {
          console.log(`     Candidate starts with ", " - maybe we should keep the comma?`);
          const substitutedWithComma = prefix + ',' + suffix;
          const normalizedSubWithComma = normalizeSpacing(substitutedWithComma);
          console.log(`     Substituted with comma: "${substitutedWithComma}"`);
          console.log(`     Normalized: "${normalizedSubWithComma}"`);
          console.log(`     Match? ${normalizedSubWithComma === normalizedExpected}`);
        }
      }
    }
  }
}

// Now test with actual checkInferenceRules
console.log("\n" + "=".repeat(80));
console.log("Testing with actual checkInferenceRules:");
console.log("=".repeat(80));

const result = checkInferenceRules(
  ruleLeftInt,
  ruleRightInt,
  axiomLeftInt,
  axiomRightInt
);

console.log("\nResult:", JSON.stringify(result, null, 2));

if (result.match) {
  console.log("\n✅ MATCH FOUND!");
} else {
  console.log("\n❌ NO MATCH - Let's see why...");
}
