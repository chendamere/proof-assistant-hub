import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { Rule, getTypeBadgeClass, axioms } from '@/data/axioms';
import { theorems } from '@/data/theorems';
import { normalizeRule } from '@/lib/operandNormalizer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { Play, Plus, RotateCcw, ChevronRight, AlertCircle, PartyPopper } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import confetti from 'canvas-confetti';

interface ProofStep {
  id: string;
  expression: string;
  appliedRule: string;
}

interface ApplicableRule {
  rule: Rule;
  direction: 'left-to-right' | 'right-to-left';
  inferenceRule?: string;
}

interface MatchPosition {
  side: 'left' | 'right' | 'both';
  position?: number;
  description: string;
  prefix?: string;
  suffix?: string;
}

interface InferenceRule {
  name: string;
  description: string;
  check: (
    targetLeft: string,
    targetRight: string,
    ruleLeft: string,
    ruleRight: string
  ) => { match: boolean; position?: MatchPosition };
}

const InferenceRules: InferenceRule[] = [
  {
    name: 'Equivalent Commutativity',
    description: 'A ⟺ B implies B ⟺ A - Exact match (reversed)',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if target matches rule in reverse
      if (targetLeft === ruleRight && targetRight === ruleLeft) {
        return {
          match: true,
          position: {
            side: 'both',
            description: 'Both sides match in reverse order'
          }
        };
      }
      return { match: false };
    },
  },
  {
    name: 'Equivalent Transitivity',
    description: 'A ⟺ B and B ⟺ C implies A ⟺ C - Chain through common side',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // If target left matches rule left, check if target right matches rule right exactly
      if (targetLeft === ruleLeft) {
        if (targetRight === ruleRight) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Left sides match, right sides match exactly'
            }
          };
        }
      }
      // If target left matches rule right, check if target right matches rule left exactly
      if (targetLeft === ruleRight) {
        if (targetRight === ruleLeft) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Target left matches rule right, target right matches rule left exactly'
            }
          };
        }
      }
      // If target right matches rule left, check if target left matches rule right exactly
      if (targetRight === ruleLeft) {
        if (targetLeft === ruleRight) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Target right matches rule left, target left matches rule right exactly'
            }
          };
        }
      }
      // If target right matches rule right, check if target left matches rule left exactly
      if (targetRight === ruleRight) {
        if (targetLeft === ruleLeft) {
          return {
            match: true,
            position: {
              side: 'both',
              description: 'Right sides match, left sides match exactly'
            }
          };
        }
      }
      return { match: false };
    },
  },
  {
    name: 'Equivalent Substitution',
    description: 'A ⟺ B allows replacing A with B in any context M·A·N → M·B·N',
    check: (targetLeft, targetRight, ruleLeft, ruleRight) => {
      // Check if rule can be substituted into target
      const findSubstitution = (target: string, ruleSide: string, side: 'left' | 'right') => {
        if (target.includes(ruleSide)) {
          const position = target.indexOf(ruleSide);
          const prefix = target.substring(0, position);
          const suffix = target.substring(position + ruleSide.length);
          return {
            match: true,
            position: {
              side: side,
              position: position,
              description: `Rule found at position ${position} in ${side} side`,
              prefix: prefix || undefined,
              suffix: suffix || undefined,
            }
          };
        }
        if (ruleSide.includes(target)) {
          const position = ruleSide.indexOf(target);
          const prefix = ruleSide.substring(0, position);
          const suffix = ruleSide.substring(position + target.length);
          return {
            match: true,
            position: {
              side: side,
              description: `${side} side is contained in rule`,
              prefix: prefix || undefined,
              suffix: suffix || undefined,
            }
          };
        }
        return { match: false };
      };

      // Check both sides for substitution
      // For substitution to work, we need to check if applying the rule to one side
      // results in the other side matching
      
      // Try: targetLeft contains ruleLeft, then check if replacing it with ruleRight gives targetRight
      let result = findSubstitution(targetLeft, ruleLeft, 'left');
      if (result.match && result.position) {
        // Check if applying substitution (replacing ruleLeft with ruleRight in targetLeft) matches targetRight
        const substituted = (result.position.prefix || '') + ruleRight + (result.position.suffix || '');
        if (substituted === targetRight) {
          return result;
        }
      }
      
      // Try: targetLeft contains ruleRight, then check if replacing it with ruleLeft gives targetRight
      result = findSubstitution(targetLeft, ruleRight, 'left');
      if (result.match && result.position) {
        const substituted = (result.position.prefix || '') + ruleLeft + (result.position.suffix || '');
        if (substituted === targetRight) {
          return result;
        }
      }
      
      // Try: targetRight contains ruleLeft, then check if replacing it with ruleRight gives targetLeft
      result = findSubstitution(targetRight, ruleLeft, 'right');
      if (result.match && result.position) {
        const substituted = (result.position.prefix || '') + ruleRight + (result.position.suffix || '');
        if (substituted === targetLeft) {
          return result;
        }
      }
      
      // Try: targetRight contains ruleRight, then check if replacing it with ruleLeft gives targetLeft
      result = findSubstitution(targetRight, ruleRight, 'right');
      if (result.match && result.position) {
        const substituted = (result.position.prefix || '') + ruleLeft + (result.position.suffix || '');
        if (substituted === targetLeft) {
          return result;
        }
      }

      return { match: false };
    },
  },
];

const ProofVerifierSection: React.FC = () => {
  // State for the rule to prove
  const [leftSideToProve, setLeftSideToProve] = useState('');
  const [rightSideToProve, setRightSideToProve] = useState('');
  const [isProving, setIsProving] = useState(false);
  
  // Proof steps
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [currentExpression, setCurrentExpression] = useState('');
  const [applicableRules, setApplicableRules] = useState<ApplicableRule[]>([]);
  const [isSearchingRules, setIsSearchingRules] = useState(false);
  const [isProofComplete, setIsProofComplete] = useState(false);
  const confettiTriggeredRef = useRef(false);
  
  // Drag state
  const [isDragOver, setIsDragOver] = useState(false);

  // Combine axioms and theorems
  const allRules = useMemo(() => [...axioms, ...theorems], []);

  // Pre-normalize and cache all rules (both directions)
  const normalizedRulesCache = useMemo(() => {
    const cache = new Map<string, {
      l2r: { left: string; right: string };
      r2l: { left: string; right: string };
    }>();
    
    allRules.forEach(rule => {
      try {
        const l2r = normalizeRule(rule.leftSide, rule.rightSide);
        const r2l = normalizeRule(rule.rightSide, rule.leftSide);
        cache.set(rule.id, {
          l2r: {
            left: l2r.left.integerExpression,
            right: l2r.right.integerExpression
          },
          r2l: {
            left: r2l.left.integerExpression,
            right: r2l.right.integerExpression
          }
        });
      } catch (error) {
        console.warn(`Failed to normalize rule ${rule.id}:`, error);
      }
    });
    
    return cache;
  }, [allRules]);

  // Check if a normalized rule matches the target using inference rules
  // Optimized with early termination checks
  const checkInferenceRules = (
    targetIntegerLeft: string,
    targetIntegerRight: string,
    ruleIntegerLeft: string,
    ruleIntegerRight: string
  ): { match: boolean; inferenceRule?: string; matchPosition?: MatchPosition } => {
    // Quick rejection: if both sides are completely different, skip inference checks
    // (But still allow inference rules to handle transformations)
    
    // Try exact match first (fastest check)
    if (targetIntegerLeft === ruleIntegerLeft && targetIntegerRight === ruleIntegerRight) {
      return {
        match: true,
        inferenceRule: 'Exact Match',
        matchPosition: {
          side: 'both',
          description: 'Both sides match exactly'
        }
      };
    }

    // Try each inference rule (ordered by likelihood/fastest checks first)
    for (const infRule of InferenceRules) {
      const result = infRule.check(targetIntegerLeft, targetIntegerRight, ruleIntegerLeft, ruleIntegerRight);
      if (result.match) {
        return {
          match: true,
          inferenceRule: infRule.name,
          matchPosition: result.position
        };
      }
    }

    return { match: false };
  };

  // Search for applicable rules when currentExpression changes
  useEffect(() => {
    if (!isProving || !currentExpression.trim() || proofSteps.length === 0) {
      setApplicableRules([]);
      return;
    }

    const previousExpression = proofSteps[proofSteps.length - 1].expression;
    
    setIsSearchingRules(true);
    
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      try {
        const targetNormalized = normalizeRule(previousExpression, currentExpression);
        const targetLeft = targetNormalized.left.integerExpression;
        const targetRight = targetNormalized.right.integerExpression;

        const foundMatches: ApplicableRule[] = [];

        for (const rule of allRules) {
          const cached = normalizedRulesCache.get(rule.id);
          if (!cached) continue;

          // Check left-to-right direction
          const l2rResult = checkInferenceRules(
            targetLeft,
            targetRight,
            cached.l2r.left,
            cached.l2r.right
          );

          if (l2rResult.match) {
            foundMatches.push({
              rule,
              direction: 'left-to-right',
              inferenceRule: l2rResult.inferenceRule,
            });
          }

          // Check right-to-left direction
          const r2lResult = checkInferenceRules(
            targetLeft,
            targetRight,
            cached.r2l.left,
            cached.r2l.right
          );

          if (r2lResult.match) {
            foundMatches.push({
              rule,
              direction: 'right-to-left',
              inferenceRule: r2lResult.inferenceRule,
            });
          }
        }

        setApplicableRules(foundMatches);
      } catch (error) {
        console.error('Error searching for applicable rules:', error);
        setApplicableRules([]);
      } finally {
        setIsSearchingRules(false);
      }
    }, 100);
  }, [currentExpression, isProving, proofSteps, allRules, normalizedRulesCache]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.leftSide && data.rightSide) {
          setLeftSideToProve(data.leftSide);
          setRightSideToProve(data.rightSide);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, []);

  const startProving = () => {
    if (!leftSideToProve.trim() || !rightSideToProve.trim()) return;
    
    setIsProving(true);
    setIsProofComplete(false);
    confettiTriggeredRef.current = false;
    setProofSteps([{
      id: 'step-0',
      expression: leftSideToProve,
      appliedRule: 'Starting expression (left side)',
    }]);
    setCurrentExpression('');
    setApplicableRules([]);
  };

  const addProofStep = () => {
    if (!currentExpression.trim()) return;
    
    // Use the first applicable rule as the applied rule, or show a generic message
    const appliedRule = applicableRules.length > 0
      ? `${applicableRules[0].rule.name} (${applicableRules[0].direction === 'left-to-right' ? 'L→R' : 'R→L'}${applicableRules[0].inferenceRule ? `, ${applicableRules[0].inferenceRule}` : ''})`
      : 'No rule specified';
    
    const newStep: ProofStep = {
      id: `step-${proofSteps.length}`,
      expression: currentExpression,
      appliedRule,
    };
    
    setProofSteps([...proofSteps, newStep]);
    setCurrentExpression('');
    setApplicableRules([]);
  };

  const handleReset = () => {
    setLeftSideToProve('');
    setRightSideToProve('');
    setIsProving(false);
    setIsProofComplete(false);
    confettiTriggeredRef.current = false;
    setProofSteps([]);
    setCurrentExpression('');
    setApplicableRules([]);
  };

  // Trigger confetti animation
  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Check if proof is complete and trigger confetti
  useEffect(() => {
    if (isProving && proofSteps.length > 0) {
      const lastStep = proofSteps[proofSteps.length - 1];
      const isComplete = lastStep.expression.trim() === rightSideToProve.trim();
      
      if (isComplete && !isProofComplete) {
        setIsProofComplete(true);
        if (!confettiTriggeredRef.current) {
          confettiTriggeredRef.current = true;
          // Small delay to ensure the completion message is visible
          setTimeout(() => {
            triggerConfetti();
          }, 100);
        }
      } else if (!isComplete && isProofComplete) {
        setIsProofComplete(false);
        confettiTriggeredRef.current = false;
      }
    }
  }, [proofSteps, rightSideToProve, isProving, isProofComplete, triggerConfetti]);


  return (
    <section className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-glow mb-1">
          Proof Verifier
        </h2>
        <p className="text-sm text-muted-foreground">
          {isProving 
            ? 'Build your proof step by step' 
            : 'Enter a rule to prove, then begin the proving process'
          }
        </p>
      </div>

      {!isProving ? (
        /* Rule Input Phase */
        <div 
          className={`bg-card border rounded-lg p-6 flex-1 flex flex-col transition-all duration-200 ${
            isDragOver ? 'border-primary border-2 border-dashed bg-primary/5' : 'border-border'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="text-center text-sm text-muted-foreground mb-4">
            Drag a rule from the <span className="text-primary font-medium">Rules Panel</span> or enter manually
          </p>
          
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-start flex-1">
            {/* Left Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground block font-mono">
                Left Side (to prove)
              </label>
              <SyntaxInput
                placeholder=", i \Pu,"
                value={leftSideToProve}
                onChange={setLeftSideToProve}
              />
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={leftSideToProve} size={20} />
              </div>
            </div>

            {/* Equivalence Symbol */}
            <div className="flex justify-center pt-8">
              <EquivalenceSymbol size={40} />
            </div>

            {/* Right Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground block font-mono">
                Right Side (goal)
              </label>
              <SyntaxInput
                placeholder=", j \Pu,"
                value={rightSideToProve}
                onChange={setRightSideToProve}
              />
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={rightSideToProve} size={20} />
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={startProving}
              disabled={!leftSideToProve.trim() || !rightSideToProve.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <Play className="w-4 h-4" />
              Start Proving
            </Button>
          </div>
        </div>
      ) : (
        /* Proving Phase */
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Goal Display */}
          <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Goal to prove</span>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 gap-1 text-xs">
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 bg-muted/50 rounded border border-border/50">
                <ExpressionRenderer expression={leftSideToProve} size={16} />
              </div>
              <EquivalenceSymbol size={24} />
              <div className="p-2 bg-primary/10 rounded border border-primary/30">
                <ExpressionRenderer expression={rightSideToProve} size={16} />
              </div>
            </div>
          </div>

          {/* Proof Steps */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
                Proof Steps ({proofSteps.length})
              </span>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {proofSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-mono">
                      {index}
                    </div>
                    <div className="flex-1">
                      <div className="p-2 bg-muted/30 rounded border border-border/50 mb-1">
                        <ExpressionRenderer expression={step.expression} size={14} />
                      </div>
                      <span className="text-xs text-muted-foreground">{step.appliedRule}</span>
                    </div>
                  </div>
                ))}
                
                {/* Check if last step matches goal */}
                {isProofComplete && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-2 border-primary/50 rounded-lg text-center relative overflow-hidden">
                    <PartyPopper className="w-8 h-8 text-primary mx-auto mb-2 animate-bounce" />
                    <div className="text-primary font-bold text-lg mb-1">Proof Complete! 🎉</div>
                    <div className="text-xs text-muted-foreground">Congratulations on completing the proof!</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* New Step Input - Hide when proof is complete */}
          {!isProofComplete && (
          <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Add Next Step</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-mono">Next Expression</label>
                <SyntaxInput
                  placeholder="Enter the next expression..."
                  value={currentExpression}
                  onChange={setCurrentExpression}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedText = e.clipboardData.getData('text');
                    // Remove all line breaks and replace with space (or nothing)
                    const singleLineText = pastedText.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
                    setCurrentExpression(singleLineText);
                  }}
                />
                <div className="p-2 bg-muted/30 rounded border border-border/50 min-h-[40px] flex items-center">
                  <ExpressionRenderer expression={currentExpression} size={14} />
                </div>
              </div>

              {/* Applicable Rules */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground font-mono">
                    Applicable Rules
                  </label>
                  {isSearchingRules && (
                    <span className="text-xs text-muted-foreground">Searching...</span>
                  )}
                  {!isSearchingRules && applicableRules.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {applicableRules.length} rule{applicableRules.length > 1 ? 's' : ''} found
                    </span>
                  )}
                </div>
                
                {currentExpression.trim() && !isSearchingRules && applicableRules.length === 0 && (
                  <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-400 text-xs">
                      No applicable rules found to transform the previous expression to this one.
                    </AlertDescription>
                  </Alert>
                )}

                {!currentExpression.trim() && (
                  <div className="p-3 bg-muted/30 rounded border border-border/50 text-xs text-muted-foreground text-center">
                    Enter an expression to see applicable rules
                  </div>
                )}

                {applicableRules.length > 0 && (
                  <ScrollArea className="h-[200px] border border-border/50 rounded-lg">
                    <div className="p-2 space-y-2">
                      {applicableRules.map((appRule, idx) => (
                        <div
                          key={`${appRule.rule.id}-${idx}`}
                          className="p-2 bg-muted/30 rounded border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              {appRule.rule.type.charAt(0).toUpperCase()}
                            </Badge>
                            <span className="text-xs font-medium">{appRule.rule.name}</span>
                            <Badge 
                              variant={appRule.direction === 'left-to-right' ? 'default' : 'secondary'}
                              className="text-[10px] ml-auto"
                            >
                              {appRule.direction === 'left-to-right' ? 'L→R' : 'R→L'}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono mb-1 flex items-center gap-1">
                            {appRule.rule.leftSide} <EquivalenceSymbol size={10} /> {appRule.rule.rightSide}
                          </div>
                          {appRule.inferenceRule && (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              {appRule.inferenceRule}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button
                onClick={addProofStep}
                disabled={!currentExpression.trim()}
                size="sm"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </Button>
            </div>
          </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ProofVerifierSection;
