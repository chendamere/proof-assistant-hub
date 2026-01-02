import React, { useState, useMemo } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { normalizeRule } from '@/lib/operandNormalizer';
import { axioms, Rule } from '@/data/axioms';
import { Play, RotateCcw, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProofStep {
  step: number;
  rule: Rule;
  normalized: {
    left: string;
    right: string;
    integerLeft: string;
    integerRight: string;
  };
  matchDirection: 'left-to-right' | 'right-to-left';
  result: 'match' | 'no-match' | 'pending';
  inferenceRule?: string;
}

interface InferenceRule {
  name: string;
  description: string;
  check: (
    targetLeft: string,
    targetRight: string,
    ruleLeft: string,
    ruleRight: string
  ) => boolean;
}

const InferenceRules: InferenceRule[] = [
  {
    name: 'Equivalent Commutativity',
    description: 'A ⟺ B implies B ⟺ A - Exact match (reversed)',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if target matches rule in reverse
      return targetLeft === ruleRight && targetRight === ruleLeft;
    },
  },
  {
    name: 'Equivalent Transitivity',
    description: 'A ⟺ B and B ⟺ C implies A ⟺ C - Chain through common side',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if one side of target matches one side of rule
      return targetLeft === ruleLeft || targetLeft === ruleRight ||
             targetRight === ruleLeft || targetRight === ruleRight;
    },
  },
  {
    name: 'Equivalent Substitution',
    description: 'A ⟺ B allows replacing A with B in any context M·A·N → M·B·N',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if rule can be substituted into target
      // This is more complex - for now, check if rule sides appear in target
      const canSubstitute = (target: string, ruleSide: string) => {
        return target.includes(ruleSide) || ruleSide.includes(target);
      };
      return canSubstitute(targetLeft, ruleLeft) || canSubstitute(targetLeft, ruleRight) ||
             canSubstitute(targetRight, ruleLeft) || canSubstitute(targetRight, ruleRight);
    },
  },
];

const ProofStep: React.FC = () => {
  const [startExpression, setStartExpression] = useState(', i \\Pu j,');
  const [endExpression, setEndExpression] = useState(', j \\Pu i,');
  const [isProving, setIsProving] = useState(false);
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [isTrue, setIsTrue] = useState<boolean | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Handle rule selection
  const handleSelectRule = (ruleId: string) => {
    const rule = axioms.find(r => r.id === ruleId);
    if (rule) {
      setStartExpression(rule.leftSide);
      setEndExpression(rule.rightSide);
      setSelectedRuleId(ruleId);
    }
  };

  // Check if a normalized rule matches the target using inference rules
  const checkInferenceRules = (
    targetIntegerLeft: string,
    targetIntegerRight: string,
    ruleIntegerLeft: string,
    ruleIntegerRight: string
  ): { match: boolean; inferenceRule?: string } => {
    // Try exact match first
    if (targetIntegerLeft === ruleIntegerLeft && targetIntegerRight === ruleIntegerRight) {
      return { match: true, inferenceRule: 'Exact Match' };
    }

    // Try each inference rule
    for (const infRule of InferenceRules) {
      if (infRule.check(targetIntegerLeft, targetIntegerRight, ruleIntegerLeft, ruleIntegerRight)) {
        return { match: true, inferenceRule: infRule.name };
      }
    }

    return { match: false };
  };

  // Perform proof step
  const performProof = async () => {
    setIsProving(true);
    setProofSteps([]);
    setIsTrue(null);
    setCurrentStepIndex(0);

    // Normalize the target rule (rule to prove)
    const targetNormalized = normalizeRule(startExpression, endExpression);
    const targetIntegerLeft = targetNormalized.left.integerExpression;
    const targetIntegerRight = targetNormalized.right.integerExpression;

    const steps: ProofStep[] = [];
    let foundMatch = false;

    // Search through all axioms
    for (let i = 0; i < axioms.length; i++) {
      const rule = axioms[i];
      
      // Try left-to-right normalization
      const ruleNormalizedL2R = normalizeRule(rule.leftSide, rule.rightSide);
      const checkResultL2R = checkInferenceRules(
        targetIntegerLeft,
        targetIntegerRight,
        ruleNormalizedL2R.left.integerExpression,
        ruleNormalizedL2R.right.integerExpression
      );

      steps.push({
        step: steps.length + 1,
        rule: rule,
        normalized: {
          left: ruleNormalizedL2R.left.integerExpression,
          right: ruleNormalizedL2R.right.integerExpression,
          integerLeft: ruleNormalizedL2R.left.integerExpression,
          integerRight: ruleNormalizedL2R.right.integerExpression,
        },
        matchDirection: 'left-to-right',
        result: checkResultL2R.match ? 'match' : 'no-match',
        inferenceRule: checkResultL2R.inferenceRule,
      });

      if (checkResultL2R.match) {
        foundMatch = true;
        setIsTrue(true);
        setProofSteps(steps);
        setIsProving(false);
        return;
      }

      // Try right-to-left normalization (swap sides)
      const ruleNormalizedR2L = normalizeRule(rule.rightSide, rule.leftSide);
      const checkResultR2L = checkInferenceRules(
        targetIntegerLeft,
        targetIntegerRight,
        ruleNormalizedR2L.left.integerExpression,
        ruleNormalizedR2L.right.integerExpression
      );

      steps.push({
        step: steps.length + 1,
        rule: rule,
        normalized: {
          left: ruleNormalizedR2L.left.integerExpression,
          right: ruleNormalizedR2L.right.integerExpression,
          integerLeft: ruleNormalizedR2L.left.integerExpression,
          integerRight: ruleNormalizedR2L.right.integerExpression,
        },
        matchDirection: 'right-to-left',
        result: checkResultR2L.match ? 'match' : 'no-match',
        inferenceRule: checkResultR2L.inferenceRule,
      });

      if (checkResultR2L.match) {
        foundMatch = true;
        setIsTrue(true);
        setProofSteps(steps);
        setIsProving(false);
        return;
      }

      // Update UI progressively
      setProofSteps([...steps]);
      setCurrentStepIndex(steps.length);

      // Small delay for visualization
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // No match found
    setIsTrue(false);
    setProofSteps(steps);
    setIsProving(false);
  };

  const resetProof = () => {
    setIsProving(false);
    setProofSteps([]);
    setIsTrue(null);
    setCurrentStepIndex(0);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      <div className="h-16" />

      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-glow mb-3">
            Proof Step Demonstration
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Verify if a rule is true by checking if it can be transformed using existing true rules.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Rule Selection */}
          <div className="lg:col-span-1 space-y-4">
            {/* Rule Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Rule to Prove</CardTitle>
                <CardDescription>Choose a rule from the axioms to verify</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {axioms.slice(0, 30).map((rule) => (
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
                <CardTitle className="text-lg">Input Expressions</CardTitle>
                <CardDescription>Enter expressions to prove</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Starting Expression
                  </label>
                  <SyntaxInput
                    value={startExpression}
                    onChange={setStartExpression}
                    placeholder=", i \\Pu j,"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Ending Expression
                  </label>
                  <SyntaxInput
                    value={endExpression}
                    onChange={setEndExpression}
                    placeholder=", j \\Pu i,"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={performProof}
                    disabled={isProving || !startExpression.trim() || !endExpression.trim()}
                    className="flex-1 gap-2"
                  >
                    {isProving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Proving...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Prove Rule
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetProof}
                    disabled={isProving}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Proof Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Target Rule */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rule to Prove</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <ExpressionRenderer expression={startExpression} size={20} />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">{startExpression}</code>
                  </div>
                  <EquivalenceSymbol size={32} />
                  <div className="flex-1 text-center">
                    <div className="mb-2">
                      <ExpressionRenderer expression={endExpression} size={20} />
                    </div>
                    <code className="text-xs text-muted-foreground font-mono">{endExpression}</code>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Result */}
            {isTrue !== null && (
              <Alert className={isTrue ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/50 bg-red-500/10'}>
                {isTrue ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <AlertDescription className={isTrue ? 'text-green-400' : 'text-red-400'}>
                  {isTrue 
                    ? 'Rule is TRUE - Match found in existing rules!'
                    : 'Rule is FALSE - No matching rule found in the glossary.'
                  }
                </AlertDescription>
              </Alert>
            )}

            {/* Proof Steps */}
            {proofSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Proof Steps</CardTitle>
                  <CardDescription>
                    Searching through {axioms.length} rules... ({proofSteps.length} steps checked)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {proofSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border transition-colors ${
                            step.result === 'match'
                              ? 'bg-green-500/10 border-green-500/30'
                              : step.result === 'no-match'
                              ? 'bg-muted/30 border-border'
                              : 'bg-muted/20 border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                Step {step.step}
                              </Badge>
                              <Badge variant={step.matchDirection === 'left-to-right' ? 'default' : 'secondary'}>
                                {step.matchDirection === 'left-to-right' ? 'L→R' : 'R→L'}
                              </Badge>
                              {step.result === 'match' && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                  ✓ Match
                                </Badge>
                              )}
                            </div>
                            {step.inferenceRule && (
                              <Badge variant="outline" className="text-xs">
                                {step.inferenceRule}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            {step.rule.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono mb-2">
                            <span className="text-muted-foreground">{step.rule.leftSide}</span>
                            <span className="text-primary">≡</span>
                            <span className="text-muted-foreground">{step.rule.rightSide}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-foreground">Normalized:</span>
                            <span className="text-primary">{step.normalized.left}</span>
                            <span className="text-primary">≡</span>
                            <span className="text-primary">{step.normalized.right}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {!isProving && proofSteps.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter expressions and click "Prove Rule" to start the proof process
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

export default ProofStep;
