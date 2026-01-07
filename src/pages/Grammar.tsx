import React, { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { OperatorLegend } from '@/components/operators/OperatorSymbols';
import { checkGrammar, GrammarError } from '@/lib/grammarChecker';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

const Grammar: React.FC = () => {
  const [expression, setExpression] = useState('');
  const [checkResult, setCheckResult] = useState<ReturnType<typeof checkGrammar> | null>(null);

  const handleCheck = () => {
    if (expression.trim()) {
      const result = checkGrammar(expression);
      setCheckResult(result);
    }
  };

  const handleClear = () => {
    setExpression('');
    setCheckResult(null);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16" />
      
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-foreground">Expression Grammar</h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Understanding the grammar rules that govern how operands can be instantiated and used in expressions
            </p>
          </div>

          {/* Grammar Rules Section */}
          <Card>
            <CardHeader>
              <CardTitle>Grammar Rules</CardTitle>
              <CardDescription>
                The fundamental rules that govern operand instantiation in expressions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border">
                  <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">Operand Instantiation Rule</h3>
                    <p className="text-sm text-muted-foreground">
                      From left to right, if an operand is instantiated with an operator that instantiates operands, 
                      it <strong>cannot be instantiated again</strong> in subsequent operations unless it is 
                      <strong> released</strong> with the release operator (<code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Os</code>).
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Operators that Instantiate Operands
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Oa</code> - Assign</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Ob</code> - Subnode</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Oc</code> - Copy</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Od</code> - ID</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Og</code> - Global Space</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Ot</code> - Temp Space</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Operators that Don't Instantiate
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Or</code> - Logic Error</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Oe</code> - Equivalence (Branch)</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\On</code> - Next Node</li>
                      <li><code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Op</code> - Previous Node</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-4">
                  <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Important Notes
                  </h4>
                   <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                     <li>The release operator (<code className="px-1.5 py-0.5 rounded bg-muted text-xs">\Os</code>) releases an operand, allowing it to be instantiated again.</li>
                     <li>You <strong>cannot release an operand</strong> if it does not appear in previous operations (i.e., it must be instantiated first).</li>
                     <li>Operators are processed from left to right in the expression.</li>
                   </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grammar Checker Section */}
          <Card>
            <CardHeader>
              <CardTitle>Grammar Checker</CardTitle>
              <CardDescription>
                Enter an expression to check if it follows the grammar rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter expression, e.g., ,i \Od m, j \Oc i,"
                  value={expression}
                  onChange={(e) => setExpression(e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button onClick={handleCheck} disabled={!expression.trim()}>
                    Check Grammar
                  </Button>
                  <Button variant="outline" onClick={handleClear}>
                    Clear
                  </Button>
                </div>
              </div>

              {checkResult && (
                <div className="space-y-3">
                  {checkResult.isValid ? (
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertTitle className="text-green-600 dark:text-green-400">Valid Expression</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        The expression follows all grammar rules.
                        {checkResult.instantiatedOperands.size > 0 && (
                          <div className="mt-2">
                            <span className="text-xs font-semibold">Currently instantiated operands: </span>
                            <span className="text-xs">
                              {Array.from(checkResult.instantiatedOperands).join(', ') || 'none'}
                            </span>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Grammar Errors Found</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          {checkResult.errors.map((error, idx) => (
                            <div key={idx} className="p-2 rounded bg-destructive/10 border border-destructive/20">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="destructive" className="text-xs">
                                  Position {error.position}
                                </Badge>
                                <span className="text-xs font-mono text-destructive">
                                  Operand: {error.operand}
                                </span>
                              </div>
                              <p className="text-sm text-destructive/90">{error.message}</p>
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Example Expressions */}
              <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold text-sm mb-3">Example Expressions</h4>
                <div className="space-y-2 text-sm">
                   <div>
                     <code className="text-xs text-muted-foreground">Valid: </code>
                     <code className="text-xs font-mono px-2 py-1 rounded bg-muted">
                       ,i \Od m, i \Oc n,
                     </code>
                     <span className="text-xs text-muted-foreground ml-2">(m and n are instantiated, i is the source)</span>
                   </div>
                   <div>
                     <code className="text-xs text-muted-foreground">Invalid: </code>
                     <code className="text-xs font-mono px-2 py-1 rounded bg-muted">
                       ,i \Od m, j \Od m,
                     </code>
                     <span className="text-xs text-muted-foreground ml-2">(m instantiated twice without release)</span>
                   </div>
                   <div>
                     <code className="text-xs text-muted-foreground">Valid: </code>
                     <code className="text-xs font-mono px-2 py-1 rounded bg-muted">
                       ,i \Od m, i \Os, i \Oc n,
                     </code>
                     <span className="text-xs text-muted-foreground ml-2">(i instantiated, released, then instantiated again)</span>
                   </div>
                   <div>
                     <code className="text-xs text-muted-foreground">Invalid: </code>
                     <code className="text-xs font-mono px-2 py-1 rounded bg-muted">
                       ,i \Os, j \Od m,
                     </code>
                     <span className="text-xs text-muted-foreground ml-2">(i released without being instantiated first)</span>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primitive Operators Section */}
          <Card>
            <CardHeader>
              <CardTitle>The 11 Primitive Operators</CardTitle>
              <CardDescription>
                Complete reference of all primitive operators in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OperatorLegend />
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Grammar;
