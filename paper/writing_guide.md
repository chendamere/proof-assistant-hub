# Writing Guide for Your Research Paper

This guide provides practical advice for filling out the research paper template.

## General Writing Principles for Theory Papers

### Clarity Over Cleverness
- Define all notation before using it
- Use consistent terminology throughout
- Prefer simple, direct language over complex sentences
- Include intuitive explanations before formal definitions

### Structure Your Argument
- Each section should have a clear purpose
- Use signposting: tell readers what you'll show, show it, then summarize what you showed
- Forward references help readers understand why they're reading technical material
- Examples illuminate abstractions

### The "Inverted Pyramid" Approach
- Most important results first
- Readers should understand your contribution by page 3
- Deep technical proofs can go in appendices

## Section-by-Section Guidance

### Title
- **Good:** "A Linear Logic for Quantum Computing" (specific, clear)
- **Less good:** "A Novel Approach to Computation" (vague)
- **Too long:** "A Comprehensive Treatment of Type Systems with Dependent Types, Linear Resources, and Effect Tracking for Functional Programming Languages" (should be title + subtitle)

Length: aim for 8-15 words

### Abstract (150-250 words)

Template structure:
1. **Context** (1-2 sentences): What's the general area?
2. **Problem** (1-2 sentences): What specific gap are you addressing?
3. **Solution** (2-3 sentences): What is your system/contribution?
4. **Results** (2-3 sentences): What did you prove/build/demonstrate?
5. **Impact** (1 sentence): Why does it matter?

**Example:**
> *Type systems for resource-bounded computation remain challenging to design. [context] Existing linear type systems provide resource tracking but cannot express certain quantum computation patterns. [problem] We present QuantumLinear, a type system combining linear logic with quantum superposition types. [solution] We prove strong normalization and establish a polynomial-time type-checking algorithm. [results] This enables type-safe quantum circuit verification at compile time. [impact]*

### Introduction (3-4 pages)

#### 1.1 Motivation
- Start broad, narrow down
- Use a running example if possible
- Explain why existing solutions fail
- Make the reader care about your problem

**Technique: The "failed alternatives" paragraph**
> "One might attempt to solve this by [naive approach], but this fails because [concrete problem]. Alternatively, [second attempt] provides [partial solution] but cannot handle [limitation]. The fundamental issue is [deep problem]."

#### 1.2 Contributions
- Be specific and concrete
- Use bullets or numbered list
- Map each contribution to a section number
- Include theorem numbers if possible
- Distinguish theoretical vs. practical contributions

**Template for each contribution:**
> **[Contribution name]:** We [verb: prove/develop/present/establish] [what]. This [impact/enables/shows] [why it matters]. [Optional: comparison to prior work] (Section X, Theorem Y.Z)

#### 1.3 Organization
- One sentence per remaining section
- Help readers navigate to what interests them

### Background and Related Work (2-4 pages)

**Two schools of thought on placement:**
1. Section 2 (before technical content) - helps readers understand context
2. After your technical sections - readers already motivated by your work

For logic/theory papers, Section 2 is traditional.

#### Organization strategies:

**Thematic organization:**
- Group related systems together
- Compare along specific dimensions
- Use tables for side-by-side comparison

**Historical organization:**
- Trace the evolution of ideas
- Show how your work builds on this trajectory
- Good for synthesis papers

**Problem-oriented organization:**
- Group by what problem each addresses
- Show how approaches complement or conflict

#### Writing related work effectively:

**Do:**
- Be generous to prior work
- Cite correctly and thoroughly
- Explain what prior systems achieved
- Clearly state how you differ
- Use a comparison table

**Don't:**
- Strawman prior work
- Claim things are "new" that aren't
- Over-cite your own work
- Miss important related work (reviewers will notice!)

### The Formal System (3-5 pages)

This is the heart of your paper. Typical structure:

#### 3.1 Informal Overview
- Intuition before formalism
- Running example
- Design principles
- 1-2 pages

**Technique: The progressive example**
Show the same concept at increasing levels of formality:
1. Natural language explanation
2. Commented example in your syntax
3. Formal definition
4. Formal derivation

#### 3.2 Syntax
- BNF grammar or inference rules
- Define metavariables clearly
- Explain binding conventions
- Use standard notation where possible

**Presentation tip:** Box or highlight the grammar:
```
╔══════════════════════════════════════╗
║  t ::= x | λx.t | t₁ t₂ | ...       ║
╚══════════════════════════════════════╝
```

#### 3.3 Typing Rules / Inference Rules
- Standard rule format with horizontal bars
- Name each rule (in small caps or brackets)
- Explain non-standard rules
- Group related rules together

**Rule presentation format:**
```
[RULE-NAME]
  premise₁   premise₂   ...
  ―――――――――――――――――――――――
       conclusion
```

#### 3.4 Operational Semantics
- Small-step or big-step (be consistent)
- Define reduction relation clearly
- Explain evaluation strategy if relevant

### Metatheory (4-8 pages)

This is where you prove properties about your system.

#### Organizing proofs:

**For short proofs (<1 page):**
- Include in main text
- Use "Proof." ... "□" format

**For medium proofs (1-2 pages):**
- Sketch in main text
- Full proof in appendix
- Use "Proof sketch." ... "Full proof in Appendix X." format

**For long proofs (>2 pages):**
- High-level proof strategy in main text
- Detailed proof in appendix
- State key lemmas in main text

#### Proof writing tips:

1. **State the proof technique upfront**
   > "We prove this by induction on the typing derivation."
   
2. **Highlight the interesting cases**
   > "Most cases are routine. The key case is [challenging case] where [difficulty]."

3. **Use forward references**
   > "The proof relies on Lemma 4.5, which we establish below."

4. **Name your lemmas meaningfully**
   - Good: "Substitution Lemma", "Canonical Forms"
   - Less good: "Lemma 7", "Technical Lemma"

### Algorithm and Implementation (2-4 pages)

#### 6.1 The Algorithm
- Pseudocode or mathematical notation
- Explain the key ideas first
- Prove correctness (soundness + completeness)
- Analyze complexity

**Pseudocode guidelines:**
- Use indentation for structure
- Comment the key steps
- Define data structures used
- Be precise but readable

#### 6.2 Implementation
- Architecture overview
- Key design decisions
- Lines of code, language used
- Availability (GitHub URL, etc.)

#### 6.3 Evaluation
- Benchmark selection rationale
- Metrics: time, space, success rate
- Present results in tables/graphs
- Interpret results honestly

**Table design:**
- Sort meaningfully (by size, time, etc.)
- Include representative examples
- Use scientific notation for large numbers
- Bold the best results

### Conclusion (0.5-1 page)

**Structure:**
1. Restate the problem (1 sentence)
2. Summarize your solution (2-3 sentences)
3. Recall key results (1-2 sentences)
4. Future work (1-2 sentences)
5. Broader impact (optional, 1 sentence)

**Don't:**
- Introduce new ideas
- Repeat the abstract verbatim
- Undersell your contribution

## Formal Writing Best Practices

### Mathematical Notation

**Be consistent:**
- If you use Γ for contexts, always use Γ
- Don't switch between → and ⇒ for the same concept
- Define notation in a table if extensive

**Notation conventions:**
```
Variables:        x, y, z
Types:           A, B, C, T, U, V
Terms:           t, u, v, e
Contexts:        Γ, Δ
Substitution:    t[u/x] or t{u/x}
Reduction:       →, →*, ⟹
Judgment:        ⊢, ⊨
```

### Common Theorems and Their Standard Names

- **Weakening:** Adding unused bindings to context
- **Substitution:** Replacing variables preserves typing
- **Subject Reduction:** Types preserved by evaluation
- **Progress:** Well-typed terms can evaluate
- **Preservation:** Another name for subject reduction
- **Strong Normalization:** All reduction sequences terminate
- **Confluence:** Different reduction paths reach the same result
- **Canonical Forms:** Values have specific type structure
- **Inversion:** Reasoning backwards from typing judgments

### LaTeX Conversion Notes

When you're ready to convert to LaTeX, you'll need:

1. **Document class:** `\documentclass{lipics-v2021}` or `\documentclass[sigplan]{acmart}`

2. **Key packages:**
   ```latex
   \usepackage{amsmath, amssymb, amsthm}
   \usepackage{mathtools}
   \usepackage{stmaryrd}  % For double brackets, etc.
   \usepackage{proof}     % For inference rules
   \usepackage{listings}  % For code
   ```

3. **Theorem environments:**
   ```latex
   \newtheorem{theorem}{Theorem}[section]
   \newtheorem{lemma}[theorem]{Lemma}
   \newtheorem{proposition}[theorem]{Proposition}
   \newtheorem{definition}[theorem]{Definition}
   ```

4. **Inference rules:** Use `mathpartir` package or `proof.sty`

5. **BibTeX:** Create a `.bib` file for references

## Common Pitfalls to Avoid

### Content Issues
- **Unclear contribution:** Make it crystal clear what's new
- **Missing related work:** Do a thorough literature review
- **Proof gaps:** Don't handwave the hard parts
- **Weak examples:** Examples should illuminate, not confuse
- **Inconsistent notation:** Check every symbol

### Writing Issues
- **Passive voice overuse:** "We prove" not "It is proven"
- **Unclear pronouns:** What does "it" refer to?
- **Paragraph salad:** One idea per paragraph
- **Missing transitions:** Guide the reader between sections
- **Jargon without definition:** Define domain-specific terms

### Presentation Issues
- **Walls of text:** Break up with examples, remarks, figures
- **Tiny figures:** Make them readable
- **Inconsistent formatting:** Especially in rules and proofs
- **Missing forward references:** Help readers navigate
- **Poor theorem numbering:** Use automatic numbering

## Checklist Before Submission

### Content
- [ ] All theorems have proofs (or marked as "proof in appendix")
- [ ] All notation is defined
- [ ] Examples illustrate key concepts
- [ ] Related work is comprehensive and fair
- [ ] Contributions are clearly stated
- [ ] Future work acknowledges limitations

### Writing
- [ ] Abstract stands alone (no undefined terms)
- [ ] Introduction motivates the problem
- [ ] Consistent terminology throughout
- [ ] All figures/tables are referenced
- [ ] Consistent citation format
- [ ] Proofread for typos and grammar

### Format
- [ ] Follows venue style guidelines
- [ ] Within page limit
- [ ] All references complete
- [ ] Appendices included if needed
- [ ] Supplementary material prepared (code, proofs)

## Tips for Effective Diagrams and Figures

### When to use figures:
- System architecture
- Evaluation results (graphs/tables)
- Example derivations (syntax trees, type derivations)
- Comparison with other systems
- Workflow or algorithm flow

### Design principles:
- **Clarity:** Readable at paper size (not your screen)
- **Caption:** Should be self-contained
- **Reference:** Always reference in text
- **Simplicity:** Remove unnecessary elements
- **Consistency:** Use same style for similar figures

### Tools:
- TikZ (LaTeX drawing)
- Graphviz (graphs/trees)
- Python matplotlib (plots)
- draw.io (diagrams)
- Inkscape (vector graphics)

## Responding to Reviews

When you submit and get reviews back:

### Positive reviews:
- Thank reviewers for insights
- Address minor comments
- Consider suggestions for future work

### Critical reviews:
- Stay professional
- Acknowledge valid criticisms
- Distinguish between misunderstandings (clarify) vs. real issues (fix)
- Show concrete changes made
- If you disagree, explain politely with evidence

### Rebuttal structure:
1. Thank reviewers
2. Summary of changes
3. Point-by-point responses
4. List of specific edits (file, line, page numbers)

## Additional Resources

### Example papers to study:
- Read papers from your target venue (LICS, CSL, etc.)
- Note how they structure arguments
- Observe proof presentation styles
- See how they balance theory and practice

### Writing guides:
- "Writing for Computer Science" by Zobel
- "Mathematical Writing" by Knuth, Larrabee, Roberts
- "The Science of Scientific Writing" by Gopen and Swan
- "How to Write a Great Research Paper" by Peyton Jones

### LaTeX resources:
- Overleaf templates for major venues
- The Not So Short Introduction to LaTeX
- LaTeX Wikibook
- TeX StackExchange

Good luck with your paper! Remember: clarity and precision are more important than cleverness. Your goal is to make it easy for readers to understand and appreciate your contribution.
