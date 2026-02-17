# Walkthrough: Substitution Case Analysis

## Input Case
**Target**: `,j  \Oc n, <=> ,j  \Oc n, i \Oc m, m \Os,`
- `targetLeft`: `,j  \Oc n,`
- `targetRight`: `,j  \Oc n, i \Oc m, m \Os,`

**Rule**: `, <=> , i \Oc m, m \Os,`
- `ruleLeft`: `,`
- `ruleRight`: `, i \Oc m, m \Os,`

## Step 1: Normalization Before check() is Called

Before the `check()` function is called, expressions are normalized using `normalizeRule()`:

### Target Normalization
`normalizeRule(",j  \Oc n,", ",j  \Oc n, i \Oc m, m \Os,")`

**Left side (targetLeft)**: `,j  \Oc n,`
- Operands extracted: `j` (1st), `n` (2nd)
- Integer expression: `,1  \Oc 2,`

**Right side (targetRight)**: `,j  \Oc n, i \Oc m, m \Os,`
- Operands extracted: `j` (1st, reused), `n` (2nd, reused), `i` (3rd), `m` (4th), `m` (4th, reused)
- Integer expression: `,1  \Oc 2, 3 \Oc 4, 4 \Os,`

### Rule Normalization  
`normalizeRule(",", ", i \Oc m, m \Os,")`

**Left side (ruleLeft)**: `,`
- Operands extracted: none
- Integer expression: `,`

**Right side (ruleRight)**: `, i \Oc m, m \Os,`
- Operands extracted: `i` (1st), `m` (2nd), `m` (2nd, reused)
- Integer expression: `, 1 \Oc 2, 2 \Os,`

## Step 2: check() Function Receives Integer Expressions

The `check()` function receives:
- `targetLeft`: `,1  \Oc 2,`
- `targetRight`: `,1  \Oc 2, 3 \Oc 4, 4 \Os,`
- `ruleLeft`: `,`
- `ruleRight`: `, 1 \Oc 2, 2 \Os,`

## Step 3: Try Substitution Cases

The code tries 4 cases:

### Case 1: targetLeft contains ruleLeft
Case 1: Match `,` in targetLeft

**Process:**
1. Extract operand tokens:
   - targetTokens: `[{token: "1", index: 1}, {token: "2", index: 8}]`
   - ruleTokens: `[]` (empty - no operands in `,`)

2. Handle empty ruleSide:
   - `trimmedRuleSide = ",".trim()` → `","` (not empty)
   - Use string matching: `",1  \Oc 2,".indexOf(",")` → `0` ✅ MATCH
   - prefix: `""`, suffix: `1  \Oc 2,`

3. Check substitution:
   - Substituted: `"" + ", 1 \Oc 2, 2 \Os," + "1  \Oc 2,"` = `, 1 \Oc 2, 2 \Os,1  \Oc 2,`
   - Compare with targetRight: `,1  \Oc 2, 3 \Oc 4, 4 \Os,`
   - ❌ NO MATCH (different patterns)

### Case 2: targetLeft contains ruleRight
Case 2: Match `, 1 \Oc 2, 2 \Os,` in targetLeft

**Process:**
1. Extract operand tokens:
   - targetTokens: `[{token: "1", index: 1}, {token: "2", index: 8}]` (2 tokens)
   - ruleTokens: `[{token: "1", index: 2}, {token: "2", index: 8}, {token: "2", index: 13}]` (3 tokens)

2. Check: `ruleTokens.length (3) > targetTokens.length (2)` → ❌ NO MATCH

### Case 3: targetRight contains ruleLeft
Case 3: Match `,` in targetRight

**Process:**
1. Extract operand tokens:
   - targetTokens: `[{token: "1", index: 1}, {token: "2", index: 8}, {token: "3", index: 13}, {token: "4", index: 18}, {token: "4", index: 23}]`
   - ruleTokens: `[]`

2. Handle empty ruleSide:
   - String matching: `",1  \Oc 2, 3 \Oc 4, 4 \Os,".indexOf(",")` → `0` ✅ MATCH

3. Check substitution:
   - Substituted: `"" + ", 1 \Oc 2, 2 \Os," + "1  \Oc 2, 3 \Oc 4, 4 \Os,"` = `, 1 \Oc 2, 2 \Os,1  \Oc 2, 3 \Oc 4, 4 \Os,`
   - Compare with targetLeft: `,1  \Oc 2,`
   - ❌ NO MATCH

### Case 4: targetRight contains ruleRight ⭐
Case 4: Match `, 1 \Oc 2, 2 \Os,` in targetRight

**Process:**
1. Extract operand tokens:
   - targetTokens: `[{token: "1", index: 1}, {token: "2", index: 8}, {token: "3", index: 13}, {token: "4", index: 18}, {token: "4", index: 23}]` (5 tokens)
   - ruleTokens: `[{token: "1", index: 2}, {token: "2", index: 8}, {token: "2", index: 13}]` (3 tokens)

2. Check: `ruleTokens.length (3) <= targetTokens.length (5)` → ✅ OK

3. Try operand-aligned positions:
   - **Position 0** (startIdx=0):
     - candidateStart = 1, candidateEnd = 13
     - candidate = `1  \Oc 2, 3` ❌ ≠ `, 1 \Oc 2, 2 \Os,`
   
   - **Position 1** (startIdx=1):
     - candidateStart = 8, candidateEnd = 18
     - candidate = `2, 3 \Oc 4` ❌ ≠ `, 1 \Oc 2, 2 \Os,`
   
   - **Position 2** (startIdx=2):
     - candidateStart = 13, candidateEnd = 23
     - candidate = `3 \Oc 4, 4` ❌ ≠ `, 1 \Oc 2, 2 \Os,`

4. ❌ NO MATCH FOUND

## Problem Identified

The issue is that **the operand numbers don't align** because target and rule were normalized separately:

- **Rule pattern** (normalized separately): `, 1 \Oc 2, 2 \Os,` (operands 1, 2, 2)
- **Target pattern** (normalized separately): `,1  \Oc 2, 3 \Oc 4, 4 \Os,` (operands 1, 2, 3, 4, 4)

The rule's pattern `, i \Oc m, m \Os,` should match the end of targetRight, but:
- Rule's `i` became `1`, `m` became `2` in rule's normalization
- Target's `i` became `3`, `m` became `4` in target's normalization

**This is exactly why Strategy 2 was needed** - we need to normalize them together or use pattern matching that accounts for operand alignment!

The current implementation can't match because it compares string representations of separately normalized expressions.
