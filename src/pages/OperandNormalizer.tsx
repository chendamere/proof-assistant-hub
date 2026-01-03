import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { normalizeOperands, normalizeRule, NormalizedOperand } from '@/lib/operandNormalizer';
import { axioms } from '@/data/axioms';
import { ArrowRight, Play, RotateCcw, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const OperandNormalizer: React.FC = () => {
  const [leftExpression, setLeftExpression] = useState(', i \\Pu,');
  const [rightExpression, setRightExpression] = useState(', j \\Pu,');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Normalize the expressions
  const normalizationResult = useMemo(() => {
    try {
      return normalizeRule(leftExpression, rightExpression);
    } catch (error) {
      console.error('Normalization error:', error);
      return null;
    }
  }, [leftExpression, rightExpression]);

  // Handle rule selection
  const handleSelectRule = (ruleId: string) => {
    const rule = axioms.find(r => r.id === ruleId);
    if (rule) {
      setLeftExpression(rule.leftSide);
      setRightExpression(rule.rightSide);
      setSelectedRuleId(ruleId);
    }
  };

  // Get color for operand type
  const getOperandTypeColor = (type: NormalizedOperand['type']) => {
    switch (type) {
      case 'variable':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'function':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'literal':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      <div className="h-16" />

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-glow mb-3">
            Operand Normalization
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Visualize how operands in rules are normalized by instantiating and numbering them from left to right.
          </p>
          
          {/* Explanation Card */}
          <Card className="max-w-4xl mx-auto mt-6 mb-4">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Operands in rules function like universal quantifier variables in traditional propositional logic. 
                When applying a rule during a proof step, these variables must be instantiated to match the specific 
                context of the proof. Normalizing operands is essential for checking whether two expressions are 
                symbolically equivalent. By instantiating all operands from left to right and assigning them 
                sequential integer values, we can compare expressions at a structural level, independent of the 
                specific variable names used in the original rule formulation.
              </p>
            </CardContent>
          </Card>
          
          <Link to="/proof-step">
            <Button variant="outline" className="gap-2">
              Continue to Proof Step
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Rule Selection */}
          <div className="lg:col-span-1 space-y-4">
            {/* Rule Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Rule to Normalize</CardTitle>
                <CardDescription>Choose a rule from the axioms to normalize</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {axioms.slice(0, 50).map((rule) => (
                      <Button
                        key={rule.id}
                        variant={selectedRuleId === rule.id ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2"
                        onClick={() => handleSelectRule(rule.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs truncate">{rule.name}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {rule.leftSide} ≡ {rule.rightSide}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Manual Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Manual Input</CardTitle>
                <CardDescription>Enter expressions manually to test normalization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Left Side
                  </label>
                  <SyntaxInput
                    value={leftExpression}
                    onChange={setLeftExpression}
                    placeholder=", i \\Pu,"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Right Side
                  </label>
                  <SyntaxInput
                    value={rightExpression}
                    onChange={setRightExpression}
                    placeholder=", j \\Pu,"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setLeftExpression(', i \\Pu,');
                    setRightExpression(', j \\Pu,');
                    setSelectedRuleId(null);
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Normalization Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Original Expression */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Original Expression</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <ExpressionRenderer expression={leftExpression} size={20} />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">{leftExpression}</code>
                  </div>
                  <EquivalenceSymbol size={32} />
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <ExpressionRenderer expression={rightExpression} size={20} />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">{rightExpression}</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Normalized Expression */}
            {normalizationResult ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Normalized Expression</CardTitle>
                    <CardDescription>
                      Operands are numbered sequentially from left to right
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex-1 text-center">
                        <div className="mb-2">
                          <ExpressionRenderer expression={normalizationResult.left.originalExpression} size={20} />
                        </div>
                        <code className="text-xs text-primary font-mono">
                          {normalizationResult.left.integerExpression}
                        </code>
                      </div>
                      <EquivalenceSymbol size={32} />
                      <div className="flex-1 text-center">
                        <div className="mb-2">
                          <ExpressionRenderer expression={normalizationResult.right.originalExpression} size={20} />
                        </div>
                        <code className="text-xs text-primary font-mono">
                          {normalizationResult.right.integerExpression}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Operand Mapping - Unique Only */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Operand Mapping</CardTitle>
                    <CardDescription>
                      Unique operands with their normalized versions
                      {normalizationResult.allOperands && (() => {
                        const uniqueCount = new Set(normalizationResult.allOperands.map(o => o.original)).size;
                        return ` (${uniqueCount} unique, ${normalizationResult.allOperands.length} total)`;
                      })()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {normalizationResult.allOperands && normalizationResult.allOperands.length > 0 ? (() => {
                        // Get unique operands by their original value (first occurrence)
                        const seenOperands = new Map<string, NormalizedOperand>();
                        normalizationResult.allOperands.forEach(operand => {
                          if (!seenOperands.has(operand.original)) {
                            seenOperands.set(operand.original, operand);
                          }
                        });
                        const uniqueOperands = Array.from(seenOperands.values());
                        
                        return uniqueOperands.map((operand, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-muted/30 rounded border border-border"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                #{operand.position}
                              </Badge>
                              <Badge className={getOperandTypeColor(operand.type)}>
                                {operand.type}
                              </Badge>
                              <code className="text-xs font-mono text-foreground">
                                {operand.original}
                              </code>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                            <code className="text-xs font-mono text-primary font-semibold">
                              {operand.normalizedNumber}
                            </code>
                          </div>
                        ));
                      })() : (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No operands found
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Enter expressions above to see normalization results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OperandNormalizer;
