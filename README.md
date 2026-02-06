# Proof Assistant Hub

A web-based proof assistant for formal reasoning with expression parsing, rule inference, and DAG-based substitution.

## Core Algorithms

The site implements three main algorithmic components:

1. **Expression parsing** – Comma-separated expressions with LaTeX-style operators and branches → DAG structure  
2. **Rule inference** – Commutativity, transitivity, and substitution to prove rules from axioms  
3. **DAG substitution** – VF2 subgraph isomorphism for pattern matching, plus structural DAG merge for replacement  

See **[docs/ALGORITHMS.md](docs/ALGORITHMS.md)** for detailed documentation of the primary functions and algorithms.

## Quick Links

- [Pattern Matching](docs/README.md) – Why pattern matching is needed and how it works
- [Algorithms Reference](docs/ALGORITHMS.md) – Full algorithm documentation
