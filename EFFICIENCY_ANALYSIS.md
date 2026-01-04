# Efficiency Analysis: Substitution Matching Approaches

## Problem Summary
We need to find if `ruleSide` appears in `target` for substitution, but they're normalized separately so operand numbers don't align.

## Approaches Comparison

### Approach 1: Sliding Window with Unified Normalization
**How it works:**
- For each possible substring position in target, extract candidate
- Normalize candidate and ruleSide together using `normalizeRule()`
- Compare normalized results

**Complexity:**
- Time: O(n × m × k) where:
  - n = target length (character positions)
  - m = ruleSide length
  - k = normalization cost (operand extraction + replacement)
- Space: O(m + k) per normalization

**Pros:**
- ✅ Accurate (handles operand alignment correctly)
- ✅ Uses existing normalization functions

**Cons:**
- ❌ Very slow (many normalization operations)
- ❌ Normalization is expensive (regex matching, map building, string replacement)
- ❌ Checks many invalid positions (not operand-aligned)

**Estimated cost for our case:**
- Target: `,1  \Oc 2, 3 \Oc 4, 4 \Os,` (25 chars)
- Rule: `, 1 \Oc 2, 2 \Os,` (15 chars)
- Positions to try: ~25
- Normalizations: 25 × normalization cost
- **VERY SLOW** ⚠️

---

### Approach 2: Operand-Aligned Pattern Matching (Current)
**How it works:**
- Extract operand positions (numbers) from both expressions
- Try matching only at operand-aligned boundaries
- Compare substrings directly

**Complexity:**
- Time: O(p × m) where:
  - p = number of operand-aligned positions (usually < 10)
  - m = ruleSide length (for substring comparison)
- Space: O(p + m) for operand positions

**Pros:**
- ✅ Fast (few positions to check)
- ✅ Operand-aligned (more accurate than character positions)
- ✅ Simple string comparisons (very fast)

**Cons:**
- ❌ Doesn't handle operand number misalignment
- ❌ Current implementation fails for separately normalized expressions

**Estimated cost for our case:**
- Target operands: 5 positions
- Rule operands: 3 positions
- Positions to try: 5 - 3 + 1 = 3
- Operations: 3 × substring comparison (~15 chars each)
- **FAST** ✅ (but currently incorrect)

---

### Approach 3: Operand-Aligned + Pattern Recognition
**How it works:**
- Extract operand positions (like Approach 2)
- Match at operand boundaries
- Use pattern matching that recognizes operand relationships:
  - Convert to operand pattern (e.g., "1 \Oc 2, 2 \Os" → pattern: "A \Oc B, B \Os")
  - Match patterns rather than exact numbers

**Complexity:**
- Time: O(p × m × log(m)) where:
  - p = operand-aligned positions (~3-5)
  - m = ruleSide length
  - Pattern extraction: O(m)
  - Pattern matching: O(m) with operand mapping
- Space: O(m) for pattern representation

**Pros:**
- ✅ Fast (few positions, like Approach 2)
- ✅ Handles operand misalignment correctly
- ✅ Operand-aligned (more accurate)

**Cons:**
- ⚠️ More complex implementation
- ⚠️ Need pattern matching logic

**Estimated cost for our case:**
- Positions to try: 3
- Pattern extraction: 3 × O(15) = O(45)
- Pattern matching: 3 × O(15) = O(45)
- **FAST** ✅ (and correct!)

---

### Approach 4: Change Function Signature (Pass Original Expressions)
**How it works:**
- Pass original expressions (before normalization) to check()
- Normalize candidate substrings together with ruleSide
- But only at operand-aligned positions

**Complexity:**
- Time: O(p × k) where:
  - p = operand-aligned positions (~3-5)
  - k = normalization cost
- Space: O(m + k)

**Pros:**
- ✅ Accurate (proper normalization)
- ✅ Only normalizes at valid positions

**Cons:**
- ❌ Requires changing function signatures (breaking change)
- ❌ Still does normalization (more expensive than string comparison)
- ❌ Need to pass original expressions through the call stack

**Estimated cost for our case:**
- Positions to try: 3
- Normalizations: 3 × normalization cost
- **MODERATE SPEED** ⚠️ (slower than Approach 3, but accurate)

---

## Performance Ranking (Fastest to Slowest)

1. **Approach 3: Operand-Aligned + Pattern Recognition** ⭐ BEST
   - Fast: O(p × m) where p is small (3-5)
   - Accurate: Handles operand misalignment
   - No normalization needed in matching loop

2. **Approach 2: Current (but needs fixing)**
   - Fast: O(p × m)
   - But incorrect for separately normalized expressions

3. **Approach 4: Pass Original Expressions**
   - Moderate: O(p × k) where k is normalization cost
   - Accurate but requires architectural changes

4. **Approach 1: Sliding Window with Normalization**
   - Very Slow: O(n × m × k) where n can be large
   - Many unnecessary normalization operations

## Recommendation: Approach 3

**Why Approach 3 is best:**
1. **Fastest accurate solution** - Combines speed of operand-aligned matching with correctness
2. **No architectural changes** - Works with current integer expression inputs
3. **Scalable** - Performance doesn't degrade with longer expressions (p stays small)
4. **Reasonable implementation complexity** - Pattern matching is manageable

**Implementation sketch:**
```typescript
// Extract operand pattern from ruleSide
// e.g., ", 1 \Oc 2, 2 \Os," → pattern: ", A \Oc B, B \Os," (operand pattern)
// Build operand mapping: A=1, B=2

// For each operand-aligned position in target:
//   Extract candidate substring
//   Extract its operand pattern
//   Check if patterns match (with operand mapping)
```

This gives us the best balance of speed and correctness!
