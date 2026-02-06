import React, { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import WorkbenchContainer from '@/components/workbench/WorkbenchContainer';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import { usePanelContext } from '@/contexts/PanelContext';
import { Copy } from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { axioms } from '@/data/axioms';
import { verifyTransitionWorker } from '@/lib/transitionVerificationWorkerClient';
import { definitions } from '@/data/definitions';
import { theorems } from '@/data/theorems';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronRight, FileText, ListOrdered, CheckCircle2, Check, X } from 'lucide-react';

type ProofStepsTable = Record<string, string[]>;

/** Chapter order and book indices from "The Way of Machine Thinking" (Volume 1). */
const CHAPTER_ORDER: string[] = [
  'axioms', 'relationships', 'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison', 'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand', 'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction', 'Recursive_Function_R', 'Previous_Order_Induction',
  'Recursive_Function_R_Prev', 'Rules_of_Node_Ring', 'Rules_of_Node_Connectivity',
  'Rules_of_Node_Continuity', 'Rules_of_Relationship_of_Subnode',
  'Tree_Order_Induction', 'Recursive_Function_Rc', 'Rules_of_Number_Equal_Relationship',
  'Rules_of_Number_More_Less_Than', 'Rules_of_Assign_Operator_Temp_Space',
  'Axioms_of_Assign_Operator', 'Theorems_of_Insert_Node_Function',
  'Theorems_of_Delete_Node_Function', 'Theorems_of_Assign_Operator',
  'Function_Cpo', 'Recursive_Function_Rcpo', 'Addition', 'Recursive_Function_Rcpm',
  'Multiplication', 'Paradox',
];
/** Book chapter indices (3, 4, 6, 7, ... 32, then appendix). */
const CHAPTER_INDICES: number[] = [
  3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31, 32, 99, // 99 = Paradox (appendix)
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

const ProofSteps: React.FC = () => {
  const { isWorkbenchExpanded, isRulesPanelOpen, setDebugWorkbenchExpressions } = usePanelContext();
  const [table, setTable] = useState<ProofStepsTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>('Theorems_of_Identical_Node_Comparison');
  const [transitionVerifying, setTransitionVerifying] = useState<string | null>(null);
  const [transitionResults, setTransitionResults] = useState<Record<string, Record<number, boolean>>>({});

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
    fetch('/proof-steps-table.json')
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
    async (key: string, transitionIndex: number) => {
      const transitionId = `${key}::${transitionIndex}`;
      if (transitionVerifying) return;
      const steps = table?.[key];
      if (!steps || transitionIndex < 0 || transitionIndex >= steps.length - 1) return;
      setTransitionVerifying(transitionId);
      const left = steps[transitionIndex];
      const right = steps[transitionIndex + 1];
      try {
        const matched = await verifyTransitionWorker({
          targetLeft: left,
          targetRight: right,
          rules: rulesForWorker,
        });
        setTransitionResults((prev) => ({
          ...prev,
          [key]: { ...prev[key], [transitionIndex]: matched },
        }));
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

  useEffect(() => {
    setTransitionResults({});
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
        return { key, filename, index, ruleStr, steps };
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
          t.ruleStr.toLowerCase().includes(q)
      );
    }
    return list;
  }, [theoremsWithSteps, chapter, search]);

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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Theorems with Proof Steps
            </h1>
            <p className="text-sm text-muted-foreground">
              {theoremsWithSteps.length} theorems have proofs extracted from the LaTeX sources. Use &quot;Check step&quot; to verify each transition.
            </p>
          </div>

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
                    {getChapterIndex(ch) < 99 ? `${getChapterIndex(ch)}. ` : ''}{ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="space-y-3 pr-4">
              {filtered.map((t) => (
                <TheoremCard
                  key={t.key}
                  theorem={t}
                  verification={verificationResults[t.key]}
                  onVerifyTransition={verifySingleTransition}
                  onCopyToDebug={setDebugWorkbenchExpressions}
                  transitionVerifying={transitionVerifying}
                  transitionResults={transitionResults[t.key]}
                />
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
  verification,
  onVerifyTransition,
  onCopyToDebug,
  transitionVerifying,
  transitionResults = {},
}: {
  theorem: TheoremWithSteps;
  verification?: VerificationResult;
  onVerifyTransition?: (key: string, transitionIndex: number) => void;
  onCopyToDebug?: (left: string, right: string) => void;
  transitionVerifying?: string | null;
  transitionResults?: Record<number, boolean>;
}) {
  const [open, setOpen] = useState(false);
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
                <Badge variant="secondary" className="text-xs font-mono">
                  <FileText className="w-3 h-3 mr-1" />
                  {theorem.filename}
                </Badge>
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
                    <div className="flex items-center gap-2 py-1">
                      {onVerifyTransition && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onVerifyTransition(theorem.key, i - 1);
                          }}
                          disabled={transitionVerifying !== null}
                        >
                          {transitionVerifying === `${theorem.key}::${i - 1}` ? (
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
                      )}
                      {onCopyToDebug && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyToDebug(theorem.steps[i - 1], theorem.steps[i]);
                          }}
                          title="Copy to Debug workbench"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy to Debug
                        </Button>
                      )}
                    </div>
                  )}
                  <div
                    className="flex items-start gap-2 text-sm py-1.5 px-2 rounded bg-muted/30 border border-border/50"
                  >
                    <span className="text-muted-foreground shrink-0 font-mono w-6">{i + 1}.</span>
                    <ExpressionRenderer expression={step} size={12} />
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

export default ProofSteps;
