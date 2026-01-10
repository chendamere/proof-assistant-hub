// Test exact matching logic
const targetBranch = ',i \\Op, i \\On, ';
const ruleBranch = ',i \\Op, ';

console.log('Target branch:', JSON.stringify(targetBranch));
console.log('Rule branch:', JSON.stringify(ruleBranch));
console.log('');

// Test normalization
const normalizeSpacing = (expr: string): string => {
  if (!expr) return expr;
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ',')
    .trim();
};

const normalizedTarget = normalizeSpacing(targetBranch);
const normalizedRule = normalizeSpacing(ruleBranch);

console.log('Normalized target:', JSON.stringify(normalizedTarget));
console.log('Normalized rule:', JSON.stringify(normalizedRule));
console.log('Match:', normalizedTarget === normalizedRule ? 'YES' : 'NO');
console.log('');

// Check if rule is a substring
console.log('Rule is substring of target:', normalizedTarget.includes(normalizedRule));
console.log('Rule at position:', normalizedTarget.indexOf(normalizedRule));
