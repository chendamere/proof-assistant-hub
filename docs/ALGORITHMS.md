# Primary Functions and Algorithms

This document describes the core algorithms used in the proof assistant: expression parsing, rule inference, and DAG-based substitution.

---

## 1. Expression Parsing

**Location:** `src/lib/dag/exprToDAG.ts`

Expressions use a comma-separated format with LaTeX-style operators and optional branching.

### Format

- **Operations:** `operand \Op operand` (e.g. `i \Od m`, `m \Pu`)
- **Sequences:** Comma-separated at top level: `,i \Od m, j \Oc n,`
- **Branches:** `\Bb{cond}{top}{bottom}`, `\Blb{cond}{top}{bottom}`, `\Brb{top}{bottom}`, `\Brs{top}{bottom}`
- **Conditions:** `if(i \Pu)` or `i \Oe j` for equivalence

### Parsing Pipeline

1. **Split by top-level commas** (respecting braces) to get items
2. **For each item:**
   - If it starts with `\Bb`, `\Blb`, `\Brb`, `\Brs`: parse branch with `parseBranchAtStart`
   - Else: extract operations with `extractOperations` (regex `\\([A-Z][a-z]*)\b` for operators)
3. **Operand extraction:** Look backward/forward from each operator for identifiers (`[a-zA-Z](?:_\d+)?`) or numbers
4. **Branch conditions:** Parse conditions like `i \Oe j` via `parseConditionOp` (normalizes `if(...)` wrappers)

### Output: DAG Structure

- **Nodes:** One per operation; `op` (e.g. `\Od`, `:cond:\Oe`, `:tail`), `operands`, `start`, `end`
- **Edges:** Data flow (e.g. chain `n0→n1→n2`, branch cond→arm1, arm1→tail)
- **Branch representation:** Cond nodes use `:cond:\Oe`, tail nodes use `:tail` (no Bb/Blb in node data)

### Key Functions

| Function | Purpose |
|----------|---------|
| `exprToDAG` | Main entry: expression string → `DAGStructure<ExprNodeData>` |
| `extractOperations` | Parse flat comma-separated ops with operand binding |
| `parseBranchAtStart` | Parse `\Bb{cond}{top}{bottom}` etc. |
| `parseConditionOp` | Parse condition like `i \Oe j` into `{ op, operands }` |
| `buildItem` | Recursive build: branch or op chain |

---

## 2. Rule Inference

**Location:** `src/lib/inferenceRules/`

Rules are proven by applying inference rules in order.

### Inference Rules (in order)

1. **Equivalent Commutativity:** A ⟺ B implies B ⟺ A  
   - Match: target and rule sides match with sides swapped

2. **Equivalent Transitivity:** A ⟺ B and B ⟺ C implies A ⟺ C  
   - Match: target and rule share a common side (left or right)

3. **Equivalent Substitution:** A ⟺ B allows replacing A with B in any context  
   - Match: rule left (or right) occurs as a subexpression in target; substitute with rule right (or left)

### Operand Normalization

**Location:** `src/lib/operandNormalizer.ts`

Before exact matching (commutativity, transitivity), operands are normalized:

- Variables, subscripts, functions, literals → unique integers in occurrence order
- Produces `integerExpression` (e.g. `,1 \Od 2, 3 \Oc 4,`)
- Enables string equality for structurally identical expressions

### Grammar Checking

**Location:** `src/lib/grammarChecker.ts`

Validates expressions with respect to operand instantiation:

- **Instantiation:** Oa, Ob, Oc, Od, Og, Ot create bound operands
- **Release:** Os releases operands
- **Non-instantiation:** Or, Oe, On, Op, P-ops, B-ops, Tc
- Ensures operands are not reused without release

---

## 3. DAG Substitution

**Location:** `src/lib/dag/`, `src/lib/inferenceRules/substitution.ts`

Substitution is implemented as DAG isomorphism plus structural replacement.

### VF2 Subgraph Isomorphism

**Location:** `src/lib/dag/vf2Expr.ts`

Determines if the rule side DAG is isomorphic to a subgraph of the target DAG.

- **Standard VF2:** Backtracking search for a bijection from pattern nodes to target nodes preserving edges
- **Variable binding:** Pattern operands (e.g. `i`, `m`) map to target operands (e.g. `1`, `2`) consistently via `varToTarget` / `targetToVar`
- **Special handling:**
  - **\Tc:** Placeholder for arbitrary content; matches any target node; operand maps to that node’s expression
  - **\Oe / \Pu:** Pattern `i \Oe j` can match target `i \Pu` (only first operand must match)

### Node Compatibility (`exprDataMatches`)

| Pattern | Target | Rule |
|---------|--------|------|
| Same op | Same op | Operands must match with consistent binding |
| `\Tc c` | Any | Maps `c` to target operand/expression |
| `:cond:\Oe` | `:cond:\Pu` | Only first operand must match |

### Empty Arm Handling

When the pattern has `\Tc` and the target has empty arms (cond→tail with no content):

- **`augmentTargetDAGForTcMatching`** (`src/lib/dag/utils.ts`) inserts placeholder nodes between cond and tail for each empty arm
- Ensures pattern and target have compatible node counts so VF2 can succeed

### Substitution Flow

1. **Find match:** `findSubstitution(target, ruleSide, side)`  
   - `exprToDAG` for target and rule  
   - Optionally augment target with empty placeholders  
   - `vf2ExprSubgraphIsomorphism` → mapping and operand mapping

2. **Resolve \Tc operands:** `resolveTcOperandMapping`  
   - For each pattern `\Tc c` matched to target node, extract subgraph from that node  
   - `dagToExpr(subgraph)` → expression string for `c`  
   - Empty arms (tail nodes) map to `','`

3. **Expand rule other side:** `expandTcInRuleSide`  
   - Replace `\Tc c_1`, `\Tc c_2`, … in the rule’s other side with resolved expressions  
   - Ensures DAG conversion works on fully expanded expressions

4. **Merge DAGs:** `substituteInDAG`  
   - Partition target into prefix, matched, suffix, and sibling sets  
   - Build merged DAG: prefix + replacement + suffix + siblings  
   - Add boundary edges: prefix→replacement, replacement→suffix, prefix→suffix (empty arms), prefix→sibling→suffix

5. **Convert back:** `dagToExpr(merged)`  
   - Serialize merged DAG back to expression string

### Key Functions

| Function | Purpose |
|----------|---------|
| `findSubstitution` | Find rule match in target via VF2 |
| `trySubstitution` | Try each VF2 match until result equals expected |
| `convertRuleOtherSideWithDAG` | Apply operand mapping and Tc expansion; merge DAGs |
| `resolveTcOperandMapping` | Map `\Tc` operands to extracted expressions |
| `expandTcInRuleSide` | Replace `\Tc` placeholders before `exprToDAG` |
| `substituteInDAG` | Replace matched sub-DAG with replacement DAG |

---

## 4. Subexpression Generation

**Location:** `src/lib/inferenceRules/subexpressions.ts`

Produces candidate subexpressions for branch-heavy rules:

- **\Blb:** Prefix combinations (first k items from top arm, first j from bottom)
- **\Brb:** Suffix combinations (last k from top, last j from bottom)
- **\Bb:** Both Blb and Brb variants

Used when the rule has branches and exact or single-position matching fails; generates alternative ways to slice branch content.

---

## 5. Data Flow Summary

```
Expression string
       │
       ▼
  exprToDAG ──────────────────────────────────────► DAG structure
       │                                                    │
       │                                                    │ augmentTargetDAGForTcMatching (if needed)
       │                                                    │
       │                                                    ▼
       │                                            vf2ExprSubgraphIsomorphism
       │                                                    │
       │                                                    ▼
       │                                            mapping, operandMapping
       │                                                    │
       │                                                    │ resolveTcOperandMapping
       │                                                    │ expandTcInRuleSide
       │                                                    │
       │                                                    ▼
       │                                            substituteInDAG (target, pattern, replacement, mapping, operandMapping)
       │                                                    │
       │                                                    ▼
       │                                            dagToExpr ───► Result expression
       │
       └──► operandNormalizer ─► integerExpression (for commutativity/transitivity)
```

---

## Reference: Main Entry Points

| Module | Entry | Purpose |
|--------|-------|---------|
| `inferenceRules` | `checkInferenceRules` | Apply all inference rules to prove target from rules |
| `substitution` | `findSubstitution`, `trySubstitution` | DAG-based rule matching and substitution |
| `dag` | `exprToDAG`, `dagToExpr` | Expression ↔ DAG conversion |
| `dag` | `vf2ExprSubgraphIsomorphism` | Pattern matching via subgraph isomorphism |
| `dag` | `substituteInDAG` | Replace matched subgraph with replacement DAG |
