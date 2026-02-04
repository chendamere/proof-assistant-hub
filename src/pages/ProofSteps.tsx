import React, { useState, useEffect, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { checkInferenceRules, CheckInferenceRulesOptions } from '@/lib/inferenceRules';
import { axioms, Rule } from '@/data/axioms';
import { theorems } from '@/data/theorems';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, ChevronRight, FileText, ListOrdered, CheckCircle2, Play, Check, X } from 'lucide-react';

type ProofStepsTable = Record<string, string[]>;

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

function verifyTransition(
  targetLeft: string,
  targetRight: string,
  axioms: Rule[],
  theorems: Rule[],
  cache: Map<string, { l2r: { left: string; right: string }; r2l: { left: string; right: string } }>,
  options?: CheckInferenceRulesOptions
): boolean {
  const tryRule = (rule: Rule) => {
    const cached = cache.get(rule.id);
    if (!cached) return false;
    if (checkInferenceRules(targetLeft, targetRight, cached.l2r.left, cached.l2r.right, options).match) return true;
    if (checkInferenceRules(targetLeft, targetRight, cached.r2l.left, cached.r2l.right, options).match) return true;
    return false;
  };
  for (const rule of axioms) {
    if (tryRule(rule)) return true;
  }
  for (const rule of theorems) {
    if (tryRule(rule)) return true;
  }
  return false;
}

function verifyTransitionWithLogging(
  targetLeft: string,
  targetRight: string,
  axioms: Rule[],
  theorems: Rule[],
  cache: Map<string, { l2r: { left: string; right: string }; r2l: { left: string; right: string } }>,
  transitionLabel: string
): boolean {
  const totalRules = axioms.length + theorems.length;
  console.group(`[Check step] ${transitionLabel}`);
  console.log(`Considering ${axioms.length} axioms and ${theorems.length} theorems (${totalRules} total)`);
  let totalVf2Steps = 0;
  const options: CheckInferenceRulesOptions = {
    onProgress: (info) => {
      if (info.vf2Steps != null) totalVf2Steps += info.vf2Steps;
      if (info.inferenceRule === 'Equivalent Substitution' && info.vf2Steps != null && info.vf2Steps > 0) {
        console.log(`    → Substitution tried: ${info.vf2Steps} VF2 steps`);
      }
    },
  };
  const tryRule = (rule: Rule, isAxiom: boolean) => {
    const cached = cache.get(rule.id);
    if (!cached) return false;
    const ruleType = isAxiom ? 'axiom' : 'theorem';
    console.log(`  Trying ${ruleType} "${rule.id}" (l2r)...`);
    if (checkInferenceRules(targetLeft, targetRight, cached.l2r.left, cached.l2r.right, options).match) return true;
    console.log(`  Trying ${ruleType} "${rule.id}" (r2l)...`);
    if (checkInferenceRules(targetLeft, targetRight, cached.r2l.left, cached.r2l.right, options).match) return true;
    return false;
  };
  for (const rule of axioms) {
    if (tryRule(rule, true)) {
      console.log(`Total VF2 substitution steps: ${totalVf2Steps}`);
      console.groupEnd();
      return true;
    }
  }
  for (const rule of theorems) {
    if (tryRule(rule, false)) {
      console.log(`Total VF2 substitution steps: ${totalVf2Steps}`);
      console.groupEnd();
      return true;
    }
  }
  console.log(`Total VF2 substitution steps: ${totalVf2Steps}`);
  console.groupEnd();
  return false;
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
  const [table, setTable] = useState<ProofStepsTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [chapter, setChapter] = useState<string>('Theorems_of_Identical_Node_Comparison');
  const [tab, setTab] = useState<'all' | 'verified'>('all');
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  const [verificationProgress, setVerificationProgress] = useState<number | null>(null);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [singleProofVerifying, setSingleProofVerifying] = useState<string | null>(null);
  const [transitionVerifying, setTransitionVerifying] = useState<string | null>(null);
  const [transitionResults, setTransitionResults] = useState<Record<string, Record<number, boolean>>>({});

  const normalizedRulesCache = useMemo(() => {
    const cache = new Map<string, { l2r: { left: string; right: string }; r2l: { left: string; right: string } }>();
    [...axioms, ...theorems].forEach((rule) => {
      cache.set(rule.id, {
        l2r: { left: rule.leftSide, right: rule.rightSide },
        r2l: { left: rule.rightSide, right: rule.leftSide },
      });
    });
    return cache;
  }, []);

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
      })
      .finally(() => setLoading(false));
  }, []);

  const runVerification = React.useCallback(() => {
    if (!table || verificationStarted) return;
    setVerificationStarted(true);
  }, [table, verificationStarted]);

  const verifySingleProof = React.useCallback((key: string) => {
    setSingleProofVerifying(key);
  }, []);

  const verifySingleTransition = React.useCallback(
    (key: string, transitionIndex: number) => {
      const transitionId = `${key}::${transitionIndex}`;
      if (transitionVerifying) return;
      const steps = table?.[key];
      if (!steps || transitionIndex < 0 || transitionIndex >= steps.length - 1) return;
      setTransitionVerifying(transitionId);
      const left = steps[transitionIndex];
      const right = steps[transitionIndex + 1];
      const schedule =
        typeof requestIdleCallback !== 'undefined'
          ? (fn: () => void) => requestIdleCallback(fn, { timeout: 50 })
          : (fn: () => void) => setTimeout(fn, 0);
      schedule(() => {
        const label = `step ${transitionIndex + 1} → step ${transitionIndex + 2}`;
        const matched = verifyTransitionWithLogging(left, right, axioms, theorems, normalizedRulesCache, label);
        setTransitionResults((prev) => ({
          ...prev,
          [key]: { ...prev[key], [transitionIndex]: matched },
        }));
        setVerificationResults((prev) => {
          const cur = prev[key] ?? { passed: 0, total: 0 };
          return {
            ...prev,
            [key]: {
              passed: cur.passed + (matched ? 1 : 0),
              total: cur.total + 1,
            },
          };
        });
        setTransitionVerifying(null);
      });
    },
    [table, transitionVerifying, axioms, theorems, normalizedRulesCache]
  );

  useEffect(() => {
    setVerificationResults({});
    setVerificationProgress(null);
    setVerificationStarted(false);
    setTransitionResults({});
  }, [chapter]);

  const entriesToVerify = React.useMemo(() => {
    if (!table) return [];
    return Object.entries(table).filter(([key, steps]) => {
      if (steps.length === 0) return false;
      if (chapter === 'all') return true;
      const { filename } = parseKey(key);
      return filename === chapter;
    });
  }, [table, chapter]);

  const transitionsToVerify = React.useMemo(() => {
    const work: { key: string; left: string; right: string }[] = [];
    for (const [key, steps] of entriesToVerify) {
      for (let i = 0; i < steps.length - 1; i++) {
        work.push({ key, left: steps[i], right: steps[i + 1] });
      }
    }
    return work;
  }, [entriesToVerify]);

  useEffect(() => {
    if (!table || !verificationStarted) return;
    const work = transitionsToVerify;
    const total = work.length;
    if (total === 0) {
      setVerificationProgress(null);
      return;
    }
    setVerificationProgress(0);
    let idx = 0;
    let cancelled = false;

    const processOne = () => {
      if (cancelled || idx >= total) {
        setVerificationProgress(null);
        return;
      }
      const { key, left, right } = work[idx];
      const matched = verifyTransition(left, right, axioms, theorems, normalizedRulesCache);
      setVerificationResults((prev) => {
        const current = prev[key] ?? { passed: 0, total: 0 };
        return {
          ...prev,
          [key]: {
            passed: current.passed + (matched ? 1 : 0),
            total: current.total + 1,
          },
        };
      });
      setVerificationProgress(idx + 1);
      idx++;
      const schedule =
        typeof requestIdleCallback !== 'undefined'
          ? () => requestIdleCallback(() => processOne(), { timeout: 50 })
          : () => setTimeout(processOne, 16);
      if (idx < total) schedule();
      else setVerificationProgress(null);
    };

    const startId = setTimeout(processOne, 100);
    return () => {
      cancelled = true;
      clearTimeout(startId);
    };
  }, [table, verificationStarted, transitionsToVerify, axioms, theorems, normalizedRulesCache]);

  useEffect(() => {
    if (!table || !singleProofVerifying) return;
    const steps = table[singleProofVerifying];
    if (!steps || steps.length < 2) {
      setSingleProofVerifying(null);
      return;
    }
    const work: { left: string; right: string }[] = [];
    for (let i = 0; i < steps.length - 1; i++) {
      work.push({ left: steps[i], right: steps[i + 1] });
    }
    const key = singleProofVerifying;
    let idx = 0;
    let cancelled = false;

    const processOne = () => {
      if (cancelled || idx >= work.length) {
        setSingleProofVerifying(null);
        return;
      }
      const { left, right } = work[idx];
      const matched = verifyTransition(left, right, axioms, theorems, normalizedRulesCache);
      setVerificationResults((prev) => {
        const current = prev[key] ?? { passed: 0, total: 0 };
        return {
          ...prev,
          [key]: {
            passed: current.passed + (matched ? 1 : 0),
            total: current.total + 1,
          },
        };
      });
      idx++;
      const schedule =
        typeof requestIdleCallback !== 'undefined'
          ? () => requestIdleCallback(() => processOne(), { timeout: 50 })
          : () => setTimeout(processOne, 16);
      if (idx < work.length) schedule();
      else setSingleProofVerifying(null);
    };

    const startId = setTimeout(processOne, 100);
    return () => {
      cancelled = true;
      clearTimeout(startId);
    };
  }, [table, singleProofVerifying, axioms, theorems, normalizedRulesCache]);

  const theoremsWithSteps: TheoremWithSteps[] = React.useMemo(() => {
    if (!table) return [];
    return Object.entries(table)
      .filter(([, steps]) => steps.length > 0)
      .map(([key, steps]) => {
        const { filename, index, ruleStr } = parseKey(key);
        return { key, filename, index, ruleStr, steps };
      })
      .sort((a, b) => {
        const cmp = a.filename.localeCompare(b.filename);
        return cmp !== 0 ? cmp : a.index - b.index;
      });
  }, [table]);

  const chapters = React.useMemo(() => {
    const set = new Set(theoremsWithSteps.map((t) => t.filename));
    return Array.from(set).sort();
  }, [theoremsWithSteps]);

  const filtered = React.useMemo(() => {
    let list = theoremsWithSteps;
    if (tab === 'verified') {
      list = list.filter((t) => {
        const v = verificationResults[t.key];
        return v && v.total > 0 && v.passed === v.total;
      });
    }
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
  }, [theoremsWithSteps, chapter, search, tab, verificationResults]);

  const fullyVerifiedCount = useMemo(() => {
    return theoremsWithSteps.filter((t) => {
      const v = verificationResults[t.key];
      return v && v.total > 0 && v.passed === v.total;
    }).length;
  }, [theoremsWithSteps, verificationResults]);

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
      <main className="flex-1 pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-foreground mb-1">
                  Theorems with Proof Steps
                </h1>
                <p className="text-sm text-muted-foreground">
                  {theoremsWithSteps.length} theorems have proofs extracted from the LaTeX sources
{verificationProgress !== null && (
                <span className="ml-2 text-primary"> · Verifying {verificationProgress}/{transitionsToVerify.length} transitions...</span>
              )}
                </p>
              </div>
              {!verificationStarted && entriesToVerify.length > 0 && (
                <Button variant="outline" size="sm" onClick={runVerification} className="gap-2">
                  <Play className="w-4 h-4" />
                  Verify proofs ({entriesToVerify.length})
                </Button>
              )}
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'verified')} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All proofs</TabsTrigger>
              <TabsTrigger value="verified">
                Fully verified {verificationStarted ? `(${fullyVerifiedCount})` : ''}
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
                    {ch}
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
                  onVerifyProof={verifySingleProof}
                  isVerifying={singleProofVerifying === t.key}
                  onVerifyTransition={verifySingleTransition}
                  transitionVerifying={transitionVerifying}
                  transitionResults={transitionResults[t.key]}
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-muted-foreground py-8 text-center">
                  {tab === 'verified' && !verificationStarted
                    ? 'Click "Verify proofs" to check which proofs pass all inference steps.'
                    : 'No theorems match your search'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
      <Footer />
    </div>
  );
};

function TheoremCard({
  theorem,
  verification,
  onVerifyProof,
  isVerifying,
  onVerifyTransition,
  transitionVerifying,
  transitionResults = {},
}: {
  theorem: TheoremWithSteps;
  verification?: VerificationResult;
  onVerifyProof?: (key: string) => void;
  isVerifying?: boolean;
  onVerifyTransition?: (key: string, transitionIndex: number) => void;
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
            <div className="border-t border-border pt-3 space-y-3">
              {onVerifyProof && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVerifyProof(theorem.key);
                  }}
                  disabled={isVerifying}
                  className="gap-2"
                >
                  {isVerifying ? (
                    <>Verifying...</>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Verify Proof
                    </>
                  )}
                </Button>
              )}
              <div className="space-y-1">
              {theorem.steps.map((step, i) => (
                <React.Fragment key={i}>
                  {i > 0 && onVerifyTransition && (
                    <div className="flex items-center gap-2 py-1">
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
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default ProofSteps;
