# Proof Assistant Hub

A web-based proof assistant for formal reasoning with expression parsing, rule inference, and DAG-based substitution.

---

## Core Algorithms

### 1. Expression Parsing

**Location:** `src/lib/dag/exprToDAG.ts`

Expressions use a comma-separated format with LaTeX-style operators and optional branching.

- **Operations:** `operand \Op operand` (e.g. `i \Od m`, `m \Pu`)
- **Sequences:** Comma-separated: `,i \Od m, j \Oc n,`
- **Branches:** `\Bb{cond}{top}{bottom}`, `\Blb{cond}{top}{bottom}`, `\Brb{top}{bottom}`, `\Brs{top}{bottom}`

The parser produces a DAG: nodes for operations (with `op`, `operands`), edges for data flow. Cond nodes use `:cond:\Oe`, tail nodes use `:tail`.

---

### 2. Rule Inference

**Location:** `src/lib/inferenceRules/`

Rules are proven by applying inference rules in order:

1. **Equivalent Commutativity:** A ⟺ B implies B ⟺ A  
2. **Equivalent Transitivity:** A ⟺ B and B ⟺ C implies A ⟺ C  
3. **Equivalent Substitution:** A ⟺ B allows replacing A with B in any context  

**Integer normalization** is used only for **commutativity and transitivity** (non-substitution cases):

- `operandNormalizer` converts operands → integers in occurrence order
- Produces `integerExpression` (e.g. `,1 \Od 2, 3 \Oc 4,`)
- Enables exact string equality for structurally identical expressions

**Substitution** does not use integer normalization. Operand matching is done entirely within the DAG process (see below).

---

### 3. DAG Substitution

**Location:** `src/lib/dag/`, `src/lib/inferenceRules/substitution.ts`

Substitution uses VF2 subgraph injection on DAGs. Operand binding (rule operands like `i`, `m` → target operands) is resolved during the VF2 matching, not via integer normalization.

#### VF2 Subgraph Isomorphism

- Backtracking search for a bijection from pattern nodes to target nodes preserving edges
- **Operand binding:** `varToTarget` / `targetToVar` maintained during matching; pattern operands map to target operands consistently
- **\Tc:** Placeholder for arbitrary content; matches any target node; operand maps to that node’s expression
- **\Oe / \Pu:** Pattern `i \Oe j` can match target `i \Pu` (only first operand must match)

#### Empty Arm Handling

When the pattern has `\Tc` and the target has empty arms (cond→tail with no content), `augmentTargetDAGForTcMatching` inserts placeholder nodes so node counts align.

#### Substitution Flow

1. `exprToDAG` for target and rule
2. Optionally augment target with empty placeholders
3. `SingleRootDAGInjection` → mapping and operand mapping
4. `resolveTcOperandMapping` → map `\Tc` operands to extracted expressions
5. `expandTcInRuleSide` → replace `\Tc` placeholders before building replacement DAG
6. `substituteInDAG` → merge prefix + replacement + suffix DAGs
7. `dagToExpr(merged)` → result expression


## Data Flow

```
Expression string
       │
       ├──► operandNormalizer ─► integerExpression (commutativity/transitivity only)
       │
       └──► exprToDAG ─► DAG
              │
              ├─ augmentTargetDAGForTcMatching (if needed)
              ├─ SingleRootDAGInjection (operand matching here)
              ├─ resolveTcOperandMapping, expandTcInRuleSide
              ├─ substituteInDAG
              └─ dagToExpr ─► Result expression
```

---

## Main Entry Points

| Module | Entry | Purpose |
|--------|-------|---------|
| `inferenceRules` | `checkInferenceRules` | Apply all inference rules |
| `substitution` | `trySubstitutionByMatchPairs` | DAG-based rule matching and substitution |
| `dag` | `exprToDAG`, `dagToExpr` | Expression ↔ DAG conversion |
| `dag` | `SingleRootDAGInjection` | Subgraph injection with operand binding |
| `dag` | `substituteInDAG` | Replace matched subgraph with replacement DAG |
