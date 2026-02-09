# (Maximal) Universal Language
## A Novel Formal System for Machine Reasoning

**Authors:** Hankai Chen   
**Contact:** hankaichen750@gmail.com

---

## Abstract

We present (maximal) **Universal Language**, a formal system that defines and verifies relations in code. The formal system uses equivalence relations between code as its only representation of statements, and all acquired knowledge are derived through a chain of inference from axioms, definitions, or theorems. Propositions can be defined through condition branching and halt operator, and rules of arithmatic can be constructed through propositions. This paper entails the specification of the formal system, including the operand grammar, definitions of primitive operations, data-structure, and the algorithm used for proof-step verification. 

**Keywords:** Universal Language, proof verification, DAG, subgraph isomorphism, VF2, formal methods, structural substitution

---

## 1. Introduction

### 1.1 Motivation

This system is originally designed to formalizing mathematics. This is a novel foundation for modeling mathematical structure that differs from ZFC and Type Theory. In addition, this system can be a candidate reasoning engine in the neuro-symbolic AI paradigm, leveraging its multidomain synnethsis in data-structure, logic, and mathematics to verify known proofs, discover new proofs, and investigate paradox in data-structure. There is also a philosophical pursuit to create an independent language and reasoning system for machines in order to replace natural language as source of knowledge.

### 1.2 Overview of Contributions

- **Formal expression syntax** with operators, operands, and branches (Section 3.2)
- **DAG representation** and conversion to/from expressions (Section 3.3)
- **VF2-based substitution** with operand binding during matching (Section 3.4)
- **Implementation** available at [project URL]

### 1.3 Paper Organization

- Data-structure
- Equivalence Relation as Primitive Rules
- Inference Rules
    - Induction
- Primitive Operators and Grammar
- Implimentation
    - DAG Substitution
- Future Direction

---

## 2. Background and Related Work

[To be filled in]

---

## 3. The Proof Assistant Hub Formal System

### 3.1 Informal Overview

Expressions are comma-separated sequences of operations and branches. Operations have the form `operand \Op operand` (e.g., `i \Od m`, `m \Pu`). Branches introduce conditional structure: `\Bb{cond}{top}{bottom}` for if-then-else. The substitution rule matches the rule’s left (or right) side as a subgraph of the target DAG and replaces it with the rule’s other side.

The system verifies equivalences of the form A ⟺ B using three inference rules, where A and B are expressions consists of 0 or more operations:

1. **Commutativity:** A ⟺ B implies B ⟺ A
2. **Transitivity:** A ⟺ B and B ⟺ C implies A ⟺ C
3. **Substitution:** A ⟺ B allows replacing A with B in any context M·A·N → M·B·N


### 3.2 Syntax

**Definition 3.1** (Expression Syntax). Expressions are comma-separated sequences defined as follows:

```
[Operations]
op     ::= \Oa | \Ob | \Oc | \Od | \Oe | \Og | \Ot | \On | \Op | \Os | \Or
         | \Pe | \Pu | \Ps | \Pc | \Pn | \Pb | \nPe | \nPu | ...
         
[Operation form]
         ::= operand op operand   (binary, e.g., i \Od m)
         | operand op            (unary, e.g., m \Pu)
         | op                    (nullary, e.g., \Or)

[Branch operators]
         ::= \Bb{cond}{top}{bottom}   (if-then-else with shared tail)
         | \Blb{cond}{top}{bottom}    (leaf branch)
         | \Brb{top}{bottom}          (branch without condition)
         | \Brs{top}{bottom}

[Conditions]
cond   ::= operand op operand    (e.g., i \Oe j, m \Pu)
         | if(cond)              (normalized to inner cond)

[Template placeholder]
         ::= \Tc c               (placeholder for arbitrary subexpression; c is operand name)
```

**Notation.**
- Operands: identifiers (`i`, `m`, `j`) or numbers (`1`, `2`).
- Sequences: top-level commas separate items; nested braces denote branch structure.
- Example: `,i \Od m, \Bb{if(i \Pu)}{,\Tc c_1,}{,\Tc c_2,},`

### 3.3 DAG Representation

**Definition 3.2** (DAG Structure). An expression is converted to a DAG as follows:

- **Nodes:** One node per operation. Node data includes `op` (e.g., `\Od`, `:cond:\Oe`, `:tail`) and `operands` (list of operand identifiers).
- **Edges:** Data flow; chains (op₁→op₂→…) and branches (cond→arm₁, cond→arm₂, armᵢ→tail).
- **Branch nodes:** Cond nodes use `:cond:\Oe` (or `:cond:\Pu`, etc.); tail nodes use `:tail`.

**Definition 3.3** (Extraction and Serialization). `exprToDAG(e)` converts expression e to a DAG. `dagToExpr(D)` serializes DAG D back to an expression string.

### 3.4 Inference Rules and Substitution

**Commutativity and transitivity** use operand normalization: operands are mapped to integers in occurrence order, yielding `integerExpression`. Matching is exact string equality on normalized sides.

**Substitution** uses DAG subgraph isomorphism (VF2). No integer normalization is used; operand binding is resolved during the VF2 search.

**Definition 3.4** (VF2 Node Compatibility). Two nodes (pattern, target) are compatible if:

| Pattern       | Target       | Condition                                      |
|---------------|--------------|------------------------------------------------|
| Same op       | Same op      | Operands match with consistent var binding     |
| `\Tc c`       | Any          | c maps to target operand/expression            |
| `:cond:\Oe`   | `:cond:\Pu`  | First operand matches (i \Oe j ≈ i \Pu)        |

**Definition 3.5** (Empty Arm Augmentation). When the pattern has `\Tc` and the target has empty arms (cond→tail with no content), placeholder nodes are inserted between cond and tail so pattern and target node counts align.

**Substitution flow:**
1. `exprToDAG` for target and rule sides
2. Augment target with empty placeholders if needed
3. `vf2ExprSubgraphIsomorphism` → node mapping and operand mapping
4. `resolveTcOperandMapping` → map `\Tc` operands to extracted expressions
5. `expandTcInRuleSide` → replace `\Tc` placeholders in rule other side
6. `substituteInDAG` → merge prefix + replacement + suffix DAGs
7. `dagToExpr(merged)` → result expression

### 3.5 Grammar (Operand Instantiation)

Operands are instantiated or released by certain operators:

- **Instantiate:** Oa, Ob, Oc, Od, Og, Ot
- **Release:** Os
- **Non-instantiation:** Or, Oe, On, Op, P-ops, B-ops, Tc

Expressions must not reuse an operand before release.

---

## 4. Metatheory

[To be filled in: properties of the matching algorithm, termination, correctness]

---

## 5. Implementation and Evaluation

[To be filled in]

---

## 6. Conclusion and Future Work

[To be filled in]

---

## Appendix: Template Filling Tips

- **Section 3.1:** Expand the informal overview with motivating examples
- **Section 4:** Formalize and prove properties of VF2 matching (e.g., completeness under binding consistency)
- **Section 5:** Describe the web implementation, benchmarks, and case studies
