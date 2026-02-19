import React, { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import WorkbenchContainer from '@/components/workbench/WorkbenchContainer';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import { usePanelContext } from '@/contexts/PanelContext';
import { Copy, Play } from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { axioms } from '@/data/axioms';
import { normalizeSpacing } from '@/lib/inferenceRules/utils';
import { trySubstitutionByMatchPairs } from '@/lib/inferenceRules/substitution';
import { verifyTransitionWorker, type VerifyTransitionResult } from '@/lib/transitionVerificationWorkerClient';
import type { MatchInfo } from '@/workers/transitionVerificationWorker';
import type { DiagnosisResult } from '@/lib/inferenceRules/errorDiagnosis';
// LLM diagnosis hidden for now. Re-enable: import { generateLLMDiagnosis } from '@/lib/inferenceRules/llmDiagnosis';
import { definitions } from '@/data/definitions';
import { theorems } from '@/data/theorems';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronRight, FileText, ListOrdered, CheckCircle2, Check, X, AlertTriangle, Info, Plus, Trash2, CheckCheck, PlayCircle, Loader2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

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

/** Position for ordering: axioms/definitions = -1 (always before), theorems = chapterOrder*100000 + index. */
function getPositionForRule(rule: { id: string }): number {
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1];
  const index = parseInt(m[2], 10);
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
  const { isWorkbenchExpanded, isRulesPanelOpen, setDebugWorkbenchExpressions } = usePanelContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [table, setTable] = useState<ProofStepsTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>('all');
  const [ruleInput, setRuleInput] = useState('');
  const [transitionVerifying, setTransitionVerifying] = useState<string | null>(null);
  const [transitionResults, setTransitionResults] = useState<Record<string, Record<number, boolean>>>({});
  const [transitionMatchInfo, setTransitionMatchInfo] = useState<Record<string, Record<number, MatchInfo>>>({});
  const [transitionDiagnoses, setTransitionDiagnoses] = useState<Record<string, Record<number, DiagnosisResult>>>({});
  const [customTransitionVerifying, setCustomTransitionVerifying] = useState<string | null>(null);
  const [customTransitionResults, setCustomTransitionResults] = useState<Record<string, boolean>>({});
  /** Which theorem is currently verifying all transitions (theorem key). */
  const [theoremVerifyingAll, setTheoremVerifyingAll] = useState<string | null>(null);
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
      if (transitionVerifying) return;
      const steps = table?.[key];
      if (!steps || transitionIndex < 0 || transitionIndex >= steps.length - 1) return;
      setTransitionVerifying(transitionId);
      const left = steps[transitionIndex];
      const right = steps[transitionIndex + 1];
      const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${key}-override`);
      if (parsedOverride && !ruleExistsInDatabase(parsedOverride.leftSide, parsedOverride.rightSide)) {
        setRuleValidationError((prev) => ({ ...prev, [transitionId]: 'Rule not found in database' }));
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
          const r = trySubstitutionByMatchPairs(left, right, preferredRule.leftSide, preferredRule.rightSide, undefined);
          if (r?.match && r.reconstructedExpr != null) {
            const pos = r.position;
            const matchInfo: MatchInfo = {
              matchedRuleId: preferredRule.id,
              description: pos?.description,
              startPosition: pos?.position,
              side: pos?.side,
              ruleLeft: preferredRule.leftSide,
              ruleRight: preferredRule.rightSide,
              inferenceRuleName: 'Equivalent Substitution',
              nodeMap: pos?.nodeMapping ? Object.fromEntries(pos.nodeMapping) : undefined,
              unmatchedTargetNodeSignatures: pos?.unmatchedTargetNodeSignatures,
              tcMapping: pos?.tcMapping,
            };
            setTransitionResults((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: true } }));
            setTransitionMatchInfo((prev) => ({ ...prev, [key]: { ...prev[key], [transitionIndex]: matchInfo } }));
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
        console.error('Transition verification error:', err);
        setTransitionResults((prev) => ({
          ...prev,
          [key]: { ...prev[key], [transitionIndex]: false },
        }));
      } finally {
        setTransitionVerifying(null);
      }
    },
    [table, transitionVerifying, rulesForWorker]
  );

  const verifyCustomTransition = React.useCallback(
    async (customId: string, left: string, right: string, ruleOverride?: string) => {
      if (customTransitionVerifying) return;
      const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${customId}-override`);
      if (parsedOverride && !ruleExistsInDatabase(parsedOverride.leftSide, parsedOverride.rightSide)) {
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
          const r = trySubstitutionByMatchPairs(left, right, preferredRule.leftSide, preferredRule.rightSide, undefined);
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
        console.error('Custom transition verification error:', err);
        setCustomTransitionResults((prev) => ({ ...prev, [customId]: false }));
      } finally {
        setCustomTransitionVerifying(null);
      }
    },
    [customTransitionVerifying, rulesForWorker]
  );

  const verifyAllTransitions = React.useCallback(
    async (key: string): Promise<Record<number, boolean>> => {
      if (theoremVerifyingAll || transitionVerifying) return {};
      const steps = table?.[key];
      if (!steps || steps.length < 2) return {};
      
      setTheoremVerifyingAll(key);
      const results: Record<number, boolean> = {};
      
      try {
        // Verify all transitions sequentially
        for (let i = 0; i < steps.length - 1; i++) {
          const transitionId = `${key}::${i}`;
          const left = steps[i];
          const right = steps[i + 1];
          
          // Check if there's a custom rule override for this transition
          const ruleOverride = (() => {
            const r = customRuleInputs[transitionId];
            return (r?.left?.trim() && r?.right?.trim()) ? `${r.left.trim()} ⟺ ${r.right.trim()}` : undefined;
          })();
          
          const parsedOverride = parseRuleOverride(ruleOverride ?? '', `${key}-override`);
          if (parsedOverride && !ruleExistsInDatabase(parsedOverride.leftSide, parsedOverride.rightSide)) {
            setRuleValidationError((prev) => ({ ...prev, [transitionId]: 'Rule not found in database' }));
            results[i] = false;
            setTransitionResults((prev) => ({
              ...prev,
              [key]: { ...prev[key], [i]: false },
            }));
            continue;
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

          // Try preferred rule first (same as verifySingleTransition)
          let matched = false;
          if (preferredRule && !preferredRuleIsCurrentTheorem) {
            try {
              const r = trySubstitutionByMatchPairs(left, right, preferredRule.leftSide, preferredRule.rightSide, undefined);
              if (r?.match && r.reconstructedExpr != null) {
                const pos = r.position;
                const matchInfo: MatchInfo = {
                  matchedRuleId: preferredRule.id,
                  description: pos?.description,
                  startPosition: pos?.position,
                  side: pos?.side,
                  ruleLeft: preferredRule.leftSide,
                  ruleRight: preferredRule.rightSide,
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
              console.error(`Transition ${i} verification error:`, err);
              results[i] = false;
              setTransitionResults((prev) => ({
                ...prev,
                [key]: { ...prev[key], [i]: false },
              }));
            }
          }
        }
        return results;
      } finally {
        setTheoremVerifyingAll(null);
      }
    },
    [table, theoremVerifyingAll, transitionVerifying, rulesForWorker, customRuleInputs]
  );

  const [chapterCheckingAll, setChapterCheckingAll] = useState(false);

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
    setTransitionResults({});
    setTransitionMatchInfo({});
    setTransitionDiagnoses({});
    setCustomTransitionResults({});
  }, [chapter]);

  const verificationResults = React.useMemo(() => {
    const out: Record<string, VerificationResult> = {};
    for (const [key, results] of Object.entries(transitionResults)) {
      const indices = Object.keys(results).map(Number);
      if (indices.length === 0) continue;
      const passed = indices.filter((i) => results[i] === true).length;
      out[key] = { passed, total: indices.length };
    }
    return out;
  }, [transitionResults]);

  const theoremsWithSteps: TheoremWithSteps[] = React.useMemo(() => {
    if (!table) return [];
    return Object.entries(table)
      .filter(([, steps]) => steps.length > 0)
      .map(([key, steps]) => {
        const { filename, index, ruleStr } = parseKey(key);
        return { key, filename, index, ruleStr, steps, ruleName: getRuleNameForRuleStr(ruleStr) };
      })
      .sort((a, b) => {
        const cmp = getChapterIndex(a.filename) - getChapterIndex(b.filename);
        if (cmp !== 0) return cmp;
        return a.index - b.index;
      });
  }, [table]);

  const chapters = React.useMemo(() => {
    const set = new Set(theoremsWithSteps.map((t) => t.filename));
    return Array.from(set).sort((a, b) => getChapterIndex(a) - getChapterIndex(b));
  }, [theoremsWithSteps]);

  /** Sequential 1-based index for displayed chapters (no gaps). */
  const chapterDisplayIndex = React.useMemo(() => {
    const map: Record<string, number> = {};
    chapters.forEach((ch, idx) => { map[ch] = idx + 1; });
    return map;
  }, [chapters]);

  const filtered = React.useMemo(() => {
    let list = theoremsWithSteps;
    if (chapter !== 'all') {
      list = list.filter((t) => t.filename === chapter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.filename.toLowerCase().includes(q) ||
          t.ruleStr.toLowerCase().includes(q) ||
          (t.ruleName?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [theoremsWithSteps, chapter, search]);

  const checkAllProofStepsInChapter = React.useCallback(async () => {
    if (chapter === 'all' || chapterCheckingAll || theoremVerifyingAll || transitionVerifying) return;
    const toCheck = filtered.filter((t) => (table?.[t.key]?.length ?? 0) >= 2);
    if (toCheck.length === 0) return;
    setChapterCheckingAll(true);
    try {
      let theoremsWithFailures = 0;
      for (const t of toCheck) {
        const results = await verifyAllTransitions(t.key);
        const hasFailure = Object.values(results).some((v) => v === false);
        if (hasFailure) theoremsWithFailures++;
      }
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
    } finally {
      setChapterCheckingAll(false);
    }
  }, [chapter, chapterCheckingAll, theoremVerifyingAll, transitionVerifying, filtered, table, verifyAllTransitions, toast]);

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

  const groupedByChapter = React.useMemo(() => {
    const groups: Record<string, TheoremWithSteps[]> = {};
    for (const t of filtered) {
      if (!groups[t.filename]) groups[t.filename] = [];
      groups[t.filename].push(t);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => getChapterIndex(a) - getChapterIndex(b)
    );
  }, [filtered]);

  /** Sequential 1-based number for each theorem in display order */
  const theoremDisplayNumber = React.useMemo(() => {
    const map: Record<string, number> = {};
    let n = 0;
    for (const [, thms] of groupedByChapter) {
      for (const t of thms) {
        map[t.key] = ++n;
      }
    }
    return map;
  }, [groupedByChapter]);

  const handleBeginProof = React.useCallback(() => {
    const parts = ruleInput.split(/\s*⟺\s*/);
    const left = parts[0]?.trim() || '';
    const right = parts.slice(1).join('⟺').trim() || '';
    const params = new URLSearchParams();
    if (left) params.set('start', left);
    if (right) params.set('end', right);
    navigate(`/proof-step?${params.toString()}`);
  }, [ruleInput, navigate]);

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <RulesSidePanel />
      <main
        className="flex-1 pt-24 pb-12 px-6 transition-all duration-300"
        style={{
          marginRight: isRulesPanelOpen ? '380px' : '0',
          marginBottom: isWorkbenchExpanded ? '50vh' : '48px',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              This page is under development. Features may be incomplete or change without notice.
            </p>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Theorems with Proof Steps
            </h1>
            <p className="text-sm text-muted-foreground">
              {theoremsWithSteps.length} theorems have proofs extracted from the LaTeX sources. Use &quot;Check step&quot; to verify each transition.
            </p>
          </div>

          {/* Rule input + Begin Proof */}
          <Card className="mb-6">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div className="flex-1 w-full">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Enter a rule to prove</label>
                  <Input
                    placeholder=", i \Op, ⟺ , j \Op,"
                    value={ruleInput}
                    onChange={(e) => setRuleInput(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <Button
                  onClick={handleBeginProof}
                  disabled={!ruleInput.trim()}
                  className="sm:mt-6 shrink-0"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Begin Proof Step
                </Button>
              </div>
              {ruleInput.trim() && (
                <div className="p-2 rounded-md border bg-muted/20 overflow-x-auto">
                  <ExpressionRenderer expression={ruleInput} size={14} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or rule..."
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
            {chapter !== 'all' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkAllProofStepsInChapter}
                  disabled={chapterCheckingAll || !!theoremVerifyingAll || !!transitionVerifying || filtered.filter((t) => (table?.[t.key]?.length ?? 0) >= 2).length === 0}
                >
                  {chapterCheckingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-1.5" />
                  )}
                  Check all
                </Button>
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

          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="space-y-3 pr-4">
              {groupedByChapter.map(([chapterName, theorems]) => (
                <Collapsible key={chapterName}>
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg [&[data-state=open]>div>svg:first-child]:rotate-90">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 transition-transform" />
                        <span className="font-semibold text-sm">
                          {chapterDisplayIndex[chapterName] != null ? `Ch. ${chapterDisplayIndex[chapterName]}: ` : ''}
                          {chapterName.replace(/_/g, ' ')}
                        </span>
                        <Badge variant="secondary" className="text-xs">{theorems.length}</Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-3">
                        {theorems.map((t) => (
                          <TheoremCard
                            key={t.key}
                            theorem={t}
                            theoremNumber={theoremDisplayNumber[t.key]}
                            verification={verificationResults[t.key]}
                            transitionMatchInfo={transitionMatchInfo[t.key]}
                            onVerifyTransition={verifySingleTransition}
                            onVerifyAllTransitions={verifyAllTransitions}
                            onVerifyCustomTransition={verifyCustomTransition}
                            onCopyToDebug={setDebugWorkbenchExpressions}
                            onInsertStep={handleInsertStep}
                            onDeleteStep={handleDeleteStep}
                            transitionVerifying={transitionVerifying}
                            theoremVerifyingAll={theoremVerifyingAll}
                            customTransitionVerifying={customTransitionVerifying}
                            transitionResults={transitionResults[t.key]}
                            customTransitionResults={customTransitionResults}
                            transitionDiagnoses={transitionDiagnoses[t.key]}
                            customRuleInputs={customRuleInputs}
                            setCustomRuleInputs={setCustomRuleInputs}
                            ruleValidationError={ruleValidationError}
                            setRuleValidationError={setRuleValidationError}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
              {filtered.length === 0 && (
                <p className="text-muted-foreground py-8 text-center">
                  No theorems match your search
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
      <Footer />
      <WorkbenchContainer />
    </div>
  );
};

function TheoremCard({
  theorem,
  theoremNumber,
  verification,
  transitionMatchInfo = {},
  onVerifyTransition,
  onVerifyAllTransitions,
  onVerifyCustomTransition,
  onCopyToDebug,
  onInsertStep,
  onDeleteStep,
  transitionVerifying,
  theoremVerifyingAll,
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
  theoremNumber?: number;
  verification?: VerificationResult;
  transitionMatchInfo?: Record<number, MatchInfo>;
  onVerifyTransition?: (key: string, transitionIndex: number, ruleOverride?: string) => void;
  onVerifyAllTransitions?: (key: string) => void;
  onVerifyCustomTransition?: (customId: string, left: string, right: string, ruleOverride?: string) => void;
  onCopyToDebug?: (left: string, right: string) => void;
  onInsertStep?: (key: string, insertAtIndex: number, newExpr: string) => void;
  onDeleteStep?: (key: string, stepIndex: number) => void;
  transitionVerifying?: string | null;
  theoremVerifyingAll?: string | null;
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
  const [insertStepOpen, setInsertStepOpen] = useState<string | null>(null);
  const [insertStepDrafts, setInsertStepDrafts] = useState<Record<string, string>>({});
  /** Which rule input is being dragged over: `${id}::left` or `${id}::right` */
  const [ruleDropTarget, setRuleDropTarget] = useState<string | null>(null);
  const parts = theorem.ruleStr.split(/\s*⟺\s*/);
  const left = parts[0]?.trim() ?? '';
  const right = parts.slice(1).join('⟺').trim();
  const isFullyVerified = verification && verification.total > 0 && verification.passed === verification.total;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-start gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mt-0.5 p-0.5 rounded hover:bg-muted/50 -ml-1"
                aria-label={open ? 'Collapse' : 'Expand'}
              >
                {open ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex-1 min-w-0">
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
                    disabled={theoremVerifyingAll !== null || transitionVerifying !== null}
                    title="Verify all transitions in this theorem"
                  >
                    {theoremVerifyingAll === theorem.key ? (
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
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-mono text-foreground/90 shrink-0">
                  <ExpressionRenderer expression={left || ','} size={12} />
                </span>
                <EquivalenceSymbol size={12} className="shrink-0 text-muted-foreground" />
                <span className="font-mono text-foreground/90">
                  <ExpressionRenderer expression={right || ','} size={12} />
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="border-t border-border pt-3 space-y-1">
              {theorem.steps.map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (onVerifyTransition || onCopyToDebug) && (
                    <div className="space-y-2 py-1">
                      {(() => {
                        const transitionId = `${theorem.key}::${i - 1}`;
                        const prevExpr = theorem.steps[i - 1];
                        const draft = insertStepDrafts[transitionId] ?? prevExpr;
                        const isInsertOpen = insertStepOpen === transitionId;
                        const toggleInsert = () => {
                          if (isInsertOpen) {
                            setInsertStepOpen(null);
                          } else {
                            setInsertStepOpen(transitionId);
                            setInsertStepDrafts((prev) => ({
                              ...prev,
                              [transitionId]: prev[transitionId] ?? prevExpr,
                            }));
                          }
                        };
                        const customId = `${transitionId}::insert`;
                        const customIdAbove = `${transitionId}::insert-above`;
                        const nextExpr = theorem.steps[i];
                        // When insert is open, first row references (step above → inserted draft)
                        const firstRowLeft = prevExpr;
                        const firstRowRight = isInsertOpen ? draft : nextExpr;
                        const firstButtonRow = (
                          <div className="flex items-center gap-2 flex-wrap">
                            {onVerifyTransition && (
                              isInsertOpen && onVerifyCustomTransition ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onVerifyCustomTransition(customIdAbove, firstRowLeft, firstRowRight, (() => { const r = customRuleInputs[customIdAbove]; return (r?.left?.trim() && r?.right?.trim()) ? `${r.left.trim()} ⟺ ${r.right.trim()}` : undefined; })());
                                  }}
                                  disabled={customTransitionVerifying !== null}
                                  title="Verify: step above → inserted expression"
                                >
                                  {customTransitionVerifying === customIdAbove ? (
                                    <>Checking...</>
                                  ) : customTransitionResults[customIdAbove] === true ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                      Check step
                                    </>
                                  ) : customTransitionResults[customIdAbove] === false ? (
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
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onVerifyTransition(theorem.key, i - 1, (() => { const r = customRuleInputs[transitionId]; return (r?.left?.trim() && r?.right?.trim()) ? `${r.left.trim()} ⟺ ${r.right.trim()}` : undefined; })());
                                  }}
                                  disabled={transitionVerifying !== null}
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
                              )
                            )}
                            {setCustomRuleInputs && (
                              <div className="flex flex-col gap-0.5 flex-1 min-w-[320px] max-w-[520px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div
                                    className={`flex-1 min-w-0 rounded border border-dashed transition-colors ${ruleDropTarget === `${isInsertOpen ? customIdAbove : transitionId}::left` ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setRuleDropTarget(`${isInsertOpen ? customIdAbove : transitionId}::left`); }}
                                    onDragLeave={(e) => { e.stopPropagation(); setRuleDropTarget(null); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRuleDropTarget(null);
                                      const rule = parseDroppedRule(e);
                                      if (rule) {
                                        const id = isInsertOpen ? customIdAbove : transitionId;
                                        const content = rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide;
                                        setCustomRuleInputs((prev) => ({ ...prev, [id]: { left: content, right: prev[id]?.right ?? '' } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[id]; return next; });
                                      }
                                    }}
                                  >
                                    <Input
                                      value={customRuleInputs[isInsertOpen ? customIdAbove : transitionId]?.left ?? ''}
                                      onChange={(e) => {
                                        const id = isInsertOpen ? customIdAbove : transitionId;
                                        setCustomRuleInputs((prev) => ({ ...prev, [id]: { left: e.target.value, right: prev[id]?.right ?? '' } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[id]; return next; });
                                      }}
                                      placeholder="Left (optional) — or drag rule here"
                                      className={`h-7 text-xs font-mono w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${ruleValidationError[isInsertOpen ? customIdAbove : transitionId] ? 'border-destructive' : ''}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Rule left side (drag from rules panel or type)"
                                    />
                                  </div>
                                  <EquivalenceSymbol size={12} className="flex-shrink-0 text-muted-foreground" />
                                  <div
                                    className={`flex-1 min-w-0 rounded border border-dashed transition-colors ${ruleDropTarget === `${isInsertOpen ? customIdAbove : transitionId}::right` ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setRuleDropTarget(`${isInsertOpen ? customIdAbove : transitionId}::right`); }}
                                    onDragLeave={(e) => { e.stopPropagation(); setRuleDropTarget(null); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRuleDropTarget(null);
                                      const rule = parseDroppedRule(e);
                                      if (rule) {
                                        const id = isInsertOpen ? customIdAbove : transitionId;
                                        const content = rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide;
                                        setCustomRuleInputs((prev) => ({ ...prev, [id]: { left: prev[id]?.left ?? '', right: content } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[id]; return next; });
                                      }
                                    }}
                                  >
                                    <Input
                                      value={customRuleInputs[isInsertOpen ? customIdAbove : transitionId]?.right ?? ''}
                                      onChange={(e) => {
                                        const id = isInsertOpen ? customIdAbove : transitionId;
                                        setCustomRuleInputs((prev) => ({ ...prev, [id]: { left: prev[id]?.left ?? '', right: e.target.value } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[id]; return next; });
                                      }}
                                      placeholder="Right (optional) — or drag rule here"
                                      className={`h-7 text-xs font-mono w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${ruleValidationError[isInsertOpen ? customIdAbove : transitionId] ? 'border-destructive' : ''}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Rule right side (drag from rules panel or type)"
                                    />
                                  </div>
                                </div>
                                {ruleValidationError[isInsertOpen ? customIdAbove : transitionId] && (
                                  <span className="text-xs text-destructive" onClick={(e) => e.stopPropagation()}>
                                    {ruleValidationError[isInsertOpen ? customIdAbove : transitionId]}
                                  </span>
                                )}
                              </div>
                            )}
                            {onCopyToDebug && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyToDebug(firstRowLeft, firstRowRight);
                                }}
                                title={isInsertOpen ? 'Copy to Debug: step above → inserted expression' : 'Copy to Debug workbench'}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy to Debug
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleInsert();
                              }}
                              title="Insert step: edit expression and see rendered preview"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Insert step
                            </Button>
                          </div>
                        );
                        const secondButtonRow = isInsertOpen && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {onVerifyCustomTransition && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onVerifyCustomTransition(customId, draft, nextExpr, (() => { const r = customRuleInputs[customId]; return (r?.left?.trim() && r?.right?.trim()) ? `${r.left.trim()} ⟺ ${r.right.trim()}` : undefined; })());
                                }}
                                disabled={customTransitionVerifying !== null}
                                title="Verify: inserted expression → step below"
                              >
                                {customTransitionVerifying === customId ? (
                                  <>Checking...</>
                                ) : customTransitionResults[customId] === true ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                    Check step
                                  </>
                                ) : customTransitionResults[customId] === false ? (
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
                            )}
                            {setCustomRuleInputs && (
                              <div className="flex flex-col gap-0.5 flex-1 min-w-[320px] max-w-[520px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div
                                    className={`flex-1 min-w-0 rounded border border-dashed transition-colors ${ruleDropTarget === `${customId}::left` ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setRuleDropTarget(`${customId}::left`); }}
                                    onDragLeave={(e) => { e.stopPropagation(); setRuleDropTarget(null); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRuleDropTarget(null);
                                      const rule = parseDroppedRule(e);
                                      if (rule) {
                                        const content = rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide;
                                        setCustomRuleInputs((prev) => ({ ...prev, [customId]: { left: content, right: prev[customId]?.right ?? '' } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[customId]; return next; });
                                      }
                                    }}
                                  >
                                    <Input
                                      value={customRuleInputs[customId]?.left ?? ''}
                                      onChange={(e) => {
                                        setCustomRuleInputs((prev) => ({ ...prev, [customId]: { left: e.target.value, right: prev[customId]?.right ?? '' } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[customId]; return next; });
                                      }}
                                      placeholder="Left (optional) — or drag rule here"
                                      className={`h-7 text-xs font-mono w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${ruleValidationError[customId] ? 'border-destructive' : ''}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Rule left side (drag from rules panel or type)"
                                    />
                                  </div>
                                  <EquivalenceSymbol size={12} className="flex-shrink-0 text-muted-foreground" />
                                  <div
                                    className={`flex-1 min-w-0 rounded border border-dashed transition-colors ${ruleDropTarget === `${customId}::right` ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; setRuleDropTarget(`${customId}::right`); }}
                                    onDragLeave={(e) => { e.stopPropagation(); setRuleDropTarget(null); }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setRuleDropTarget(null);
                                      const rule = parseDroppedRule(e);
                                      if (rule) {
                                        const content = rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide;
                                        setCustomRuleInputs((prev) => ({ ...prev, [customId]: { left: prev[customId]?.left ?? '', right: content } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[customId]; return next; });
                                      }
                                    }}
                                  >
                                    <Input
                                      value={customRuleInputs[customId]?.right ?? ''}
                                      onChange={(e) => {
                                        setCustomRuleInputs((prev) => ({ ...prev, [customId]: { left: prev[customId]?.left ?? '', right: e.target.value } }));
                                        setRuleValidationError?.((prev) => { const next = { ...prev }; delete next[customId]; return next; });
                                      }}
                                      placeholder="Right (optional) — or drag rule here"
                                      className={`h-7 text-xs font-mono w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ${ruleValidationError[customId] ? 'border-destructive' : ''}`}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Rule right side (drag from rules panel or type)"
                                    />
                                  </div>
                                </div>
                                {ruleValidationError[customId] && (
                                  <span className="text-xs text-destructive" onClick={(e) => e.stopPropagation()}>
                                    {ruleValidationError[customId]}
                                  </span>
                                )}
                              </div>
                            )}
                            {onCopyToDebug && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyToDebug(draft, nextExpr);
                                }}
                                title="Copy to Debug: inserted expression → step below"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Copy to Debug
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleInsert();
                              }}
                              title="Insert step: edit expression and see rendered preview"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Insert step
                            </Button>
                          </div>
                        );
                        return (
                          <>
                            {firstButtonRow}
                            {isInsertOpen && (
                              <div className="pl-1 space-y-2 border border-border/50 rounded-md p-2 bg-muted/20">
                                <Input
                                  value={draft}
                                  onChange={(e) =>
                                    setInsertStepDrafts((prev) => ({
                                      ...prev,
                                      [transitionId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Expression (e.g. \\Oa(x,y))"
                                  className="font-mono text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="text-sm">
                                  <span className="text-muted-foreground mr-1">Rendered:</span>
                                  <span className="font-mono inline-flex items-baseline">
                                    <ExpressionRenderer expression={draft || ','} size={12} />
                                  </span>
                                </div>
                                {onInsertStep && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onInsertStep(theorem.key, i, draft);
                                      setInsertStepOpen(null);
                                      setInsertStepDrafts((prev) => {
                                        const next = { ...prev };
                                        delete next[transitionId];
                                        return next;
                                      });
                                    }}
                                    title="Insert this step and close"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Finalize
                                  </Button>
                                )}
                              </div>
                            )}
                            {secondButtonRow}
                          </>
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
                      <ExpressionRenderer expression={step} size={12} />
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
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

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
            <ExpressionRenderer expression={matchInfo.ruleLeft ?? ','} size={11} />
            <EquivalenceSymbol size={11} className="shrink-0" />
            <ExpressionRenderer expression={matchInfo.ruleRight ?? ','} size={11} />
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
              <div className="font-medium text-foreground/80 mb-1">Pattern rule (exact string):</div>
              <div className="font-mono text-muted-foreground text-[11px] break-all">
                {`${matchInfo.ruleLeft ?? ','} ⇔ ${matchInfo.ruleRight ?? ','}`}
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
                          <ExpressionRenderer expression={e || ','} size={11} />
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
