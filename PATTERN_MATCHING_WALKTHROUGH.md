# Pattern Matching Walkthrough

## Input

**Target Rule (to prove):**
- Left: `",x \Op ,x \Od y, a \Oc b,"`
- Right: `",x \Op ,a \Oc b, x \Od y,"`

**True Rule (existing):**
- Left: `",i \Od j, n \Oc m,"`
- Right: `", n \Oc m,i \Od j,"`

**Note:** After normalization to integers, assume:
- Target Left: `",1 \Op ,1 \Od 2, 3 \Oc 4,"`
- Target Right: `",1 \Op ,3 \Oc 4, 1 \Od 2,"`
- Rule Left: `",1 \Od 2, 3 \Oc 4,"`
- Rule Right: `", 3 \Oc 4,1 \Od 2,"`

---

## Step-by-Step: findSubstitution(targetLeft, ruleLeft, 'left')

### Step 1: Extract Operand Tokens

**Target Left:** `",1 \Op ,1 \Od 2, 3 \Oc 4,"`
```
extractOperandTokens(",1 \Op ,1 \Od 2, 3 \Oc 4,")
```

Result:
```javascript
targetTokens = [
  { token: "1", index: 1, endIndex: 2 },   // First "1"
  { token: "1", index: 7, endIndex: 8 },   // Second "1" 
  { token: "2", index: 12, endIndex: 13 }, // "2"
  { token: "3", index: 16, endIndex: 17 }, // "3"
  { token: "4", index: 22, endIndex: 23 }  // "4"
]
```

**Rule Left:** `",1 \Od 2, 3 \Oc 4,"`
```javascript
ruleTokens = [
  { token: "1", index: 1, endIndex: 2 },
  { token: "2", index: 7, endIndex: 8 },
  { token: "3", index: 11, endIndex: 12 },
  { token: "4", index: 17, endIndex: 18 }
]
```

### Step 2: Extract Rule Pattern

**Rule Left:** `",1 \Od 2, 3 \Oc 4,"`
**Rule Tokens:** `[1, 2, 3, 4]`

#### 2a. Build operand-to-variable mapping
```javascript
operandToVar = new Map()
// Process tokens in order:
// "1" → not seen → assign "A" → operandToVar.set("1", "A")
// "2" → not seen → assign "B" → operandToVar.set("2", "B")
// "3" → not seen → assign "C" → operandToVar.set("3", "C")
// "4" → not seen → assign "D" → operandToVar.set("4", "D")

operandToVar = {
  "1" → "A",
  "2" → "B",
  "3" → "C",
  "4" → "D"
}
```

#### 2b. Replace operands with pattern variables (right-to-left)

**Original:** `",1 \Od 2, 3 \Oc 4,"`
**Tokens sorted by index (descending):** `[index 17, index 11, index 7, index 1]`

```javascript
pattern = ",1 \Od 2, 3 \Oc 4,"

// Replace token at index 17: "4" → "D"
pattern = ",1 \Od 2, 3 \Oc D,"  // ✅ Index 17 still valid

// Replace token at index 11: "3" → "C"
pattern = ",1 \Od 2, C \Oc D,"  // ✅ Index 11 still valid

// Replace token at index 7: "2" → "B"
pattern = ",1 \Od B, C \Oc D,"  // ✅ Index 7 still valid

// Replace token at index 1: "1" → "A"
pattern = ",A \Od B, C \Oc D,"  // ✅ Index 1 still valid
```

**Rule Pattern:** `",A \Od B, C \Oc D,"`
**ruleOperandToVar:** `{"1"→"A", "2"→"B", "3"→"C", "4"→"D"}`

### Step 3: Try Each Operand-Aligned Position in Target

**Target has 5 tokens, Rule has 4 tokens**
**Possible starting positions:** `0, 1` (need 4 consecutive tokens)

#### Position 0: `[1, 1, 2, 3]` (indices 1, 7, 12, 16)

**Candidate substring:**
```javascript
startToken = targetTokens[0]  // { token: "1", index: 1, endIndex: 2 }
endToken = targetTokens[3]    // { token: "3", index: 16, endIndex: 17 }
candidate = ",1 \Op ,1 \Od 2, 3"
prefix = ""
suffix = " \Oc 4,"
```

**Exact match check:**
```
candidate = ",1 \Op ,1 \Od 2, 3"
ruleLeft = ",1 \Od 2, 3 \Oc 4,"
❌ No match (different strings)
```

**Pattern matching:**
```javascript
candidateTokens = [
  { token: "1", index: 1, endIndex: 2 },   // In candidate string
  { token: "1", index: 7, endIndex: 8 },
  { token: "2", index: 12, endIndex: 13 },
  { token: "3", index: 16, endIndex: 17 }
]

// Extract candidate pattern:
// "1" → "A" (first occurrence)
// "1" → "A" (already mapped)
// "2" → "B" (first occurrence)
// "3" → "C" (first occurrence)

candidatePattern = ",A \Op ,A \Od B, C"
rulePattern = ",A \Od B, C \Oc D,"
❌ Patterns don't match
```

#### Position 1: `[1, 2, 3, 4]` (indices 7, 12, 16, 22)

**Candidate substring:**
```javascript
startToken = targetTokens[1]  // { token: "1", index: 7, endIndex: 8 }
endToken = targetTokens[4]    // { token: "4", index: 22, endIndex: 23 }
candidate = ",1 \Od 2, 3 \Oc 4,"
prefix = ",1 \Op "
suffix = ""
```

**Exact match check:**
```
candidate = ",1 \Od 2, 3 \Oc 4,"
ruleLeft = ",1 \Od 2, 3 \Oc 4,"
✅ EXACT MATCH!
```

**Result:**
```javascript
{
  match: true,
  position: {
    side: 'left',
    position: 7,
    description: 'Rule found at operand-aligned position 1 in left side',
    prefix: ",1 \Op ",
    suffix: undefined,
    wasPatternMatch: false
  }
}
```

### Step 4: Check Substitution

Since we found `ruleLeft` in `targetLeft`, we check if replacing it with `ruleRight` gives `targetRight`:

```javascript
prefix = ",1 \Op "
convertedRuleRight = ", 3 \Oc 4,1 \Od 2,"  // No conversion needed (exact match)
substituted = ",1 \Op " + ", 3 \Oc 4,1 \Od 2," + ""
substituted = ",1 \Op , 3 \Oc 4,1 \Od 2,"

targetRight = ",1 \Op ,3 \Oc 4, 1 \Od 2,"
```

**Comparison:**
```
substituted = ",1 \Op , 3 \Oc 4,1 \Od 2,"
targetRight = ",1 \Op ,3 \Oc 4, 1 \Od 2,"
```

**Note:** There's a subtle difference in spacing:
- `substituted` has: `", 3 \Oc 4,1 \Od 2,"` (space before 3, no space before 1)
- `targetRight` has: `",3 \Oc 4, 1 \Od 2,"` (no space before 3, space before 1)

If the normalization handles spacing consistently, this might still match. Otherwise, we'd need to try the next substitution attempt.

---

## Alternative: Pattern Matching Scenario

If the exact match didn't work due to spacing, let's see what happens with pattern matching when operands are different:

**Example with different operands:**
- Target Left: `",5 \Op ,5 \Od 6, 7 \Oc 8,"`
- Rule Left: `",1 \Od 2, 3 \Oc 4,"`

### Pattern Matching at Position 1

**Candidate:** `",5 \Od 6, 7 \Oc 8,"`

**Extract candidate pattern:**
```javascript
candidateTokens = [
  { token: "5", index: 1, endIndex: 2 },
  { token: "6", index: 7, endIndex: 8 },
  { token: "7", index: 11, endIndex: 12 },
  { token: "8", index: 17, endIndex: 18 }
]

// Build pattern:
// "5" → "A"
// "6" → "B"
// "7" → "C"
// "8" → "D"

candidatePattern = ",A \Od B, C \Oc D,"
rulePattern = ",A \Od B, C \Oc D,"
✅ PATTERNS MATCH!
```

### Build Operand Mapping

```javascript
ruleTokens = [
  { token: "1", ... },  // Maps to pattern var "A"
  { token: "2", ... },  // Maps to pattern var "B"
  { token: "3", ... },  // Maps to pattern var "C"
  { token: "4", ... }   // Maps to pattern var "D"
]

candidateTokens = [
  { token: "5", ... },  // At same position as rule "1" → also "A"
  { token: "6", ... },  // At same position as rule "2" → also "B"
  { token: "7", ... },  // At same position as rule "3" → also "C"
  { token: "8", ... }   // At same position as rule "4" → also "D"
]

// Build mapping:
// ruleToken[0] ("1") has var "A" → candidateToken[0] ("5") has var "A" → map "1" → "5"
// ruleToken[1] ("2") has var "B" → candidateToken[1] ("6") has var "B" → map "2" → "6"
// ruleToken[2] ("3") has var "C" → candidateToken[2] ("7") has var "C" → map "3" → "7"
// ruleToken[3] ("4") has var "D" → candidateToken[3] ("8") has var "D" → map "4" → "8"

operandMapping = {
  "1" → "5",
  "2" → "6",
  "3" → "7",
  "4" → "8"
}
```

### Convert Rule Right Side

**Rule Right:** `", 3 \Oc 4,1 \Od 2,"`

Using the mapping `{"1"→"5", "2"→"6", "3"→"7", "4"→"8"}`:

```javascript
// Replace "3" → "7"
// Replace "4" → "8"
// Replace "1" → "5"
// Replace "2" → "6"

convertedRuleRight = ", 7 \Oc 8,5 \Od 6,"
```

**Substitution:**
```javascript
substituted = ",5 \Op " + ", 7 \Oc 8,5 \Od 6," + ""
substituted = ",5 \Op , 7 \Oc 8,5 \Od 6,"

targetRight = ",5 \Op ,7 \Oc 8, 5 \Od 6,"
```

Again, spacing differences might affect the match, but the pattern structure matches!
