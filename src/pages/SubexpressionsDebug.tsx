import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateSubexpressions, formatBranchTree } from '@/lib/inferenceRules';
import { ChevronDown, ChevronRight, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

const TESTS = [
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, c \\On,}{, d \\On,}, j \\Op,",
    description: 'expr: single Bb with prefix and suffix',
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, c \\On, c \\Op,}{, d \\On,d \\Op,}, j \\Op,",
    description: 'expr: single Bb with more items',
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{,\\Bb{a \\Pe b}{, c \\On, c  \\Op,}{, d \\On, d \\Op,},}{, d \\On, }, ",
    description: 'expr2: nested Bb in top arm',
  },
  {
    expr: ", i \\Op, \\Bb{a \\Pe b}{, i \\Op,\\Bb{a \\Pe b}{, c \\On, c  \\Op,}{, d \\On, d \\Op,},}{, d \\On, }, i \\Op, ",
    description: 'expr3: nested Bb in top with operation before',
  },
];

const SubexpressionsDebug: React.FC = () => {
  const [selectedTestIndex, setSelectedTestIndex] = useState(0);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const test = TESTS[selectedTestIndex];

  const { subexpressions, positions } = useMemo(() => {
    try {
      const result = generateSubexpressions(test.expr);
      const normalized = test.expr.replace(/\s{2,}/g, ' ');
      const positions = result.map((r) => {
        const pos = normalized.indexOf(r);
        return pos < 0 ? -1 : pos;
      });
      return { subexpressions: result, positions };
    } catch (e) {
      return { subexpressions: [], positions: [] };
    }
  }, [test.expr]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasBranch = (s: string) => /\\B[lr]b|\\Bb/.test(s);

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      <div className="h-16" />

      <main className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
            <Bug className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Subexpressions Debug</h1>
            <p className="text-muted-foreground">
              Generate and inspect all subexpressions. Check boxes to mark subexpressions of interest.
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Test selector */}
          <Card>
            <CardHeader>
              <CardTitle>Test case</CardTitle>
              <CardDescription>Select an example expression to generate subexpressions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={String(selectedTestIndex)}
                onValueChange={(v) => setSelectedTestIndex(Number(v))}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TESTS.map((t, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {t.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-md bg-muted/50 p-4 font-mono text-sm break-all">
                {test.expr}
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Count: <strong className="text-foreground">{subexpressions.length}</strong></span>
                <span>Checked: <strong className="text-foreground">{checkedIds.size}</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* Subexpressions list */}
          <Card>
            <CardHeader>
              <CardTitle>Subexpressions</CardTitle>
              <CardDescription>
                Expand branch expressions to see tree view. Use checkboxes to mark expected/valid entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-1">
                  {subexpressions.map((expr, i) => {
                    const id = `sub-${i}`;
                    const pos = positions[i];
                    const expanded = expandedIds.has(id);
                    const branchExpr = hasBranch(expr);

                    const row = (
                      <div
                        className={cn(
                          'flex items-start gap-3 py-2 px-3 rounded-md border transition-colors',
                          checkedIds.has(id) && 'bg-primary/5 border-primary/30'
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={checkedIds.has(id)}
                          onCheckedChange={() => toggleCheck(id)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {branchExpr && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(id)}
                                className="inline-flex p-0.5 hover:bg-muted rounded cursor-pointer shrink-0"
                                aria-label={expanded ? 'Collapse' : 'Expand'}
                              >
                                {expanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <Label
                              htmlFor={id}
                              className="font-mono text-sm cursor-pointer flex items-center gap-2"
                            >
                              <span className="text-muted-foreground font-normal shrink-0">
                                [{pos >= 0 ? pos : '−1'}]
                              </span>
                              <span className="truncate max-w-[400px]" title={expr}>
                                {expr || '""'}
                              </span>
                            </Label>
                            {branchExpr && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                branch
                              </Badge>
                            )}
                          </div>
                          {branchExpr && expanded && (
                            <pre className="mt-2 p-3 rounded-md bg-muted/50 text-xs font-mono overflow-x-auto whitespace-pre-wrap border">
                              {formatBranchTree(expr)}
                            </pre>
                          )}
                        </div>
                      </div>
                    );

                    return <div key={id}>{row}</div>;
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="text-center">
            <Link
              to="/proof-step"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to Proof Step
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SubexpressionsDebug;
