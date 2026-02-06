# Pattern Matching Documentation

This folder contains documentation about the pattern matching implementation for the substitution inference rule.

## Why Pattern Matching is Needed

### The Problem

When checking if a rule can be substituted into a target expression, we use normalized integer expressions. However, when expressions are normalized **separately**, they get different operand numbers even when they have the same structure.

**Example:**
- Rule normalized separately: `, 1 \Oc 2, 2 \Os,` (i→1, m→2)
- Target normalized separately: `, 3 \Oc 4, 4 \Os,` (i→3, m→4)
- **Problem**: Exact string matching fails because `1 \Oc 2, 2 \Os` ≠ `3 \Oc 4, 4 \Os`
- **But**: The patterns are structurally identical! Both represent `, i \Oc m, m \Os,`

### The Solution

Pattern matching converts operand numbers to pattern variables (A, B, C, ...) preserving operand reuse relationships:

- Rule: `, 1 \Oc 2, 2 \Os,` → Pattern: `, A \Oc B, B \Os,`
- Target: `, 3 \Oc 4, 4 \Os,` → Pattern: `, A \Oc B, B \Os,`
- **Match!** ✅ Patterns are identical

This allows matching expressions with the same structure even when they were normalized separately.

### Key Benefits

1. **Handles Separately Normalized Expressions**: Matches patterns even when operand numbers differ
2. **Preserves Operand Relationships**: Recognizes when the same operand appears multiple times (like `m` in `m \Oc, m \Os`)
3. **Fast and Efficient**: Operand-aligned matching + pattern recognition = O(p × m) complexity
4. **Works with Existing System**: Uses normalized integer expressions (no architectural changes needed)

## Documents

- **[ALGORITHMS.md](./ALGORITHMS.md)** - Primary functions and algorithms (expression parsing, rule inference, DAG substitution)
- **[WALKTHROUGH.md](./WALKTHROUGH.md)** - Detailed walkthrough of a substitution case showing the problem and solution
- **[EFFICIENCY_ANALYSIS.md](./EFFICIENCY_ANALYSIS.md)** - Comparison of different approaches and why pattern matching is optimal
- **[SCALABILITY_ANALYSIS.md](./SCALABILITY_ANALYSIS.md)** - Performance analysis with thousands of operands
- **[NORMALIZATION_NEEDED.md](./NORMALIZATION_NEEDED.md)** - Explanation of why normalization is still essential (pattern matching complements it, doesn't replace it)
