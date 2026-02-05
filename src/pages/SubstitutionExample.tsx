/**
 * Substitution Example page: trySubstitution with dagToExpr reconstruction.
 * Mix of branch and non-branch theorems. Click "Try" to run each example.
 */

import { useState, useCallback } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { trySubstitutionWorker } from '@/lib/substitutionWorkerClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play } from 'lucide-react';

interface SubExample {
  name: string;
  target: string;
  expectedResult: string;
  ruleLeft: string;
  ruleRight: string;
  ruleName: string;
  isBranch: boolean;
}

function buildExamples(): SubExample[] {
  const examples: SubExample[] = [
    // Non-branch: ID Swap
    {
      name: 'ID Swap (different nodes)',
      target: ', a \\Od b, c \\Od d,',
      expectedResult: ', c \\Od d, a \\Od b,',
      ruleLeft: ',i \\Od m, j \\Od n,',
      ruleRight: ',j \\Od n, i \\Od m,',
      ruleName: 'swap-id-2',
      isBranch: false,
    },
    // Non-branch: Copy Swap
    {
      name: 'Copy Swap',
      target: ', a \\Oc b, c \\Oc d,',
      expectedResult: ', c \\Oc d, a \\Oc b,',
      ruleLeft: ',i \\Oc m, j \\Oc n,',
      ruleRight: ',j \\Oc n, i \\Oc m,',
      ruleName: 'swap-copy-copy',
      isBranch: false,
    },
    // Non-branch: Copy-Release
    {
      name: 'Copy-Release Swap',
      target: ', a \\Oc b, b \\Os,',
      expectedResult: ', b \\Os, a \\Oc b,',
      ruleLeft: ',i \\Oc m, j \\Os,',
      ruleRight: ', j \\Os, i \\Oc m,',
      ruleName: 'swap-copy-release',
      isBranch: false,
    },
    // Branch: ID-Branch Distribution
    {
      name: 'ID-Branch Distribution',
      target: ', a \\Od b, \\Blb{c \\Oe d}{,}{,},',
      expectedResult: ', \\Blb{c \\Oe d}{,a \\Od b,}{,a \\Od b,},',
      ruleLeft: ',i \\Od m, \\Blb{j \\Oe t}{,}{,},',
      ruleRight: ', \\Blb{j \\Oe t}{,i \\Od m,}{,i \\Od m,},',
      ruleName: 'swap-id-branch',
      isBranch: true,
    },
    // Branch: arm swap (Od-Oc)
    {
      name: 'Branch arm swap (Od-Oc)',
      target: ', \\Bb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},',
      expectedResult: ', \\Bb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},',
      ruleLeft: ', i \\Od j, j \\Oc k,',
      ruleRight: ', i \\Od j, k \\Oc j,',
      ruleName: 'od-oc-swap',
      isBranch: true,
    },
  ];

  return examples;
}

const EXAMPLES = buildExamples();

function ExampleCard({
  ex,
  result,
  direction,
  onRun,
  isRunning,
}: {
  ex: SubExample;
  result: { reconstructedExpr?: string } | null;
  direction: string | null;
  onRun: () => void;
  isRunning: boolean;
}) {
  const reconstructed = result && 'reconstructedExpr' in result ? (result as { reconstructedExpr?: string }).reconstructedExpr : null;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{ex.name}</CardTitle>
            <Badge variant={ex.isBranch ? 'default' : 'secondary'} className="text-xs">
              {ex.isBranch ? 'Branch' : 'Non-branch'}
            </Badge>
            <Badge variant={result ? 'default' : 'outline'} className={result ? 'bg-green-600' : ''}>
              {result ? 'Match' : 'No match'}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onRun} disabled={isRunning} className="gap-2">
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Try'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4 space-y-3 text-sm">
        <div>
          <p className="font-semibold text-muted-foreground mb-1">Target</p>
          <p className="font-mono text-xs bg-muted/30 p-2 rounded break-all">{ex.target}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground mb-1">Rule A ⟺ B</p>
          <p className="font-mono text-xs">A: {ex.ruleLeft}</p>
          <p className="font-mono text-xs">B: {ex.ruleRight}</p>
        </div>
        <div>
          <p className="font-semibold text-muted-foreground mb-1">Expected result</p>
          <p className="font-mono text-xs bg-muted/30 p-2 rounded break-all">{ex.expectedResult}</p>
        </div>
        {result && direction && (
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Direction</p>
            <p className="text-xs">{direction}</p>
          </div>
        )}
        {reconstructed && (
          <div>
            <p className="font-semibold text-green-700 dark:text-green-400 mb-1">Reconstructed (dagToExpr)</p>
            <p className="font-mono text-xs bg-green-500/10 dark:bg-green-500/20 p-2 rounded break-all border border-green-500/30">
              {reconstructed}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SubstitutionExample() {
  const [results, setResults] = useState<Record<number, { result: Awaited<ReturnType<typeof trySubstitutionWorker>>; direction: string | null }>>({});
  const [runningIndex, setRunningIndex] = useState<number | null>(null);

  const runExample = useCallback((index: number) => {
    const ex = EXAMPLES[index];
    if (!ex || runningIndex !== null) return;
    setRunningIndex(index);
    const schedule =
      typeof requestIdleCallback !== 'undefined'
        ? (fn: () => void) => requestIdleCallback(fn, { timeout: 50 })
        : (fn: () => void) => setTimeout(fn, 0);
    schedule(async () => {
      try {
        const [leftRuleLeft, leftRuleRight, rightRuleLeft, rightRuleRight] = await Promise.all([
          trySubstitutionWorker({ target: ex.target, ruleSide: ex.ruleLeft, otherRuleSide: ex.ruleRight, expectedResult: ex.expectedResult, targetSideForOperands: ex.target, side: 'left' }).catch(() => null),
          trySubstitutionWorker({ target: ex.target, ruleSide: ex.ruleRight, otherRuleSide: ex.ruleLeft, expectedResult: ex.expectedResult, targetSideForOperands: ex.target, side: 'left' }).catch(() => null),
          trySubstitutionWorker({ target: ex.expectedResult, ruleSide: ex.ruleLeft, otherRuleSide: ex.ruleRight, expectedResult: ex.target, targetSideForOperands: ex.expectedResult, side: 'right' }).catch(() => null),
          trySubstitutionWorker({ target: ex.expectedResult, ruleSide: ex.ruleRight, otherRuleSide: ex.ruleLeft, expectedResult: ex.target, targetSideForOperands: ex.expectedResult, side: 'right' }).catch(() => null),
        ]);

        const match = leftRuleLeft ?? leftRuleRight ?? rightRuleLeft ?? rightRuleRight;
        const direction = leftRuleLeft
          ? 'target: ruleLeft→ruleRight'
          : leftRuleRight
            ? 'target: ruleRight→ruleLeft'
            : rightRuleLeft
              ? 'expectedResult: ruleLeft→ruleRight'
              : rightRuleRight
                ? 'expectedResult: ruleRight→ruleLeft'
                : null;

        setResults((prev) => ({ ...prev, [index]: { result: match, direction } }));
      } finally {
        setRunningIndex(null);
      }
    });
  }, [runningIndex]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Substitution Examples
            </h1>
            <p className="text-sm text-muted-foreground">
              Click "Try" on each example to run trySubstitution and show the reconstructed dagToExpr result.
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-4 pr-4">
              {EXAMPLES.map((ex, i) => (
                <ExampleCard
                  key={i}
                  ex={ex}
                  result={results[i]?.result ?? null}
                  direction={results[i]?.direction ?? null}
                  onRun={() => runExample(i)}
                  isRunning={runningIndex === i}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </main>
      <Footer />
    </div>
  );
}
