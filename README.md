# Proof Assistant Hub

A web-based proof assistant for formal reasoning with expression parsing, rule inference, and DAG-based substitution.

The proof engine is a separate program from the website. It lives in `engine/` and runs from a terminal without the site. The website imports that same code. The engine does not import the website.

```
engine/     parser, inference rules, grammar, operand normalizer, terminal entry, manual scripts
src/        website: pages, components, and web workers that call the engine
scripts/    extract site content (theorems, proof-step tables) from LaTeX
```

Terminal (from the repo root):

```
npm run prove -- parse ",i \Od m,"
npm run prove -- grammar ",i \Od m,"
npm run prove -- check "<targetLeft>" "<targetRight>" "<ruleLeft>" "<ruleRight>"
```

---

## Core Algorithms

### 1. Expression Parsing

**Location:** `engine/src/dag/exprToDAG.ts`

Expressions use a comma-separated format with LaTeX-style operators and optional branching.

- **Operations:** `operand \Op operand` (e.g. `i \Od m`, `m \Pu`)
- **Sequences:** Comma-separated: `,i \Od m, j \Oc n,`
- **Branches:** `\Bb{cond}{top}{bottom}`, `\Blb{cond}{top}{bottom}`, `\Brb{top}{bottom}`, `\Brs{top}{bottom}`

The parser produces a DAG: nodes for operations (with `op`, `operands`), edges for data flow. Cond nodes use `:cond:\Oe`, tail nodes use `:tail`.

---

### 2. Rule Inference

**Location:** `engine/src/inferenceRules/`

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

**Location:** `engine/src/dag/`, `engine/src/inferenceRules/substitution.ts`

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
| `engine/src/cli.ts` | `parse`, `grammar`, `check` | Terminal entry; no website required |
| `engine/src/inferenceRules` | `checkInferenceRules` | Apply all inference rules |
| `engine/src/inferenceRules/substitution.ts` | `trySubstitutionByMatchPairs` | DAG-based rule matching and substitution |
| `engine/src/dag` | `exprToDAG`, `dagToExpr` | Expression ↔ DAG conversion |
| `engine/src/dag` | `SingleRootDAGInjection` | Subgraph injection with operand binding |
| `engine/src/dag` | `substituteInDAG` | Replace matched subgraph with replacement DAG |
