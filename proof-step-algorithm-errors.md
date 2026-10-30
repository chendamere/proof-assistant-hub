# Proof-step check: what was filled, and what is still a checker limit

Chapters 1–4 stay clear (252 passed, 0 failed). No axiom or theorem statement was changed.

## Intermediates inserted

A book arrow that is two or three uses of an earlier rule now has those expressions written into the proof. Each inserted link was checked with the existing matcher before it was written.

| Chapter file | Insertions |
| --- | ---: |
| Theorems_of_Identical_Node_Comparison.tex | 76 |
| Swap_Theorems_of_Same_Operand.tex | 25 |
| Theorems_of_Operators_and_Relationships.tex | 29 |
| Next_Order_Induction.tex | 14 |
| Recursive_Function_R.tex | 23 |
| Previous_Order_Induction.tex | 14 |
| Recursive_Function_R_Prev.tex | 24 |
| Rules_of_Node_Ring.tex | 74 |
| Rules_of_Node_Connectivity.tex | placeholder expand + 37 exact-anchor fills |

Identical-node comparison, rechecked after the longer one-site chains: 173 passed, 0 failed (was 102 passed, 9 failed). Those nine arrows each became a chain of existing rules: bubble one atom to the branch with `swap-id-1`, `swap-id-2`, `swap-id-release`, or `swap-release-release`, then one `swap-id-branch` or `swap-release-branch-1` on both arms, then bubble again inside the arm. Theorem `::73::` also uses the earlier node-value symmetry `,i \Pe j, m \Od n, ⟺ ,m \Od n, i \Pe j,` and deletes `j \Od n_2, n_2 \Os` from each arm with `create-id`. The matcher already accepted each link. No axiom was added.

## Fixes that do not change the formal system

- Line continuation in `scripts/extract-proof-steps.js`. A proof line ending in `\\` used to keep one backslash, which glued onto the next line as `\ \Bb`. The extractor now strips the whole trailing run of backslashes.
- `exprToDAG` no longer recurses forever when a brace group does not split on a top-level comma. That input now throws `unparsed branch` (or stops at depth 100) instead of overflowing the stack. Returning no node was tried and rejected: it dropped real `\Os` atoms and made chapter 4 fail.
- The step generator can now emit a substitution the checker already accepted: a definition whose arms are a prefix of the proof’s arms, with the rest of each arm kept. Example: `\Blb{i \Ps j}{,}{,}` expands one `\Bb{m \Ps n}{\Tc c_1}{\Tc c_2}` and leaves `c_1` and `c_2` on the new arms. The second arm reuses the same fresh temporaries when the book does. This is only in the generator. The matcher is unchanged.
- `R_(i)` is a function call. The expression parser and the substitution parser both required a function name of letters and digits, so `R_(i)` and `R\_(i)` were dropped before a step was graded. Both now keep the underscore, and a stored `R\_(` is read as `R_(` at check time. The TeX is unchanged. Chapter 10 stays 151 passed, 0 failed after this read.

## Checker behavior that was not “fixed”

These are real limits of the current algorithm. Widening them would accept steps the rules do not state.

- A definition written as an empty `\Blb` is injected into a `\Bb` that already has arm code. The matcher allows that (chapter 4’s null-comparison proofs depend on it). The generator now follows it. It is not a new axiom.
- `\Pe` and `\Oe` are treated as the same relation, in both directions. A pattern `i \Oe i` can match a unary `\Pu` condition, because only the first operand is compared. Do not cite `equiv-self` for a step whose condition is `\Pu`.
- `\Tc` rules are generated only when every hole sits inside a branch arm. A free hole such as `\Or ⟺ \Or, \Tc code` is not enumerated, so “delete arbitrary code after `\Or`” is not invented as a wildcard.
- The `\Brs` operator theorems in `Rules_of_Operators.tex` are in the proof-step table and are not in `theorems.ts`, so a later proof cannot cite them. Regenerating `theorems.ts` would renumber ids. Left as a gap.
- `Rules_of_Node_Connectivity.tex` line 683 is missing a comma: `i \Oc i_1 j \Oc j_1`. That is a source typo. The checker is right to reject the glued operands.
- Informal proof placeholders `<1>`, `<2>`, `<3>` used to parse as an empty DAG (silent drop). `exprToDAG` now rejects `/<\d+>/`. In connectivity theorem 124 the case-split block was expanded into full `\Bb{if(i \Pu)}{…}{…}` frames with earlier-rule mid hops where found. Two scaffolding-cleanup arms (pu-16 / npu-14) still jump without a cited rule.

## Still open after the one-arm chains

Empty-branch proofs that move code into both arms of an empty-condition `\Blb` are the Axiom of Empty Branch Function, `,\Tc c, \Blb{}{,}{,} ⟺ ,\Blb{}{,\Tc c,}{,\Tc c,}`. The matcher now keeps arm code that was already there, the same way a non-`\Tc` pattern keeps an arm suffix, and it accepts an empty condition. Collapsing each arm to `\Pu` / `\Ps` is one earlier proposition at a time.

Recheck after inserting one-site chains (each link an earlier rule, one arm then the other):

| Chapter | Passed | Failed |
| --- | ---: | ---: |
| 1–4 | 252 | 0 |
| Identical node comparison | 173 | 0 |
| Empty branch function | 10 | 0 |
| Swap theorems of the same operand | 196 | 0 |
| Operators and relationships | 148 | 0 |
| Next-order induction | 38 | 0 |
| Recursive function R | 151 | 0 |
| Previous-order induction | 38 | 0 |
| Recursive function R, previous order | 151 | 0 |
| Node ring | 187 | 0 |
| Node connectivity | (recheck after operand-bind fix) | |

### Verification fix: non-injective operand unification (critical)

`DAGInjection.exprDataMatches` / `TcMapping` previously required **injective** target←pattern operand binding (`targetToVar`: each concrete name → at most one rule var). That rejected valid instances such as `i \Ps i_1, i_1 \Pu` under rule `i \Ps j, m \Pu` (j and m both → `i_1`), and blocked `i_1 \Ps i_2, R(i_1)` under `m \Ps n, R(i)`.

**Change:** keep functional pattern→target binding; allow several rule vars to share one target name. Files: `engine/src/dag/DAGInjection.ts`, `engine/src/dag/TcMapping.ts`.

### Chapter 14 fill notes (iterative)

Exact-anchor apply; strip trailing `\\` on multi-line `\Rq`; fingerprint after `stripDisplayIfConditions`. Other notes: connectivity fresh-name align; cache `buildRuleIndex` by thm pos; Blb right-operand subst = flip→`identical-72`→flip; empty-Bb→cond via empty-branch; equal-arm pull via `null-comparison-9` then drop empty via `null-comparison-4`; Pu/nPu arm flags via null-comparison-52/53.

**Process:** verify → `--out=recheck-ch14.jsonl` → solve complete chains only → exact-fingerprint anchor → extract → recheck. Never soft-anchor. Reject zigzag/duplicate inserts (identical consecutive `\Rq` runs, runaway Pu duplication). Restore corrupted regions from HEAD when needed.

**Learned patterns (speed):**
- Same top-level multiset → greedy adjacent bubble (`r-22`/`r-10`/`r-24`, swap-release); allow equal `orderDist` for R-pair swaps.
- Bb/Blb arm-only Os reorder: treat Bb as opaque top atom; distance-minimizing Os swaps via `swap-release-release` (do not pick first justified swap — oscillates).
- Reintroduce dropped `R(x)` before `x \Os` via reverse `thm-R-i-release`.
- Drop stray `j \Ps i_1` when `i \Ps j` present: bubble adjacent → `identical-73` (`i \Ps j, j \Ps i_1 → i \Ps j, i \Ps i_1`) → reverse `copy-identical` drop `i \Ps i_1` beside `i \Oc i_1` → bubble.
- `copy-identical`: `i \Oc j → i \Oc j, i \Ps j` (and reverse).
- **197 (Oc/Os fold under Blb):** flip `Blb{j Ps i}`→`Blb{i Ps j}` → equalize Os arms (`swap-release-release`) → pull equal-arm `x Os` via `identical-15` → bubble `x Oc y` next to `y Os` → `create-copy` drop both Oc+Os pairs.
- **202 (strip Oc/R/Os from Blb arms):** `create-copy` drop true-arm `j Oc j2, j2 Os` → bubble `R(j2)` adjacent to `j2 Os` → `thm-R-i-release` drop R → `create-copy` drop false-arm Oc+Os → reorder remaining Os. Reverse `thm-R-i-release` inserts R when equalizing arms the other way.
- Justify memo by `(pos|A=>B)`; skip `error-code` and empty-LHS `identical-4` in fill justify.
- Per-fail deadline (~5s) with justify caps inside candidate loops; run expensive arm solvers only when top-level multiset already matches.
- Occurrence-indexed exact anchors when the same fingerprint appears more than once.
- Justify memo `(pos|A=>B)`; skip `error-code` / empty-LHS `identical-4` in fill justify.
- Pu arm flags: `null-comparison-52` then `53` (`Bb{i Pu}{T}{F}` → add `i Pu` / `i nPu` into arms).

**Verification-algorithm watchlist (do not widen casually):**
- Rules with empty/near-empty left sides (e.g. identical-4 Unity `, → \Bs{…}`) can spuriously justify unrelated rewrites; prefer skipping or tightening empty-LHS matching.
- `error-code` can turn `\Or` into `\sim`; exclude from fill justify (same spirit as `equiv-code`).
- Injective operand bind was wrong (fixed); keep non-injective functional bind.
- **Thm 124 informal Bb case-split / case-merge:** after Pu/nPu flags, the proof jumps from `i Oc i1, j Oc j1, Bb{i Pu}{true}{false}, Os…` to the bare true-arm body (and later merges back from the false-arm body). That is not a single-site rule. Options: (1) checker support for Bb case analysis (focus true / focus false / merge), or (2) rewrite the proof to keep the Oc/Os shell and use `null-comparison-54`/`55` with an outer `i Pu`/`i nPu` through both branches. Prefer (2) fills when possible; do not treat the bare jump as a missing axiom.
- **Fill safety:** only auto-insert when left fingerprint is unique in the tex **and** the next `\Rq` fingerprints to fail.right. Wrong-occurrence anchors caused A-B-A-B zigzag inflation (100/108). Never bulk-delete “seen” fingerprints across a whole math block — legitimate revisits exist. Prefer consec-dup removal only. Keep a `.bak` of the tex before mass applies.
- **195 drop `j Ps i1`:** bubble `j Ps i1` next to `i Ps j` → `identical-73` → bubble `i Ps i1` next to `i Oc i1` → reverse `copy-identical` drop → drop duplicate `i1 Ps j1` (e.g. `recursive-function-r-27`) → reorder.
- Greedy adjacent bubble (distance-minimizing) clears many Pu/Oc reorder fails that timed out in the combined solver; run `apply-greedy-reorder.ts` as a dedicated pass.
- **Blb/Bb condition operand subst (identical-72 path):** to rewrite `Blb{i Ps j1}→Blb{i Ps j}` given `j Ps j1`: flip cond → `identical-72` (`x Ps y, Bb{y Ps z}→Bb{x Ps z}`) → flip back. Same pattern for `Blb{i1 Ps j2}→Blb{i1 Ps j1}` given `j2 Ps j1`.
- **Arm Os/Ot reorder:** `swap-release-release` / `swap-temp-release` apply to **one arm at a time**. Swapping both Blb/Bb arms in a single hop does not justify; chain true-arm then false-arm (or vice versa).
- **Ps duplicate without R:** `identical-70` (`,i Ps j, → ,i Ps j, i Ps j,`) covers connectivity 202 s5/s9 where the context is `R(j2), R_(j1)` (mixed next/prev). Do not require `recursive-function-r-27` (both `R`) or `r-prev-32` (both `R_`) for that hop.
- **Non-adjacent Ps dup drop/add:** `identical-70` only touches an adjacent pair. To drop a distant copy: bubble it next to the kept copy (`r-22` / `r-prev-22` past `R`/`R_`, or other adjacent swaps), then drop. To add into a distant slot: `identical-70` adjacent first, then bubble the new copy into place.
- **Pull Os from `Bb{i Pu}`:** reverse `null-comparison-12` (`,m Os, Blb{i Pu}{,}{,} ↔ Blb{i Pu}{m Os}{m Os}`), not identical-15 (that is `Blb{i Ps j}`). The pulled `m Os` must land **immediately before** the Bb; then `swap-copy-release` (or similar) bubbles it next to `i Oc m` if the book wants that order.
- **Always re-extract before verify** after tex edits; stale `proof-steps-table.json` can omit newly inserted one-arm mids and re-fail solved hops.
- **Tc label typos** (e.g. `c_2` → `c_2a` mid-proof with no rule) are source errors, not missing axioms; normalize the name so the remaining hop is the real rewrite (here: insert `R(i_2)`).
- **Ps right-operand subst (108 s17):** want `i1 Ps j1 → i1 Ps j2` given `j1 Ps j2` while keeping the bridge. `identical-73` replaces the bridge with `i1 Ps j2` and keeps `i1 Ps j1` — wrong direction. Dup the bridge first (`identical-70`), apply `identical-73` on one copy, then still need a way to drop the leftover `i1 Ps j1` (open). Checker case-analysis / a dedicated right-operand subst rule remains a watchlist item.
- **Thm 202 statement uses mixed `R(i1), R_(j1)`** by design; duplicate-Ps under that mix is identical-70, not a missing mixed-R rule.
- **Thm 124 case-split / merge (implemented):** book arrows that drop/restore the outer `Oc`/`Os` shell together with focusing a `Bb{i Pu}` arm are accepted by `matchesCaseFocusOrMerge` in `engine/src/inferenceRules/caseFocus.ts` (via `matchesDerivedBbTransition` in `verify-all-chapters` / `verify-thm`). It checks that R equals one arm and leftover atoms pair as `create-copy` (`X Oc m`↔`m Os`), allowing an Os to pair with an Oc inside the kept arm. Case-switch (true-end → false-start) needs an explicit merge mid: restore shell+Bb with both final arms, then focus the false arm.
- **Thm 124 Ps/Os redistribute (implemented):** one book arrow that both pulls `i Ps i1` out of both `Bb{i Pu}` arms (reverse identical-29 / swap-65) and pushes `i1 Os` into both arms (null-12) cannot be serialized by adjacent swaps (Os cannot pass Bb). `matchesBbPsOsRedistribute` accepts that compound when arm bodies match after removing the moved atoms and outer multisets agree.

**Chapter 14 status (Rules_of_Node_Connectivity):** `passed=574 failed=0 parseFailures=0` via `verify-all-chapters.ts --chapter=Rules_of_Node_Connectivity` after re-extract. Fill patterns that cleared the last fails: Os bubble+identical-15; flip72; R/Oc push (`recursive-function-r-17` / identical Oc); identical-70 after bubble; bridge cleanup (fwd-73 + reverse copy-identical); R_ drop (prev-1 + reverse create-next-prev); case-focus/merge + Ps/Os redistribute derived checks; case-switch merge mid.
- **Thm 124 bridge cleanup (s54/s86):** after reverse-73 yields `i2 Ps j1`, drop scaffolding by: bubble+`identical-70` dedupe of `i Ps i1` and `i1 Ps i2` → adjacent fwd-73 (`i Ps i1, i1 Ps i2 → i Ps i1, i Ps i2`) → bubble `i Ps i2` next to `i Oc i2` (Oc before Ps) → reverse `copy-identical`.
- **Thm 124 drop `i1 On, i1 Op, R_(i1)` (s62):** bubble `R_(i1)` next to `i1 Pu` → `recursive-function-r-prev-1` drop `R_` → reverse `create-next-prev` drop adjacent `i1 On, i1 Op` → reorder. Skip empty-LHS create axioms when the expression grows (spurious); allow when it shrinks (true reverse).

Operators and relationships: 146 passed, 1 failed. Eight arrows are filled with earlier rules. Code that sits after a branch whose bottom arm is already `\Or` is distributed into both arms by Code Distribution, then Error Code deletes the copy that landed after `\Or`, leaving it in the top arm only. `i \On, j \On` is put back in front of that `\Or` by Error Absorbs Next, `i` first and then `j`. `i \On, i \Op` and `j \On, j \Op` are created inside one arm at a time. The long bottom-arm permutation swaps `i \Ps j` past `j \nPu` and `j \Ob t_2` by flipping the comparison, using the same-operand swap, and flipping back. `i \nPs j` moves past `j \Ob t_2` the same way. A rule may still be written with `\sim` or `~`. The checker and the expression parser read that shorthand as the operations on the other side that are not already written there. Theorem 25 therefore keeps both copies of `i \nPe j` when the preceding rule adds `i \nPs j`, and an earlier duplicate rule then drops one copy.

Operators and relationships: 148 passed, 0 failed. The Node id operator (`i \Od m ⟺ i \Od m, m \nPs j`) is stated in the connectivity chapter and is now citable before this chapter. On `::5::` it adds `t \nPs j`, and the identical-node symmetry rule flips that to `j \nPs t`.

Next-order induction: 38 passed, 0 failed. The eight open arrows in `::27::` and `::36::` are earlier rules, one site at a time. `\In \Ps i` swaps past `i_0 \Os`, then Release-Branch Distribution puts that release into both arms; the way back swaps the release to the front of each arm and pulls it out. `i \Ps i_0` flips to `i_0 \Ps i` on one arm, then the other, before the same-operand swap. The flag substitution `i \Ps j, \In \Ps i ⟺ i \Ps j, \In \Ps j` rewrites one arm, then the other. `i \Op` swaps past `i_0 \Os` and `i_0 \Op`. `i \Ps i_0` moves back beside `i \Oc i_0` and Copy Implies Identical deletes it.

Previous-order induction: 38 passed, 0 failed. The eight open arrows in `::27::` and `::36::` are the previous-order copies of the next-order fills. `\Ip \Ps i` swaps past `i_0 \Os` one arm at a time, then Release-Branch Distribution pulls that release out. `i \Ps i_0` flips to `i_0 \Ps i` on one arm, then the other, before the same-operand swap. The flag substitution `i \Ps j, \Ip \Ps i ⟺ i \Ps j, \Ip \Ps j` rewrites one arm, then the other. `i \On` swaps past `i_0 \Os` and `i_0 \On`. `i \Ps i_0` moves back beside `i \Oc i_0` and Copy Implies Identical deletes it.

Recursive function R, previous order: 151 passed, 0 failed. The proofs are the previous-order mirror of chapter 10: `R_(i)`, `\Ip`, `\Pp`, and `\Op` where chapter 10 has `R(i)`, `\In`, `\Pn`, and `\On`. A swap that still moves `j \On` cites the next-order swap, not an `\Op` theorem. `R_(i)` is added or removed in one arm at a time. `m \nPu` and `m \Pu` cross `R_(i)` by the previous-order swap. `i \Ps j` crosses `i \nPu` and `i \Op` by the same flip used in chapter 10.

Node ring: 187 passed, 0 failed. The filled arrows are earlier swaps, one neighbor at a time: `R_(j)` past copy, next, null, and release; `i \Ps j` past null and operators, flipping when the same-operand swap is the one that applies; the two nexts around `i \Ps i_0` by swapping the nexts, moving the comparison, and swapping the nexts back. The ring axiom moves the front `i \Ps j` to the end, so a kept front copy is the identical-node duplicate first. In theorem 5 the source had a single `t_0 \Os`. No earlier rule introduces that name. It is now `i_0 \Os`, which is release-next (`i \On, i \Os ⟺ i \Os`) and then `R(i), i \Os ⟺ i \Os`. The last arrow of theorem 5 adds `i_0 \Ps j` after `R_(j)`. `j \Ps i_0` is duplicated, the copy is flipped to `i_0 \Ps j`, and the node-ring axiom carries that copy across `i_0 \On, R(i_0), R_(j)`. The previous-order identical-node rule `,i \Ps j, R_(i), R_(j), ⟺ ,i \Ps j, R_(i), R_(j), i \Ps j,` needs `R_(i_0)` in the first slot. This line has `R(i_0)`, and neither that comparison nor `R_(i_0)` can pass `i_0 \On`.

Recursive function R: 151 passed, 0 failed. An induction proof is checked as two chains. The base case uses only earlier rules. The induction step may also use its hypothesis, which is an assumption of that proof and not a library rule. The hypothesis is applied by substitution, including when a flag such as `\In` sits in the same expression. A flag is the same token on both sides of that substitution; it is not a schematic operand. `\Ri` only separates the hypothesis from the induction step. `i \nPu` moves past `\In \Ps i` and past `j \On` or `R(j)` one neighbor at a time. `R(i)` is added inside one arm, then the other. `j \nPu` crosses `i \Ps j` by flipping the comparison, using the same-operand swap, and flipping back. Code after `\Bb{m \Pe n}{,}{,\Or,}` enters both arms by Code Distribution, and Error Code then drops the copy that landed after `\Or`.
