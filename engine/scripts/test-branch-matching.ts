// Test script to understand branch operator structure
const examples = [
  ', \\Bb{j \\Oe t}{,i \\Op, i \\On, }{,i \\Op, i \\On,}, ',
  ', \\Blb{j \\Oe t}{,i \\Op, }{,i \\Op,}, ',
  ', \\Br{,i \\On, }{,i \\On,},'
];

console.log('Examples:');
examples.forEach((expr, idx) => {
  console.log(`${idx + 1}. ${expr}`);
  
  // Try to extract branch structure
  const branchMatch = expr.match(/\\(B[blrb]+)\{([^}]*)\}(\{([^}]*)\})+?/);
  if (branchMatch) {
    console.log(`   Operator: ${branchMatch[1]}`);
    console.log(`   Condition: ${branchMatch[2]}`);
    
    // Extract all branches
    const branchRegex = /\{([^}]*)\}/g;
    const branches: string[] = [];
    let match;
    while ((match = branchRegex.exec(expr)) !== null) {
      branches.push(match[1]);
    }
    console.log(`   Branches (${branches.length}):`, branches);
  }
  console.log('');
});
