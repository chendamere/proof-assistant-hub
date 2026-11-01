import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import { usePanelContext } from '@/contexts/PanelContext';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { axioms } from '@/data/axioms';
import { normalizeSpacing } from '@engine/inferenceRules/utils';
import { normalizeOperands } from '@engine/operandNormalizer';
import { trySubstitutionByMatchPairs } from '@engine/inferenceRules/substitution';
import { checkInferenceRules } from '@engine/inferenceRules';
import { verifyTransitionWorker, type VerifyTransitionResult } from '@/lib/transitionVerificationWorkerClient';
import type { MatchInfo } from '@/workers/transitionVerificationWorker';
import type { DiagnosisResult } from '@engine/inferenceRules/errorDiagnosis';
// LLM diagnosis hidden for now. Re-enable: import { generateLLMDiagnosis } from '@engine/inferenceRules/llmDiagnosis';
import { definitions } from '@/data/definitions';
import { theorems } from '@/data/theorems';
import { earlyRulePosition } from '@/data/rulePosition';
import { useExpressionParseMode, type ExpressionParseMode } from '@/contexts/ExpressionParseContext';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronLeft, ChevronRight, FileText, ListOrdered, CheckCircle2, Check, X, AlertTriangle, Info, Plus, Trash2, CheckCheck, PlayCircle, Loader2, Download, Square, LocateFixed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  InductionProofView,
  InductionSchemaCard,
  type InductionDisplayData,
  type InductionProof,
} from '@/components/proof/InductionDisplay';

type ProofStepsTable = Record<string, string[]>;

/** Chapter order and book indices (1-based). */
const CHAPTER_ORDER: string[] = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison',
  'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand',
  'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction',
  'Recursive_Function_R',
  'Previous_Order_Induction',
  'Recursive_Function_R_Prev',
  'Rules_of_Node_Ring',
  'Rules_of_Node_Connectivity',
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
  'Tree_Order_Induction',
  'Recursive_Function_Rc',
  'Rules_of_Number_Equal_Relationship',
  'Rules_of_Number_More_Less_Than',
  'Rules_of_Assign_Operator_Temp_Space',
  'Axioms_of_Assign_Operator',
  'Theorems_of_Insert_Node_Function',
  'Theorems_of_Delete_Node_Function',
  'Theorems_of_Assign_Operator',
  'Function_Cpo',
  'Recursive_Function_Rcpo',
  'Addition',
  'Recursive_Function_Rcpm',
  'Multiplication',
  'Paradox',
];
/** Book chapter indices (1-based sequential). */
const CHAPTER_INDICES: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
];

function getChapterIndex(filename: string): number {
  const i = CHAPTER_ORDER.indexOf(filename);
  return i >= 0 ? CHAPTER_INDICES[i] ?? 999 : 999;
}

interface TheoremWithSteps {
  key: string;
  filename: string;
  index: number;
  ruleStr: string;
  steps: string[];
  ruleName?: string;
}

interface VerificationResult {
  passed: number;
  total: number;
}

type ProofStatus = 'proven' | 'failed' | 'open' | 'none';
type DisplaySort = 'book' | 'proven' | 'failed' | 'none';

/** Expression glyph size on this page (~50% larger than the prior 12/11 defaults). */
const EXPR_SIZE = 18;
const EXPR_SIZE_SM = 17;

const STATUS_LABEL: Record<ProofStatus, string> = {
  proven: 'Proven',
  failed: 'Failed',
  open: 'Not checked',
  none: 'No proofs',
};

const SORT_ORDER: Record<Exclude<DisplaySort, 'book'>, ProofStatus[]> = {
  proven: ['proven', 'failed', 'open', 'none'],
  failed: ['failed', 'proven', 'open', 'none'],
  none: ['none', 'proven', 'failed', 'open'],
};

function transitionCount(steps: string[], proofs: InductionProof[] | undefined): number {
  if (proofs && proofs.length > 0) {
    let count = 0;
    for (const proof of proofs) {
      if (proof.base.length >= 2) count += proof.base.length - 1;
      if (proof.then.length >= 2) count += proof.then.length - 1;
    }
    return count;
  }
  return steps.length >= 2 ? steps.length - 1 : 0;
}

function proofStatus(
  steps: string[],
  proofs: InductionProof[] | undefined,
  verification: VerificationResult | undefined
): ProofStatus {
  const count = transitionCount(steps, proofs);
  if (count === 0) return 'none';
  if (!verification || verification.total === 0) return 'open';
  if (verification.passed < verification.total) return 'failed';
  if (verification.passed === count && verification.total === count) return 'proven';
  return 'open';
}

/** True when the query contains an operator (\\Pe, \\Bb, \\Or, …), so operand names should be ignored. */
const OPERATOR_IN_QUERY = /\\[A-Za-z]+/;

function collapseWhitespace(expr: string): string {
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ',')
    .trim();
}

/** Replace operands with first-seen integers so i \\Pe j and m \\Pe n share the same search form. */
function operandNormalized(expr: string): string {
  const collapsed = collapseWhitespace(expr);
  if (!collapsed) return '';
  try {
    return collapseWhitespace(normalizeOperands(collapsed).integerExpression);
  } catch {
    return collapsed;
  }
}

function parseKey(key: string): { filename: string; index: number; ruleStr: string } {
  const parts = key.split('::');
  if (parts.length >= 3) {
    const filename = parts[0];
    const index = parseInt(parts[1], 10) || 0;
    const ruleStr = parts.slice(2).join('::');
    return { filename, index, ruleStr };
  }
  return { filename: key, index: 0, ruleStr: key };
}

function parseRuleOverride(ruleStr: string, id: string): { id: string; leftSide: string; rightSide: string } | undefined {
  const trimmed = ruleStr.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s*⟺\s*/);
  const left = parts[0]?.trim();
  const right = parts.slice(1).join('⟺').trim();
  if (!left || !right) return undefined;
  return { id, leftSide: left, rightSide: right };
}

/** Parse rule drag data from rules panel (application/json with leftSide, rightSide, draggedSide). */
function parseDroppedRule(e: React.DragEvent): { leftSide: string; rightSide: string; draggedSide?: 'left' | 'right' } | null {
  try {
    const json = e.dataTransfer.getData('application/json');
    if (!json) return null;
    const data = JSON.parse(json);
    if (data?.leftSide != null && data?.rightSide != null) return data;
  } catch {
    // ignore
  }
  return null;
}

const allRules = [...axioms, ...definitions, ...theorems];

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));

/**
 * Position for ordering: axioms/definitions = -1 (always before).
 * Theorem IDs in theorems.ts are 0-based; JSON/site keys are 1-based — add 1 so they align.
 */
function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1];
  const index = parseInt(m[2], 10) + 1; // 0-based id → 1-based site/JSON number
  const filename = CHAPTER_ORDER.find(
    (f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName
  );
  if (!filename) return 999999999;
  const chapterIdx = CHAPTER_ORDER.indexOf(filename);
  return chapterIdx * 100000 + index;
}

/** Position for a proof-steps key (Filename::index::...). */
function getPositionForKey(key: string): number {
  const { filename, index } = parseKey(key);
  const chapterIdx = CHAPTER_ORDER.indexOf(filename);
  if (chapterIdx < 0) return 999999999;
  return chapterIdx * 100000 + index;
}

/** Rules that appear before the given theorem key (for pattern sourcing). */
function getRulesBeforeKey(
  key: string,
  rules: Array<{ id: string; leftSide: string; rightSide: string }>
): Array<{ id: string; leftSide: string; rightSide: string }> {
  const theoremPos = getPositionForKey(key);
  return rules.filter((r) => {
    const pos = getPositionForRule(r);
    return pos < theoremPos;
  });
}

function ruleExistsInDatabase(leftSide: string, rightSide: string): boolean {
  const normLeft = normalizeSpacing(leftSide);
  const normRight = normalizeSpacing(rightSide);
  return allRules.some((r) => {
    const rLeft = normalizeSpacing(r.leftSide);
    const rRight = normalizeSpacing(r.rightSide);
    return (rLeft === normLeft && rRight === normRight) || (rLeft === normRight && rRight === normLeft);
  });
}

function getRuleNameForRuleStr(ruleStr: string): string | undefined {
  const parts = ruleStr.split(/\s*⟺\s*/);
  const left = parts[0]?.trim();
  const right = parts.slice(1).join('⟺').trim();
  if (!left || !right) return undefined;
  const normLeft = normalizeSpacing(left);
  const normRight = normalizeSpacing(right);
  const found = allRules.find((r) => {
    const rLeft = normalizeSpacing(r.leftSide);
    const rRight = normalizeSpacing(r.rightSide);
    return (rLeft === normLeft && rRight === normRight) || (rLeft === normRight && rRight === normLeft);
  });
  return found?.name;
}

const ProofSteps: React.FC = () => {
  const { isRulesPanelOpen } = usePanelContext();
  const { toast } = useToast();
  const { prepare, toBook, mode } = useExpressionParseMode();
  const [table, setTable] = useState<ProofStepsTable | null>(null);
  const [induction, setInduction] = useState<InductionDisplayData>({ schemas: [], proofs: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>('all');
  const [displaySort, setDisplaySort] = useState<DisplaySort>('book');
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [activeTheoremKey, setActiveTheoremKey] = useState<string | null>(null);
  const [transitionVerifying, setTransitionVerifying] = useState<string | null>(null);
  const [transitionResults, setTransitionResults] = useState<Record<string, Record<number, boolean>>>({});
  const [transitionMatchInfo, setTransitionMatchInfo] = useState<Record<string, Record<number, MatchInfo>>>({});
  const [transitionDiagnoses, setTransitionDiagnoses] = useState<Record<string, Record<number, DiagnosisResult>>>({});
  const [customTransitionVerifying, setCustomTransitionVerifying] = useState<string | null>(null);
  const [customTransitionResults, setCustomTransitionResults] = useState<Record<string, boolean>>({});
  /** Which theorem is currently verifying all transitions (theorem key). */
  const [theoremVerifyingAll, setTheoremVerifyingAll] = useState<string | null>(null);
  const theoremVerifyingAllRef = useRef<string | null>(null);
  const transitionVerifyingRef = useRef<string | null>(null);
  const chapterCheckingAllRef = useRef(false);
  /** Bumped on Stop / chapter change so in-flight Check all runs become stale and cannot resume. */
  const chapterCheckRunIdRef = useRef(0);
  /** Per-transition optional rule override (key: transitionId or customId). Separate left/right fields. */
  const [customRuleInputs, setCustomRuleInputs] = useState<Record<string, { left: string; right: string }>>({});
  /** Error when user-entered rule is not in database (key: transitionId or customId). */
  const [ruleValidationError, setRuleValidationError] = useState<Record<string, string>>({});

  const rulesForWorker = useMemo(
    () =>
      [...axioms, ...definitions, ...theorems].map((r) => ({
        id: r.id,
        leftSide: r.leftSide,
        rightSide: r.rightSide,
      })),
    []
  );

  useEffect(() => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
    fetch(`${base}induction-display.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InductionDisplayData | null) => {
        if (data?.schemas && data?.proofs) setInduction(data);
      })
      .catch(() => { /* the chapter still lists ordinary proofs */ });
    fetch(`${base}proof-steps-table.json`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load proof steps data');
        return res.json();
      })
      .then((data: ProofStepsTable) => {
        setTable(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Could not load proof steps. Run: node scripts/extract-proof-steps.js');
        console.error('error loading proof steps data:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const verifySingleTransition = React.useCallback(
    async (key: string, transitionIndex: number, ruleOverride?: string) => {
      const transitionId = `${key}::${transitionIndex}`;
      if (transitionVerifyingRef.current || theoremVerifyingAllRef.current) return;
      const steps = table?.[key];
      if (!steps || transitionIndex < 0 || transitionIndex >= steps.length - 1) return;
      transitionVerifyingRef.current = transitionId;
      setTransitionVerifying(transitionId);
      const left = steps[transitionIndex];
      const right = steps[transitionIndex + 1];
      if (left != null && right != null && normalizeSpacing(left) === normalizeSpacing(right)) {
        const matchInfo: MatchInfo = {
          matchedRuleId: 'spacing',
          description: 'Same expression after spacing is normalized',
          ruleLeft: left,
          ruleRight: right,
          inferenceRuleName: 'Spacing',
        };
        setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: true } }));
        setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: matchInfo } }));
        transitionVerifyingRef.current = null;
        setTransitionVerifying(null);
        return;
      }
      const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${key}-override`);
      if (parsedOverride && !ruleExistsInDatabase(toBook(parsedOverride.leftSide), toBook(parsedOverride.rightSide))) {
        setRuleValidationError((prev) => ({ ...prev, [transitionId]: 'Rule not found in database' }));
        transitionVerifyingRef.current = null;
        setTransitionVerifying(null);
        return;
      }
      setRuleValidationError((prev) => {
        const next = { ...prev };
        delete next[transitionId];
        return next;
      });
      const preferredRule =
        parsedOverride ??
        (() => {
          const { ruleStr } = parseKey(key);
          const ruleParts = ruleStr.split(/\s*⟺\s*/);
          return ruleParts[0]?.trim() && ruleParts.slice(1).join('⟺').trim()
            ? { id: key, leftSide: ruleParts[0].trim(), rightSide: ruleParts.slice(1).join('⟺').trim() }
            : undefined;
        })();

      // Only try preferred rule if it's not the current theorem (can't use a theorem to prove itself)
      const preferredRuleIsCurrentTheorem =
        preferredRule &&
        !parsedOverride &&
        (() => {
          const { ruleStr } = parseKey(key);
          const [pLeft, pRight] = [preferredRule.leftSide, preferredRule.rightSide].map(normalizeSpacing);
          const [kLeft, kRight] = ruleStr
            .split(/\s*⟺\s*/)
            .map((s) => normalizeSpacing(s.trim()));
          return (pLeft === kLeft && pRight === kRight) || (pLeft === kRight && pRight === kLeft);
        })();

      const rulesToUse = getRulesBeforeKey(key, rulesForWorker);

      // Try preferred rule with trySubstitutionByMatchPairs (handles both pair directions)
      if (preferredRule && !preferredRuleIsCurrentTheorem) {
        try {
          const ruleLeftForCheck = parsedOverride ? prepare(preferredRule.leftSide) : preferredRule.leftSide;
          const ruleRightForCheck = parsedOverride ? prepare(preferredRule.rightSide) : preferredRule.rightSide;
          const r = trySubstitutionByMatchPairs(left, right, ruleLeftForCheck, ruleRightForCheck, undefined);
          if (r?.match && r.reconstructedExpr != null) {
            const pos = r.position;
            const matchInfo: MatchInfo = {
              matchedRuleId: preferredRule.id,
              description: pos?.description,
              startPosition: pos?.position,
              side: pos?.side,
              ruleLeft: parsedOverride ? toBook(preferredRule.leftSide) : preferredRule.leftSide,
              ruleRight: parsedOverride ? toBook(preferredRule.rightSide) : preferredRule.rightSide,
              instantiatedPatternLeft: pos?.instantiatedPatternLeft,
              instantiatedPatternRight: pos?.instantiatedPatternRight,
              inferenceRuleName: 'Equivalent Substitution',
              nodeMap: pos?.nodeMapping ? Object.fromEntries(pos.nodeMapping) : undefined,
              unmatchedTargetNodeSignatures: pos?.unmatchedTargetNodeSignatures,
              tcMapping: pos?.tcMapping,
            };
            setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: true } }));
            setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: matchInfo } }));
            transitionVerifyingRef.current = null;
            setTransitionVerifying(null);
            return;
          }
        } catch {
          // fall through to worker
        }
      }

      try {
        const result: VerifyTransitionResult = await verifyTransitionWorker({
          targetLeft: left,
          targetRight: right,
          rules: rulesToUse,
        });
        setTransitionResults((prev) => ({
          ...prev,
          [key]: { ...prev[key], [transitionIndex]: result.matched },
        }));
        if (result.matched && result.matchInfo) {
          setTransitionMatchInfo((prev) => ({
            ...prev,
            [key]: { ...prev[key], [transitionIndex]: result.matchInfo! },
          }));
        } else if (!result.matched) {
          setTransitionMatchInfo((prev) => {
            const keyData = prev[key];
            if (!keyData || !(transitionIndex in keyData)) return prev;
            const nextKey = { ...keyData };
            delete nextKey[transitionIndex];
            return { ...prev, [key]: nextKey };
          });
        }
        if (result.diagnosis) {
          const diagnosis = result.diagnosis;
          setTransitionDiagnoses((prev) => ({
            ...prev,
            [key]: { ...prev[key], [transitionIndex]: diagnosis },
          }));
          // LLM diagnosis disabled by default. Set VITE_ENABLE_LLM_DIAGNOSIS=true to enable.
          // Fetch LLM diagnosis (Ollama/Llama) in background
          // generateLLMDiagnosis(left, right, diagnosis)
          //   .then((llmResult) => {
          //     setTransitionDiagnoses((prev) => {
          //       const current = prev[key]?.[transitionIndex];
          //       if (!current) return prev;
          //       return {
          //         ...prev,
          //         [key]: {
          //           ...prev[key],
          //           [transitionIndex]: { ...current, llmDiagnosis: llmResult },
          //         },
          //       };
          //     });
          //   })
          //   .catch(() => { /* ignore LLM errors */ });
        }
      } catch (err) {
        // Infrastructure errors (e.g. worker cold start) are not match failures.
        // Leave the result unset so the UI does not show a false ❌.
        console.error('Transition verification error:', err);
      } finally {
        transitionVerifyingRef.current = null;
        setTransitionVerifying(null);
      }
    },
    [table, rulesForWorker, prepare, toBook]
  );

  const verifyCustomTransition = React.useCallback(
    async (customId: string, left: string, right: string, ruleOverride?: string) => {
      if (customTransitionVerifying) return;
      const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${customId}-override`);
      if (parsedOverride && !ruleExistsInDatabase(toBook(parsedOverride.leftSide), toBook(parsedOverride.rightSide))) {
        setRuleValidationError((prev) => ({ ...prev, [customId]: 'Rule not found in database' }));
        return;
      }
      setRuleValidationError((prev) => {
        const next = { ...prev };
        delete next[customId];
        return next;
      });
      setCustomTransitionVerifying(customId);
      const preferredRule = parsedOverride;

      // Extract theorem key from customId (e.g. "key::0::insert" -> "key") for rule filtering
      const theoremKey = customId.replace(/::\d+::(?:insert|insert-above)$/, '');
      const rulesToUse = getRulesBeforeKey(theoremKey, rulesForWorker);

      if (preferredRule) {
        try {
          const r = trySubstitutionByMatchPairs(left, right, prepare(preferredRule.leftSide), prepare(preferredRule.rightSide), undefined);
          if (r?.match && r.reconstructedExpr != null) {
            setCustomTransitionResults((prev) => ({ ...prev, [customId]: true }));
            setCustomTransitionVerifying(null);
            return;
          }
        } catch {
          // fall through to worker
        }
      }

      try {
        const result: VerifyTransitionResult = await verifyTransitionWorker({
          targetLeft: left,
          targetRight: right,
          rules: rulesToUse,
        });
        setCustomTransitionResults((prev) => ({ ...prev, [customId]: result.matched }));
      } catch (err) {
        // Infrastructure errors are not match failures; leave result unset.
        console.error('Custom transition verification error:', err);
      } finally {
        setCustomTransitionVerifying(null);
      }
    },
    [customTransitionVerifying, rulesForWorker, prepare, toBook]
  );

  const verifyAllTransitions = React.useCallback(
    async (key: string, runId?: number): Promise<Record<number, boolean>> => {
      if (theoremVerifyingAllRef.current || transitionVerifyingRef.current) return {};
      const isStale = () => runId != null && chapterCheckRunIdRef.current !== runId;
      const steps = table?.[key];
      const proofs = induction.proofs[key] ?? [];
      const pairs: Array<{ left: string; right: string; hypothesis: { left: string; right: string } | null }> = [];
      if (proofs.length > 0) {
        for (const proof of proofs) {
          for (let i = 0; i < proof.base.length - 1; i++) {
            pairs.push({ left: proof.base[i]!, right: proof.base[i + 1]!, hypothesis: null });
          }
          const hyp =
            proof.hypothesis?.left && proof.hypothesis.right
              ? { left: proof.hypothesis.left, right: proof.hypothesis.right }
              : null;
          for (let i = 0; i < proof.then.length - 1; i++) {
            pairs.push({ left: proof.then[i]!, right: proof.then[i + 1]!, hypothesis: hyp });
          }
        }
      } else if (steps && steps.length >= 2) {
        for (let i = 0; i < steps.length - 1; i++) {
          pairs.push({ left: steps[i]!, right: steps[i + 1]!, hypothesis: null });
        }
      }
      if (pairs.length === 0) return {};

      theoremVerifyingAllRef.current = key;
      setTheoremVerifyingAll(key);
      const results: Record<number, boolean> = {};
      const rulesToUse = getRulesBeforeKey(key, rulesForWorker);

      try {
        // Let the spinner paint before the first rule index is built.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
        if (isStale()) return results;

        // Induction proofs are two chains. The hypothesis is an assumption of the
        // induction step, not a step between the base case and the conclusion.
        for (let i = 0; i < pairs.length; i++) {
          if (isStale()) break;
          const transitionId = `${key}::${i}`;
          const left = pairs[i]!.left;
          const right = pairs[i]!.right;
          if (left != null && right != null && normalizeSpacing(left) === normalizeSpacing(right)) {
            results[i] = true;
            const matchInfo: MatchInfo = {
              matchedRuleId: 'spacing',
              description: 'Same expression after spacing is normalized',
              ruleLeft: left,
              ruleRight: right,
              inferenceRuleName: 'Spacing',
            };
            setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [i]: true } }));
            setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [i]: matchInfo } }));
            continue;
          }
          
          // Check if there's a custom rule override for this transition
          const ruleOverride = (() => {
            const r = customRuleInputs[transitionId];
            return (r?.left?.trim() && r?.right?.trim()) ? `${r.left.trim()} ⟺ ${r.right.trim()}` : undefined;
          })();
          
          const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${key}-override`);
          if (parsedOverride && !ruleExistsInDatabase(toBook(parsedOverride.leftSide), toBook(parsedOverride.rightSide))) {
            setRuleValidationError((prev) => ({ ...prev, [transitionId]: 'Rule not found in database' }));
            results[i] = false;
            setTransitionResults((prev) => ({
              ...prev,
              [key]: { ...prev[key], [i]: false },
            }));
            continue;
          }
          setRuleValidationError((prev) => {
            if (!(transitionId in prev)) return prev;
            const next = { ...prev };
            delete next[transitionId];
            return next;
          });

          const preferredRule =
            parsedOverride ??
            (() => {
              const { ruleStr } = parseKey(key);
              const ruleParts = ruleStr.split(/\s*⟺\s*/);
              return ruleParts[0]?.trim() && ruleParts.slice(1).join('⟺').trim()
                ? { id: key, leftSide: ruleParts[0].trim(), rightSide: ruleParts.slice(1).join('⟺').trim() }
                : undefined;
            })();

          const preferredRuleIsCurrentTheorem =
            preferredRule &&
            !parsedOverride &&
            (() => {
              const { ruleStr } = parseKey(key);
              const [pLeft, pRight] = [preferredRule.leftSide, preferredRule.rightSide].map(normalizeSpacing);
              const [kLeft, kRight] = ruleStr
                .split(/\s*⟺\s*/)
                .map((s) => normalizeSpacing(s.trim()));
              return (pLeft === kLeft && pRight === kRight) || (pLeft === kRight && pRight === kLeft);
            })();

          let matched = false;
          const hypothesis = pairs[i]!.hypothesis;
          if (hypothesis) {
            try {
              const hypResult = checkInferenceRules(left, right, hypothesis.left, hypothesis.right);
              if (hypResult.match && (hypResult.matchPosition?.instantiatedPatternLeft ?? hypothesis.left).trim()) {
                const matchInfo: MatchInfo = {
                  matchedRuleId: 'induction-hypothesis',
                  description: 'Induction hypothesis, used only inside this induction step',
                  ruleLeft: hypothesis.left,
                  ruleRight: hypothesis.right,
                  instantiatedPatternLeft: hypResult.matchPosition?.instantiatedPatternLeft,
                  instantiatedPatternRight: hypResult.matchPosition?.instantiatedPatternRight,
                  inferenceRuleName: hypResult.inferenceRule,
                };
                results[i] = true;
                setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [i]: true } }));
                setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [i]: matchInfo } }));
                matched = true;
              }
            } catch {
              // fall through to the library rules
            }
          }

          // Try preferred rule first (same as verifySingleTransition)
          if (preferredRule && !preferredRuleIsCurrentTheorem) {
            try {
              const ruleLeftForCheck = parsedOverride ? prepare(preferredRule.leftSide) : preferredRule.leftSide;
              const ruleRightForCheck = parsedOverride ? prepare(preferredRule.rightSide) : preferredRule.rightSide;
              const r = trySubstitutionByMatchPairs(left, right, ruleLeftForCheck, ruleRightForCheck, undefined);
              if (r?.match && r.reconstructedExpr != null) {
                const pos = r.position;
                const matchInfo: MatchInfo = {
                  matchedRuleId: preferredRule.id,
                  description: pos?.description,
                  startPosition: pos?.position,
                  side: pos?.side,
                  ruleLeft: parsedOverride ? toBook(preferredRule.leftSide) : preferredRule.leftSide,
                  ruleRight: parsedOverride ? toBook(preferredRule.rightSide) : preferredRule.rightSide,
                  instantiatedPatternLeft: pos?.instantiatedPatternLeft,
                  instantiatedPatternRight: pos?.instantiatedPatternRight,
                  inferenceRuleName: 'Equivalent Substitution',
                  nodeMap: pos?.nodeMapping ? Object.fromEntries(pos.nodeMapping) : undefined,
                  unmatchedTargetNodeSignatures: pos?.unmatchedTargetNodeSignatures,
                  tcMapping: pos?.tcMapping,
                };
                results[i] = true;
                setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [i]: true } }));
                setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [i]: matchInfo } }));
                matched = true;
              }
            } catch {
              // fall through to worker
            }
          }
          
          // If preferred rule didn't match, try worker
          if (!matched) {
            try {
              const result: VerifyTransitionResult = await verifyTransitionWorker({
                targetLeft: left,
                targetRight: right,
                rules: rulesToUse,
              });
              results[i] = result.matched;
              setTransitionResults((prev) => ({
                ...prev,
                [key]: { ...prev[key], [i]: result.matched },
              }));
              if (result.matched && result.matchInfo) {
                setTransitionMatchInfo((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], [i]: result.matchInfo! },
                }));
              } else if (!result.matched) {
                setTransitionMatchInfo((prev) => {
                  const keyData = prev[key];
                  if (!keyData || !(i in keyData)) return prev;
                  const nextKey = { ...keyData };
                  delete nextKey[i];
                  return { ...prev, [key]: nextKey };
                });
              }
              if (result.diagnosis) {
                setTransitionDiagnoses((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], [i]: result.diagnosis },
                }));
              }
            } catch (err) {
              // Infrastructure errors are not match failures; leave result unset.
              console.error(`Transition ${i} verification error:`, err);
            }
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        }
        return results;
      } finally {
        theoremVerifyingAllRef.current = null;
        setTheoremVerifyingAll(null);
      }
    },
    [table, induction, rulesForWorker, customRuleInputs, prepare, toBook]
  );

  const [chapterCheckingAll, setChapterCheckingAll] = useState(false);

  const stopChapterCheck = React.useCallback(() => {
    chapterCheckRunIdRef.current += 1;
    chapterCheckingAllRef.current = false;
    setChapterCheckingAll(false);
    theoremVerifyingAllRef.current = null;
    setTheoremVerifyingAll(null);
  }, []);

  const handleInsertStep = React.useCallback((key: string, insertAtIndex: number, newExpr: string) => {
    setTable((prev) => {
      if (!prev || !prev[key]) return prev;
      const steps = [...prev[key]];
      steps.splice(insertAtIndex, 0, newExpr);
      return { ...prev, [key]: steps };
    });
  }, []);

  const handleDeleteStep = React.useCallback((key: string, stepIndex: number) => {
    setTable((prev) => {
      if (!prev || !prev[key]) return prev;
      const steps = prev[key].filter((_, idx) => idx !== stepIndex);
      return { ...prev, [key]: steps };
    });
  }, []);

  useEffect(() => {
    stopChapterCheck();
    setTransitionResults({});
    setTransitionMatchInfo({});
    setTransitionDiagnoses({});
    setCustomTransitionResults({});
    setActiveTheoremKey(null);
    const viewport = listScrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (viewport) viewport.scrollTop = 0;
  }, [chapter, stopChapterCheck]);

  const scrollToTheorem = React.useCallback((key: string, behavior: ScrollBehavior = 'smooth') => {
    const viewport = listScrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    const el = viewport?.querySelector(`[data-theorem-key="${CSS.escape(key)}"]`) as HTMLElement | null;
    if (!el || !viewport) return;
    const delta = el.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    viewport.scrollTo({ top: Math.max(0, viewport.scrollTop + delta - 8), behavior });
    setActiveTheoremKey(key);
  }, []);

  const verificationCache = useRef<Record<string, VerificationResult>>({});
  const verificationResults = React.useMemo(() => {
    const prev = verificationCache.current;
    const out: Record<string, VerificationResult> = {};
    for (const [key, results] of Object.entries(transitionResults)) {
      const indices = Object.keys(results);
      if (indices.length === 0) continue;
      let passed = 0;
      for (const index of indices) {
        if (results[Number(index)] === true) passed++;
      }
      const total = indices.length;
      const old = prev[key];
      out[key] = old && old.passed === passed && old.total === total ? old : { passed, total };
    }
    verificationCache.current = out;
    return out;
  }, [transitionResults]);

  /** All theorems from the table, including those with no proof steps (e.g. chapter 2 definitions). */
  const theoremsWithSteps: TheoremWithSteps[] = React.useMemo(() => {
    if (!table) return [];
    return Object.entries(table)
      .map(([key, steps]) => {
        const { filename, index, ruleStr } = parseKey(key);
        return { key, filename, index, ruleStr, steps: steps ?? [], ruleName: getRuleNameForRuleStr(ruleStr) };
      })
      .sort((a, b) => {
        const cmp = getChapterIndex(a.filename) - getChapterIndex(b.filename);
        if (cmp !== 0) return cmp;
        return a.index - b.index;
      });
  }, [table]);

  /** Chapters in book order (CHAPTER_ORDER), including chapters that only have empty proofs. */
  const chapters = React.useMemo(() => {
    const present = new Set(theoremsWithSteps.map((t) => t.filename));
    return CHAPTER_ORDER.filter((ch) => present.has(ch));
  }, [theoremsWithSteps]);

  /** Book chapter index as on the site (1 = Operators, 2 = Three Fundamental Relationships, …). */
  const chapterDisplayIndex = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of chapters) map[ch] = getChapterIndex(ch);
    return map;
  }, [chapters]);

  /** Operand-normalized rule and proof steps, keyed by theorem, for structural search. */
  const normalizedContent = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of theoremsWithSteps) {
      map.set(t.key, [t.ruleStr, ...t.steps].map(operandNormalized));
    }
    return map;
  }, [theoremsWithSteps]);

  const filtered = React.useMemo(() => {
    let list = theoremsWithSteps;
    if (chapter !== 'all') {
      list = list.filter((t) => t.filename === chapter);
    }
    const qRaw = search.trim();
    if (qRaw) {
      const q = qRaw.toLowerCase();
      const structural = OPERATOR_IN_QUERY.test(qRaw) ? operandNormalized(qRaw) : '';
      list = list.filter((t) => {
        if (
          t.filename.toLowerCase().includes(q) ||
          t.ruleStr.toLowerCase().includes(q) ||
          (t.ruleName?.toLowerCase().includes(q) ?? false) ||
          t.steps.some((step) => step.toLowerCase().includes(q))
        ) {
          return true;
        }
        if (!structural) return false;
        const forms = normalizedContent.get(t.key);
        return forms?.some((form) => form.includes(structural)) ?? false;
      });
    }
    return list;
  }, [theoremsWithSteps, chapter, search, normalizedContent]);

  const checkAllProofStepsInChapter = React.useCallback(async () => {
    if (chapter === 'all' || chapterCheckingAllRef.current || theoremVerifyingAllRef.current || transitionVerifyingRef.current) return;
    const toCheck = filtered.filter((t) => (table?.[t.key]?.length ?? 0) >= 2);
    if (toCheck.length === 0) return;
    const runId = ++chapterCheckRunIdRef.current;
    chapterCheckingAllRef.current = true;
    setChapterCheckingAll(true);
    // Fresh run from the first theorem — clear prior chapter results so Stop cannot "resume"
    const keys = new Set(toCheck.map((t) => t.key));
    setTransitionResults((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setTransitionMatchInfo((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setTransitionDiagnoses((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    const viewport = listScrollRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (viewport) viewport.scrollTop = 0;
    if (toCheck[0]) setActiveTheoremKey(toCheck[0].key);

    try {
      let theoremsWithFailures = 0;
      for (const t of toCheck) {
        if (chapterCheckRunIdRef.current !== runId) break;
        const results = await verifyAllTransitions(t.key, runId);
        if (chapterCheckRunIdRef.current !== runId) break;
        const hasFailure = Object.values(results).some((v) => v === false);
        if (hasFailure) theoremsWithFailures++;
      }
      // Only toast on a finished run — stop/chapter-switch must not overlay the toolbar
      if (chapterCheckRunIdRef.current === runId) {
        if (theoremsWithFailures > 0) {
          toast({
            title: 'Check complete',
            description: `${theoremsWithFailures} of ${toCheck.length} theorem(s) contain failing step(s).`,
            variant: 'default',
          });
        } else {
          toast({
            title: 'Check complete',
            description: `All ${toCheck.length} theorems verified successfully.`,
            variant: 'default',
          });
        }
      }
    } finally {
      if (chapterCheckRunIdRef.current === runId) {
        chapterCheckingAllRef.current = false;
        setChapterCheckingAll(false);
      }
    }
  }, [chapter, filtered, table, verifyAllTransitions, toast]);

  const downloadChapterResults = React.useCallback(() => {
    if (chapter === 'all') return;
    const results: Array<{
      key: string;
      ruleStr: string;
      ruleName?: string;
      steps: string[];
      transitions: Array<{
        index: number;
        left: string;
        right: string;
        matched: boolean;
        patternLeft?: string;
        patternRight?: string;
        tcMapping?: Record<string, string[]>;
      }>;
    }> = [];
    for (const t of filtered) {
      const steps = table?.[t.key] ?? [];
      const transitions: (typeof results)[0]['transitions'] = [];
      for (let i = 0; i < steps.length - 1; i++) {
        const left = steps[i] ?? '';
        const right = steps[i + 1] ?? '';
        const matched = transitionResults[t.key]?.[i] === true;
        const matchInfo = transitionMatchInfo[t.key]?.[i];
        transitions.push({
          index: i,
          left,
          right,
          matched,
          patternLeft: matchInfo?.ruleLeft,
          patternRight: matchInfo?.ruleRight,
          tcMapping: matchInfo?.tcMapping,
        });
      }
      results.push({ key: t.key, ruleStr: t.ruleStr, ruleName: t.ruleName, steps, transitions });
    }
    const blob = new Blob([JSON.stringify({ chapter, theorems: results }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proof-steps-${chapter.replace(/[^a-z0-9]+/gi, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [chapter, filtered, table, transitionResults, transitionMatchInfo]);

  const statusFor = React.useCallback(
    (theorem: TheoremWithSteps): ProofStatus =>
      proofStatus(theorem.steps, induction.proofs[theorem.key], verificationResults[theorem.key]),
    [induction.proofs, verificationResults]
  );

  const groupedByChapter = React.useMemo(() => {
    const groups: Record<string, TheoremWithSteps[]> = {};
    for (const t of filtered) {
      if (!groups[t.filename]) groups[t.filename] = [];
      groups[t.filename].push(t);
    }
    if (displaySort !== 'book') {
      const order = SORT_ORDER[displaySort];
      for (const name of Object.keys(groups)) {
        groups[name].sort((a, b) => {
          const rankA = order.indexOf(statusFor(a));
          const rankB = order.indexOf(statusFor(b));
          if (rankA !== rankB) return rankA - rankB;
          return a.index - b.index;
        });
      }
    }
    return Object.entries(groups).sort(
      ([a], [b]) => getChapterIndex(a) - getChapterIndex(b)
    );
  }, [filtered, displaySort, statusFor]);

  /** Theorem # as on the site: 1-based index within the chapter (same as JSON key ::N::). */
  const theoremDisplayNumber = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of theoremsWithSteps) {
      map[t.key] = t.index;
    }
    return map;
  }, [theoremsWithSteps]);

  const chapterTheorems = React.useMemo(() => {
    if (chapter === 'all') return [] as TheoremWithSteps[];
    return groupedByChapter.find(([name]) => name === chapter)?.[1] ?? [];
  }, [chapter, groupedByChapter]);

  // Track active theorem + one-wheel-step = one theorem (height-independent)
  useEffect(() => {
    if (chapter === 'all' || chapterTheorems.length === 0) return;
    let viewport: HTMLElement | null = null;
    let raf = 0;
    let locked = false;
    let unlockTimer = 0;
    let acc = 0;

    const theoremNodes = () =>
      Array.from(viewport?.querySelectorAll<HTMLElement>('[data-theorem-key]') ?? []);

    const indexAtTop = () => {
      const nodes = theoremNodes();
      if (nodes.length === 0 || !viewport) return 0;
      const line = viewport.getBoundingClientRect().top + 32;
      let idx = 0;
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i]!.getBoundingClientRect().top <= line) idx = i;
        else break;
      }
      return idx;
    };

    const updateActive = () => {
      const nodes = theoremNodes();
      if (nodes.length === 0) return;
      const key = nodes[indexAtTop()]!.getAttribute('data-theorem-key');
      if (key) setActiveTheoremKey((prev) => (prev === key ? prev : key));
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActive);
    };

    const onWheel = (e: WheelEvent) => {
      if (!viewport) return;
      e.preventDefault();
      if (locked) return;
      // Normalize mouse notches vs trackpad pixel deltas
      const step = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      acc += step;
      if (Math.abs(acc) < 24) return;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      const nodes = theoremNodes();
      const next = nodes[indexAtTop() + dir];
      if (!next) return;
      const key = next.getAttribute('data-theorem-key');
      if (!key) return;
      locked = true;
      scrollToTheorem(key, 'auto');
      window.clearTimeout(unlockTimer);
      unlockTimer = window.setTimeout(() => {
        locked = false;
      }, 280);
    };

    const timer = window.setTimeout(() => {
      viewport = listScrollRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;
      if (!viewport) return;
      viewport.addEventListener('scroll', onScroll, { passive: true });
      viewport.addEventListener('wheel', onWheel, { passive: false });
      updateActive();
    }, 50);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(unlockTimer);
      if (raf) cancelAnimationFrame(raf);
      viewport?.removeEventListener('scroll', onScroll);
      viewport?.removeEventListener('wheel', onWheel);
    };
  }, [chapter, chapterTheorems, scrollToTheorem]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-center py-24">
            <p className="text-muted-foreground">Loading proof steps...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 pt-24 pb-12 px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="border-destructive/50">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Generate the data by running <code className="px-1.5 py-0.5 rounded bg-muted">node scripts/extract-proof-steps.js</code> and ensure <code className="px-1.5 py-0.5 rounded bg-muted">proof-steps-table.json</code> is in the <code className="px-1.5 py-0.5 rounded bg-muted">public/</code> folder.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const renderTheoremList = (theorems: TheoremWithSteps[]) =>
    theorems.map((t, theoremIndex) => {
      const status = displaySort === 'book' ? null : statusFor(t);
      const previous = status != null && theoremIndex > 0 ? statusFor(theorems[theoremIndex - 1]!) : null;
      const showHeading = status != null && status !== previous;
      const headingCount = showHeading
        ? theorems.filter((item) => statusFor(item) === status).length
        : 0;
      return (
        <React.Fragment key={t.key}>
          {showHeading && status != null && (
            <div className="pt-2 text-xs font-medium text-muted-foreground">
              {STATUS_LABEL[status]}
              <span className="ml-1.5 tabular-nums">{headingCount}</span>
            </div>
          )}
          <div data-theorem-key={t.key}>
            <TheoremCard
              theorem={t}
              inductionProofs={induction.proofs[t.key]}
              theoremNumber={theoremDisplayNumber[t.key]}
              parseMode={mode}
              verification={verificationResults[t.key]}
              transitionMatchInfo={transitionMatchInfo[t.key]}
              onVerifyTransition={verifySingleTransition}
              onVerifyAllTransitions={verifyAllTransitions}
              onVerifyCustomTransition={verifyCustomTransition}
              onInsertStep={handleInsertStep}
              onDeleteStep={handleDeleteStep}
              transitionVerifying={transitionVerifying}
              verifyingThis={theoremVerifyingAll === t.key}
              checksLocked={chapterCheckingAll || theoremVerifyingAll !== null || transitionVerifying !== null}
              customTransitionVerifying={customTransitionVerifying}
              transitionResults={transitionResults[t.key]}
              customTransitionResults={customTransitionResults}
              transitionDiagnoses={transitionDiagnoses[t.key]}
              customRuleInputs={customRuleInputs}
              setCustomRuleInputs={setCustomRuleInputs}
              ruleValidationError={ruleValidationError}
              setRuleValidationError={setRuleValidationError}
            />
          </div>
        </React.Fragment>
      );
    });

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-background">
      <Navigation />
      <RulesSidePanel />
      <main
        className="flex-1 min-h-0 flex flex-col pt-24 px-6 transition-all duration-300"
        style={{
          marginRight: isRulesPanelOpen ? '380px' : '0',
        }}
      >
        <div className="max-w-7xl mx-auto w-full flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 mb-3 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              This page is under development. Features may be incomplete or change without notice.
            </p>
          </div>
          <div className="shrink-0 mb-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Theorems with Proof Steps
            </h1>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename, rule, or proof content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={chapter} onValueChange={setChapter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All chapters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chapters</SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {chapterDisplayIndex[ch]}. {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={displaySort} onValueChange={(value) => setDisplaySort(value as DisplaySort)}>
              <SelectTrigger className="w-full sm:w-[200px]" aria-label="Sort theorems">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="book">Book order</SelectItem>
                <SelectItem value="proven">Proven first</SelectItem>
                <SelectItem value="failed">Failed first</SelectItem>
                <SelectItem value="none">No proofs first</SelectItem>
              </SelectContent>
            </Select>
            {chapter !== 'all' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-[7.5rem]"
                  onClick={chapterCheckingAll ? stopChapterCheck : checkAllProofStepsInChapter}
                  disabled={
                    !chapterCheckingAll &&
                    (!!theoremVerifyingAll ||
                      !!transitionVerifying ||
                      filtered.filter((t) => (table?.[t.key]?.length ?? 0) >= 2).length === 0)
                  }
                >
                  {chapterCheckingAll ? (
                    <>
                      <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <CheckCheck className="h-4 w-4 mr-1.5" />
                      Check all
                    </>
                  )}
                </Button>
                {chapterCheckingAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (theoremVerifyingAll) scrollToTheorem(theoremVerifyingAll, 'smooth');
                    }}
                    disabled={!theoremVerifyingAll}
                  >
                    <LocateFixed className="h-4 w-4 mr-1.5" />
                    Jump to current
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadChapterResults}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download
                </Button>
              </div>
            )}
          </div>

          {chapter !== 'all' &&
            groupedByChapter.map(([chapterName, theorems]) => (
              <div
                key={`hdr-${chapterName}`}
                className="shrink-0 mb-3 flex items-center gap-2 flex-wrap px-1 py-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1"
                  onClick={() => setChapter('all')}
                >
                  <ChevronLeft className="h-4 w-4" />
                  All chapters
                </Button>
                <span className="font-semibold text-sm">
                  {chapterDisplayIndex[chapterName] != null ? `Ch. ${chapterDisplayIndex[chapterName]}: ` : ''}
                  {chapterName.replace(/_/g, ' ')}
                </span>
                <Badge variant="secondary" className="text-xs">{theorems.length}</Badge>
              </div>
            ))}

          <div className="flex flex-1 min-h-0 gap-2">
            {chapter !== 'all' && chapterTheorems.length > 0 && (
              <TheoremMinimap
                theorems={chapterTheorems}
                statusFor={statusFor}
                activeKey={activeTheoremKey}
                theoremNumber={theoremDisplayNumber}
                onSelect={scrollToTheorem}
              />
            )}
            <ScrollArea ref={listScrollRef} className="flex-1 min-h-0">
              <div className="space-y-6 pr-4 pb-4">
                {chapter === 'all' ? (
                  groupedByChapter.map(([chapterName, theorems]) => (
                    <button
                      key={chapterName}
                      type="button"
                      onClick={() => setChapter(chapterName)}
                      className="flex w-full items-center justify-between bg-transparent border-0 px-1 py-3 text-left hover:bg-muted/30 transition-colors rounded-md"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-semibold text-sm truncate">
                          {chapterDisplayIndex[chapterName] != null ? `Ch. ${chapterDisplayIndex[chapterName]}: ` : ''}
                          {chapterName.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="secondary" className="text-xs shrink-0">{theorems.length}</Badge>
                      </div>
                    </button>
                  ))
                ) : (
                  groupedByChapter.map(([chapterName, theorems]) => (
                    <div key={chapterName} className="space-y-6">
                      {induction.schemas
                        .filter((schema) => schema.filename === chapterName)
                        .map((schema) => (
                          <InductionSchemaCard key={schema.title} schema={schema} />
                        ))}
                      {renderTheoremList(theorems)}
                    </div>
                  ))
                )}
                {filtered.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center">
                    No theorems match your search
                  </p>
                )}
                {/* Lets each theorem (including the last) align to the top for one-step paging */}
                {chapter !== 'all' && (
                  <div className="shrink-0 pointer-events-none h-[70vh]" aria-hidden />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
};

/** Compact left-rail minimap: click a tick to jump to that theorem. */
const TheoremMinimap = React.memo(function TheoremMinimap({
  theorems,
  statusFor,
  activeKey,
  theoremNumber,
  onSelect,
}: {
  theorems: TheoremWithSteps[];
  statusFor: (t: TheoremWithSteps) => ProofStatus;
  activeKey: string | null;
  theoremNumber: Record<string, number>;
  onSelect: (key: string) => void;
}) {
  return (
    <aside
      className="shrink-0 w-9 flex flex-col items-center py-1 select-none"
      aria-label="Theorem navigator"
    >
      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {theorems.map((t) => {
          const status = statusFor(t);
          const active = activeKey === t.key;
          const num = theoremNumber[t.key];
          // ~50% larger than the first minimap tick sizes
          const tickClass = active
            ? 'w-6 h-[5px] bg-foreground'
            : status === 'proven'
              ? 'w-[18px] h-[3px] bg-emerald-500/85'
              : status === 'failed'
                ? 'w-[18px] h-[3px] bg-destructive/80'
                : status === 'none'
                  ? 'w-[9px] h-[3px] bg-muted-foreground/25'
                  : 'w-[15px] h-[3px] bg-muted-foreground/45';
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelect(t.key)}
              title={`#${num ?? '?'} · ${STATUS_LABEL[status]}`}
              aria-label={`Go to theorem ${num ?? t.key} (${STATUS_LABEL[status]})`}
              aria-current={active ? 'true' : undefined}
              className="group flex items-center justify-center w-full h-[11px] rounded-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className={`block rounded-full transition-all ${tickClass} group-hover:bg-foreground/80`} />
            </button>
          );
        })}
      </div>
    </aside>
  );
});

const TheoremCard = React.memo(function TheoremCard({
  theorem,
  inductionProofs,
  theoremNumber,
  parseMode,
  verification,
  transitionMatchInfo = {},
  onVerifyTransition,
  onVerifyAllTransitions,
  onVerifyCustomTransition,
  onInsertStep,
  onDeleteStep,
  transitionVerifying,
  verifyingThis,
  checksLocked,
  customTransitionVerifying,
  transitionResults = {},
  customTransitionResults = {},
  transitionDiagnoses = {},
  customRuleInputs = {},
  setCustomRuleInputs,
  ruleValidationError = {},
  setRuleValidationError,
}: {
  theorem: TheoremWithSteps;
  inductionProofs?: InductionProof[];
  theoremNumber?: number;
  parseMode: ExpressionParseMode;
  verification?: VerificationResult;
  transitionMatchInfo?: Record<number, MatchInfo>;
  onVerifyTransition?: (key: string, transitionIndex: number, ruleOverride?: string) => void;
  onVerifyAllTransitions?: (key: string) => void;
  onVerifyCustomTransition?: (customId: string, left: string, right: string, ruleOverride?: string) => void;
  onInsertStep?: (key: string, insertAtIndex: number, newExpr: string) => void;
  onDeleteStep?: (key: string, stepIndex: number) => void;
  transitionVerifying?: string | null;
  verifyingThis?: boolean;
  checksLocked?: boolean;
  customTransitionVerifying?: string | null;
  transitionResults?: Record<number, boolean>;
  customTransitionResults?: Record<string, boolean>;
  transitionDiagnoses?: Record<number, DiagnosisResult>;
  customRuleInputs?: Record<string, { left: string; right: string }>;
  setCustomRuleInputs?: React.Dispatch<React.SetStateAction<Record<string, { left: string; right: string }>>>;
  ruleValidationError?: Record<string, string>;
  setRuleValidationError?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const [open, setOpen] = useState(false);
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);
  const [expandedMatchInfo, setExpandedMatchInfo] = useState<number | null>(null);
  const parts = theorem.ruleStr.split(/\s*⟺\s*/);
  const left = parts[0]?.trim() ?? '';
  const right = parts.slice(1).join('⟺').trim();
  const isFullyVerified = verification && verification.total > 0 && verification.passed === verification.total;
  const canOpenProof =
    theorem.steps.length > 0 || (inductionProofs != null && inductionProofs.length > 0);

  const theoremBadges = (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      {theoremNumber != null && (
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          #{theoremNumber}
        </Badge>
      )}
      <Badge variant="secondary" className="text-xs font-mono">
        <FileText className="w-3 h-3 mr-1" />
        {theorem.filename}
      </Badge>
      {theorem.ruleName && (
        <Badge variant="outline" className="text-xs" title="Searchable in Rules panel">
          {theorem.ruleName}
        </Badge>
      )}
      <Badge variant="outline" className="text-xs">
        <ListOrdered className="w-3 h-3 mr-1" />
        {theorem.steps.length} steps
      </Badge>
      {verification && verification.total > 0 && (
        <Badge
          variant={isFullyVerified ? 'default' : 'outline'}
          className={`text-xs ${isFullyVerified ? 'bg-green-600 hover:bg-green-600' : ''}`}
        >
          {isFullyVerified ? (
            <CheckCircle2 className="w-3 h-3 mr-1" />
          ) : null}
          {verification.passed}/{verification.total} verified
        </Badge>
      )}
      {onVerifyAllTransitions && theorem.steps.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            onVerifyAllTransitions(theorem.key);
          }}
          disabled={!!checksLocked}
          title="Verify all transitions in this theorem"
        >
          {verifyingThis ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <PlayCircle className="w-3 h-3" />
              Verify all
            </>
          )}
        </Button>
      )}
    </div>
  );

  const theoremExpression = (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className="font-mono text-foreground/90 shrink-0">
        <ExpressionRenderer expression={left || ','} size={EXPR_SIZE} />
      </span>
      <EquivalenceSymbol size={EXPR_SIZE} className="shrink-0 text-muted-foreground" />
      <span className="font-mono text-foreground/90">
        <ExpressionRenderer expression={right || ','} size={EXPR_SIZE} />
      </span>
    </div>
  );

  return (
    <>
      <Card key={parseMode} className="border-0 bg-transparent shadow-none">
        <CardHeader
          className={`py-3 px-1 transition-colors ${
            canOpenProof ? 'cursor-pointer hover:bg-muted/30 rounded-md' : 'cursor-default'
          }`}
          onClick={canOpenProof ? () => setOpen(true) : undefined}
          aria-disabled={!canOpenProof}
          title={canOpenProof ? 'Open proof steps' : 'No proof steps'}
        >
          <div className="flex items-start gap-2">
            {canOpenProof ? (
              <span className="mt-0.5 p-0.5 -ml-1 text-muted-foreground" aria-hidden>
                <ChevronRight className="w-4 h-4" />
              </span>
            ) : (
              <span className="mt-0.5 p-0.5 -ml-1 w-5" aria-hidden />
            )}
            <div className="flex-1 min-w-0">
              {theoremBadges}
              {theoremExpression}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Dialog open={canOpenProof && open} onOpenChange={(next) => canOpenProof && setOpen(next)}>
        <DialogContent
          overlayClassName="bg-background/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          className="max-w-6xl w-[min(96vw,72rem)] max-h-[85vh] overflow-hidden flex flex-col gap-3 p-5 left-1/2 top-[7.5vh] translate-x-0 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-top-0 duration-200 [backface-visibility:hidden] [-webkit-font-smoothing:antialiased] [transform:translate3d(-50%,0,0)]"
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="sr-only">
              Proof steps{theoremNumber != null ? ` for theorem #${theoremNumber}` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detailed proof steps. Click outside or press Escape to close.
            </DialogDescription>
            {theoremBadges}
            {theoremExpression}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 space-y-1 pr-1">
              {inductionProofs && inductionProofs.length > 0 ? (
                <InductionProofView proofs={inductionProofs} results={transitionResults} />
              ) : theorem.steps.map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && onVerifyTransition && (
                    <div className="space-y-2 py-1">
                      {(() => {
                        const transitionId = `${theorem.key}::${i - 1}`;
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                onVerifyTransition(theorem.key, i - 1);
                              }}
                              disabled={!!checksLocked}
                            >
                              {transitionVerifying === transitionId ? (
                                <>Checking...</>
                              ) : transitionResults[i - 1] === true ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                  Check step
                                </>
                              ) : transitionResults[i - 1] === false ? (
                                <>
                                  <X className="w-3.5 h-3.5 text-destructive" />
                                  Check step
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Check step
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })()}
                      {transitionResults[i - 1] === false && transitionDiagnoses[i - 1] && (
                        <DiagnosisDisplay
                          diagnosis={transitionDiagnoses[i - 1]}
                          expanded={expandedDiagnosis === i - 1}
                          onToggle={() => setExpandedDiagnosis(expandedDiagnosis === i - 1 ? null : i - 1)}
                        />
                      )}
                      {transitionResults[i - 1] === true && transitionMatchInfo[i - 1] && (
                        <MatchInfoDisplay
                          matchInfo={transitionMatchInfo[i - 1]}
                          expanded={expandedMatchInfo === i - 1}
                          onToggle={() => setExpandedMatchInfo(expandedMatchInfo === i - 1 ? null : i - 1)}
                        />
                      )}
                    </div>
                  )}
                  <div
                    className="flex items-start gap-2 text-sm py-1.5 px-2 rounded bg-muted/30 border border-border/50 group"
                  >
                    <span className="text-muted-foreground shrink-0 font-mono w-6">{i + 1}.</span>
                    <span className="flex-1 min-w-0">
                      <ExpressionRenderer expression={step} size={EXPR_SIZE} />
                    </span>
                    {onDeleteStep && theorem.steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteStep(theorem.key, i);
                        }}
                        title="Delete this step"
                        aria-label="Delete step"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </React.Fragment>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

function MatchInfoDisplay({
  matchInfo,
  expanded,
  onToggle,
}: {
  matchInfo: MatchInfo;
  expanded: boolean;
  onToggle: () => void;
}) {
  const startNodeDesc =
    matchInfo.description ??
    (matchInfo.startPosition != null
      ? `character position ${matchInfo.startPosition}`
      : matchInfo.side
        ? `${matchInfo.side} side`
        : null);
  const nodeMapEntries = matchInfo.nodeMap ? Object.entries(matchInfo.nodeMap) : [];
  const originalPattern = `${matchInfo.ruleLeft ?? ','} ⇔ ${matchInfo.ruleRight ?? ','}`;
  const instantiatedLeft = matchInfo.instantiatedPatternLeft;
  const instantiatedRight = matchInfo.instantiatedPatternRight;
  const hasTcInstantiation =
    (instantiatedLeft != null || instantiatedRight != null) &&
    (instantiatedLeft !== matchInfo.ruleLeft || instantiatedRight !== matchInfo.ruleRight);
  return (
    <div className="border border-green-200 dark:border-green-800 rounded-md bg-green-500/5 dark:bg-green-950/30 p-2 text-xs">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-2 w-full text-left hover:bg-green-500/10 rounded px-1 py-0.5 -mx-1 -my-0.5"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
        <span className="font-medium text-green-700 dark:text-green-300">Check passed</span>
        {(matchInfo.ruleLeft != null || matchInfo.ruleRight != null) && (
          <span className="text-muted-foreground font-mono text-[11px] truncate flex-1 min-w-0 inline-flex items-center gap-0.5">
            <ExpressionRenderer expression={matchInfo.ruleLeft ?? ','} size={EXPR_SIZE_SM} />
            <EquivalenceSymbol size={EXPR_SIZE_SM} className="shrink-0" />
            <ExpressionRenderer expression={matchInfo.ruleRight ?? ','} size={EXPR_SIZE_SM} />
          </span>
        )}
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 pl-5">
          <div>
            <span className="font-medium text-foreground/80">Rule id: </span>
            <span className="font-mono text-muted-foreground">{matchInfo.matchedRuleId}</span>
          </div>
          {matchInfo.inferenceRuleName && (
            <div>
              <span className="font-medium text-foreground/80">Inference rule: </span>
              <span className="text-muted-foreground">{matchInfo.inferenceRuleName}</span>
            </div>
          )}
          {(matchInfo.ruleLeft != null || matchInfo.ruleRight != null) && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">Pattern rule (before \Tc substitution):</div>
              <div className="text-muted-foreground text-[11px] break-all inline-flex items-center gap-0.5 flex-wrap">
                <ExpressionRenderer expression={matchInfo.ruleLeft ?? ','} size={EXPR_SIZE_SM} />
                <EquivalenceSymbol size={EXPR_SIZE_SM} className="shrink-0" />
                <ExpressionRenderer expression={matchInfo.ruleRight ?? ','} size={EXPR_SIZE_SM} />
              </div>
              <div className="font-mono text-muted-foreground text-[11px] break-all mt-1">{originalPattern}</div>
            </div>
          )}
          {hasTcInstantiation && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">Pattern after \Tc substitution:</div>
              <div className="text-muted-foreground text-[11px] break-all inline-flex items-center gap-0.5 flex-wrap">
                <ExpressionRenderer expression={instantiatedLeft ?? matchInfo.ruleLeft ?? ','} size={EXPR_SIZE_SM} />
                <EquivalenceSymbol size={EXPR_SIZE_SM} className="shrink-0" />
                <ExpressionRenderer expression={instantiatedRight ?? matchInfo.ruleRight ?? ','} size={EXPR_SIZE_SM} />
              </div>
            </div>
          )}
          {startNodeDesc && (
            <div>
              <span className="font-medium text-foreground/80">Starting node of match: </span>
              <span className="text-muted-foreground">{startNodeDesc}</span>
            </div>
          )}
          {nodeMapEntries.length > 0 && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">Node map (pattern → target):</div>
              <div className="font-mono text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                {nodeMapEntries.map(([patternId, targetId]) => (
                  <div key={patternId} className="flex gap-2">
                    <span className="shrink-0">{patternId}</span>
                    <span className="text-muted-foreground/80">→</span>
                    <span>{targetId}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {matchInfo.tcMapping && Object.keys(matchInfo.tcMapping).length > 0 && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">\Tc mapping (operand → target expression):</div>
              <div className="font-mono text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {Object.entries(matchInfo.tcMapping).map(([op, exprs]) => (
                  <div key={op} className="flex flex-col gap-0.5">
                    <span className="text-foreground/90">
                      <span className="text-primary">\Tc {op}</span>
                      <span className="text-muted-foreground/80 mx-1">→</span>
                    </span>
                    <div className="pl-2 space-y-0.5">
                      {exprs.map((e, i) => (
                        <div key={i} className="text-[11px] break-all">
                          <ExpressionRenderer expression={e || ','} size={EXPR_SIZE_SM} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {matchInfo.unmatchedTargetNodeSignatures && matchInfo.unmatchedTargetNodeSignatures.length > 0 && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">Unmatched target nodes (context):</div>
              <div className="font-mono text-muted-foreground text-[11px] max-h-24 overflow-y-auto break-all">
                {matchInfo.unmatchedTargetNodeSignatures.join('; ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosisDisplay({
  diagnosis,
  expanded,
  onToggle,
}: {
  diagnosis: DiagnosisResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-destructive/20 rounded-md bg-destructive/5 p-2 text-xs">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="flex items-center gap-2 w-full text-left hover:bg-destructive/10 rounded px-1 py-0.5 -mx-1 -my-0.5"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
        <span className="font-medium text-destructive">Verification failed</span>
        <span className="text-muted-foreground ml-auto">
          {expanded ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronRight className="w-3 h-3 inline" />}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 pl-5">
          <div>
            <div className="font-medium mb-1">Transition Analysis:</div>
            <div className="text-muted-foreground space-y-0.5">
              <div>Delta: {diagnosis.characteristics.delta}</div>
              <div>Operators: {[...diagnosis.characteristics.operatorsAll].slice(0, 5).join(', ')}
                {diagnosis.characteristics.operatorsAll.size > 5 && ' ...'}
              </div>
              <div>Operations: {diagnosis.characteristics.opCountLeft} → {diagnosis.characteristics.opCountRight}</div>
              {diagnosis.characteristics.hasBranches && <div>Has branches</div>}
            </div>
          </div>
          
          {diagnosis.totalRulesTried > 0 && (
            <div>
              <div className="font-medium mb-1">Rules Tried: {diagnosis.totalRulesTried}</div>
              {diagnosis.rulesFiltered > 0 && (
                <div className="text-muted-foreground text-xs">
                  ({diagnosis.rulesFiltered} filtered out)
                </div>
              )}
            </div>
          )}
          
          {diagnosis.possibleReasons.length > 0 && (
            <div>
              <div className="font-medium mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Possible Reasons:
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {diagnosis.possibleReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          
          {diagnosis.suggestions.length > 0 && (
            <div>
              <div className="font-medium mb-1">Suggestions:</div>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {diagnosis.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          {diagnosis.similarRules && diagnosis.similarRules.length > 0 && (
            <div>
              <div className="font-medium mb-1">Similar Rules (not tried):</div>
              <div className="text-muted-foreground space-y-0.5">
                {diagnosis.similarRules.slice(0, 3).map((rule, idx) => (
                  <div key={idx} className="text-xs">
                    • {rule.ruleId} ({Math.round(rule.similarity * 100)}% similar - {rule.reason})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LLM diagnosis UI hidden for now. Re-enable when VITE_ENABLE_LLM_DIAGNOSIS is used. */}
          {false && diagnosis.llmDiagnosis && (
            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="font-medium mb-1 flex items-center gap-1">
                <span>AI explanation</span>
                {diagnosis.llmDiagnosis.provider && (
                  <span className="text-muted-foreground font-normal text-[10px]">
                    ({diagnosis.llmDiagnosis.provider})
                  </span>
                )}
              </div>
              <div className="text-muted-foreground space-y-1.5">
                <p className="leading-relaxed">{diagnosis.llmDiagnosis.explanation}</p>
                {diagnosis.llmDiagnosis.analysis && (
                  <p className="leading-relaxed opacity-90">{diagnosis.llmDiagnosis.analysis}</p>
                )}
                {diagnosis.llmDiagnosis.suggestions.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 mt-1">
                    {diagnosis.llmDiagnosis.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                {diagnosis.llmDiagnosis.rootCauses.length > 0 && (
                  <div className="mt-1">
                    <span className="font-medium text-foreground/80">Root causes: </span>
                    {diagnosis.llmDiagnosis.rootCauses.join('; ')}
                  </div>
                )}
                {!diagnosis.llmDiagnosis.success && diagnosis.llmDiagnosis.error && (
                  <p className="text-destructive/80 text-[10px]">{diagnosis.llmDiagnosis.error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProofSteps;
