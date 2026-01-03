import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import { theorems } from '@/data/theorems';
import { Play, RotateCcw, CheckCircle2, XCircle, Loader2, AlertCircle, X, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MatchPosition {
  side: 'left' | 'right' | 'both';
  position?: number; // Character position or pattern position
  description: string;
  prefix?: string; // Text before the substituted rule (M in M·A·N)
  suffix?: string; // Text after the substituted rule (N in M·A·N)
}

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
  matchPosition?: MatchPosition;
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

const ProofStep: React.FC = () => {
  const [startExpression, setStartExpression] = useState(', i \\Pu,');
  const [endExpression, setEndExpression] = useState(', j \\Pu,');
  const [isProving, setIsProving] = useState(false);
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [isTrue, setIsTrue] = useState<boolean | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const cancelRef = useRef(false);
  
  // Combine axioms and theorems - prioritize axioms (more likely to match)
  const allRules = useMemo(() => [...axioms, ...theorems], []);
  
  // Pre-normalize and cache all rules (both directions) to avoid recomputation
  // This is a one-time cost that dramatically speeds up subsequent searches
  const normalizedRulesCache = useMemo(() => {
    const cache = new Map<string, {
      l2r: { left: string; right: string };
      r2l: { left: string; right: string };
    }>();
    
    // Process in batches to avoid blocking the UI
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
  
  const totalStepsRef = useRef(0); // Total steps = allRules.length * 2 (L2R and R2L for each)
  const matchedStepRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // Handle rule selection
  const handleSelectRule = (ruleId: string) => {
    const rule = allRules.find(r => r.id === ruleId);
    if (rule) {
      setStartExpression(rule.leftSide);
      setEndExpression(rule.rightSide);
      setSelectedRuleId(ruleId);
    }
  };

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

  // Check a single rule in both directions (returns both results)
  const checkRule = (
    rule: Rule,
    cached: { l2r: { left: string; right: string }; r2l: { left: string; right: string } },
    targetIntegerLeft: string,
    targetIntegerRight: string,
    stepNumber: number
  ): { steps: ProofStep[]; match: boolean; matchStep?: ProofStep } => {
    const steps: ProofStep[] = [];

    // Try left-to-right normalization (use cache)
    const checkResultL2R = checkInferenceRules(
      targetIntegerLeft,
      targetIntegerRight,
      cached.l2r.left,
      cached.l2r.right
    );

    const stepL2R: ProofStep = {
      step: stepNumber,
      rule: rule,
      normalized: {
        left: cached.l2r.left,
        right: cached.l2r.right,
        integerLeft: cached.l2r.left,
        integerRight: cached.l2r.right,
      },
      matchDirection: 'left-to-right',
      result: checkResultL2R.match ? 'match' : 'no-match',
      inferenceRule: checkResultL2R.inferenceRule,
      matchPosition: checkResultL2R.matchPosition,
    };

    steps.push(stepL2R);

    if (checkResultL2R.match) {
      return { steps, match: true, matchStep: stepL2R };
    }

    // Try right-to-left normalization (use cache)
    const checkResultR2L = checkInferenceRules(
      targetIntegerLeft,
      targetIntegerRight,
      cached.r2l.left,
      cached.r2l.right
    );

    const stepR2L: ProofStep = {
      step: stepNumber + 1,
      rule: rule,
      normalized: {
        left: cached.r2l.left,
        right: cached.r2l.right,
        integerLeft: cached.r2l.left,
        integerRight: cached.r2l.right,
      },
      matchDirection: 'right-to-left',
      result: checkResultR2L.match ? 'match' : 'no-match',
      inferenceRule: checkResultR2L.inferenceRule,
      matchPosition: checkResultR2L.matchPosition,
    };

    steps.push(stepR2L);

    if (checkResultR2L.match) {
      return { steps, match: true, matchStep: stepR2L };
    }

    return { steps, match: false };
  };

  // Perform proof step with parallel processing
  const performProof = async () => {
    setIsProving(true);
    setProofSteps([]);
    setIsTrue(null);
    setCurrentStepIndex(0);
    setElapsedTime(null);
    cancelRef.current = false;
    totalStepsRef.current = allRules.length * 2; // Each rule checked in both directions

    // Start timing
    const startTime = performance.now();

    // Normalize the target rule (rule to prove) - only once
    const targetNormalized = normalizeRule(startExpression, endExpression);
    const targetIntegerLeft = targetNormalized.left.integerExpression;
    const targetIntegerRight = targetNormalized.right.integerExpression;

    const steps: ProofStep[] = [];
    const PARALLEL_BATCH_SIZE = 10; // Number of rules to check in parallel
    const UI_UPDATE_INTERVAL = 50; // Update UI every 50ms
    const YIELD_INTERVAL = 5; // Yield control every 5 batches to keep UI responsive

    // Quick pre-check: if target is empty, skip immediately
    if (!targetIntegerLeft || !targetIntegerRight) {
      const endTime = performance.now();
      setElapsedTime(endTime - startTime);
      setIsTrue(false);
      setProofSteps([]);
      setIsProving(false);
      return;
    }

    // Process rules in parallel batches
    let stepNumber = 1;
    let foundMatch = false;

    for (let i = 0; i < allRules.length; i += PARALLEL_BATCH_SIZE) {
      // Check if cancelled
      if (cancelRef.current) {
        const endTime = performance.now();
        setElapsedTime(endTime - startTime);
        setIsProving(false);
        setProofSteps(steps);
        return;
      }

      // Get batch of rules to process
      const batch = allRules.slice(i, i + PARALLEL_BATCH_SIZE);
      
      // Process batch in parallel - each rule produces 2 steps (L2R and R2L)
      const batchResults = await Promise.all(
        batch.map((rule, batchIndex) => {
          const cached = normalizedRulesCache.get(rule.id);
          if (!cached) {
            return { steps: [], match: false, matchStep: undefined, ruleIndex: i + batchIndex };
          }
          
          // Calculate step numbers: first step of this rule within the batch
          // We'll adjust these after parallel processing to ensure sequential numbering
          const ruleFirstStep = stepNumber + (batchIndex * 2);
          
          const result = checkRule(rule, cached, targetIntegerLeft, targetIntegerRight, ruleFirstStep);
          return { ...result, ruleIndex: i + batchIndex };
        })
      );

      // Sort results by rule index to maintain order, then re-number steps sequentially
      batchResults.sort((a, b) => a.ruleIndex - b.ruleIndex);

      // Collect all steps and check for matches
      // Track the starting step number for this batch
      let batchStartStep = stepNumber;
      
      for (const result of batchResults) {
        // Re-number steps sequentially to ensure correct ordering
        const adjustedSteps = result.steps.map((step, idx) => ({
          ...step,
          step: batchStartStep + idx
        }));
        
        // Update batchStartStep for next rule in batch
        batchStartStep += adjustedSteps.length;
        
        steps.push(...adjustedSteps);
        
        if (result.match && result.matchStep) {
          foundMatch = true;
          // Find the corresponding adjusted step
          const matchedIndex = result.steps.findIndex(s => s === result.matchStep);
          const matchedStep = adjustedSteps[matchedIndex];
          
          // Calculate elapsed time
          const endTime = performance.now();
          setElapsedTime(endTime - startTime);
          
          setIsTrue(true);
          setProofSteps(steps);
          setIsProving(false);
          // Scroll to matched step within ScrollArea after state update
          setTimeout(() => {
            scrollToMatchedStep();
          }, 150);
          return;
        }
      }
      
      // Update stepNumber for next batch
      stepNumber = batchStartStep;

      // Update UI progressively (after each batch)
      setProofSteps([...steps]);
      setCurrentStepIndex(steps.length);

      // Yield control periodically to keep UI responsive
      // Yield every YIELD_INTERVAL batches, or if we're near the end
      const batchNumber = Math.floor(i / PARALLEL_BATCH_SIZE);
      const shouldYield = batchNumber % YIELD_INTERVAL === 0 || i + PARALLEL_BATCH_SIZE >= allRules.length;
      
      if (shouldYield && !foundMatch) {
        await new Promise(resolve => setTimeout(resolve, UI_UPDATE_INTERVAL));
      }

      // Check if cancelled before next batch
      if (cancelRef.current) {
        const endTime = performance.now();
        setElapsedTime(endTime - startTime);
        setIsProving(false);
        setProofSteps(steps);
        return;
      }
    }

    // No match found (if not cancelled)
    const endTime = performance.now();
    setElapsedTime(endTime - startTime);
    
    if (!cancelRef.current && !foundMatch) {
      setIsTrue(false);
      setProofSteps(steps);
    }
    setIsProving(false);
  };

  // Cancel proof checking
  const cancelProof = () => {
    cancelRef.current = true;
    setIsProving(false);
  };

  const resetProof = () => {
    cancelRef.current = true;
    setIsProving(false);
    setProofSteps([]);
    setIsTrue(null);
    setCurrentStepIndex(0);
    setElapsedTime(null);
    totalStepsRef.current = 0;
    matchedStepRef.current = null;
  };

  // Function to scroll to matched step within the ScrollArea
  const scrollToMatchedStep = () => {
    if (!matchedStepRef.current || !scrollAreaRef.current) return;
    
    // Find the scrollable viewport within ScrollArea
    // Try multiple selectors to find the viewport element
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement ||
                     scrollAreaRef.current.querySelector('.overflow-auto, .overflow-y-auto, [style*="overflow"]') as HTMLElement ||
                     (scrollAreaRef.current.firstElementChild as HTMLElement);
    
    if (!viewport || !matchedStepRef.current || !viewport.scrollTo) return;
    
    const matchedElement = matchedStepRef.current;
    
    // Get the position of the element relative to the viewport's scroll container
    const viewportScrollTop = viewport.scrollTop;
    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = matchedElement.getBoundingClientRect();
    
    // Calculate the element's position relative to the viewport's scroll container
    const elementTopInViewport = elementRect.top - viewportRect.top + viewportScrollTop;
    
    // Calculate target scroll position to center the element
    const elementHeight = elementRect.height;
    const viewportHeight = viewportRect.height;
    const targetScrollTop = elementTopInViewport - (viewportHeight / 2) + (elementHeight / 2);
    
    // Scroll the viewport
    viewport.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
  };

  // Scroll to matched step when a match is found
  useEffect(() => {
    if (isTrue === true && matchedStepRef.current) {
      // Use a small timeout to ensure DOM has updated
      const timer = setTimeout(() => {
        scrollToMatchedStep();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isTrue, proofSteps]);

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
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Verify if a rule is true by checking if it can be transformed using existing true rules.
          </p>
          
          {/* Explanation Card */}
          <Card className="max-w-4xl mx-auto mt-6 mb-4">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                A rule is true if it satisfies one or a combination of inference rules together with rules that are 
                already known to be true. A proof-step is one satisfiable step of applying an inference rule together 
                with a true rule. A rule in question is true if the beginning expression (left side) can be transformed 
                into the ending expression (right side) after a series of inference steps.
              </p>
              
              {/* Inference Rules Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-primary mb-3">Inference Rules</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold text-foreground block text-center">Equivalent Commutativity</span>
                    <p className="text-muted-foreground mt-1">A ⟺ B implies B ⟺ A - Exact match (reversed)</p>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block text-center">Equivalent Transitivity</span>
                    <p className="text-muted-foreground mt-1">A ⟺ B and B ⟺ C implies A ⟺ C - Chain through common side</p>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block text-center">Equivalent Substitution</span>
                    <p className="text-muted-foreground mt-1">A ⟺ B allows replacing A with B in any context M·A·N → M·B·N</p>
                    <p className="text-primary/80 text-xs italic mt-2 font-medium text-center">Note: Equivalent Substitution carries the bulk of most proofs.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Link to="/glossary">
            <Button variant="outline" className="gap-2">
              <BookOpen className="w-4 h-4" />
              View Glossary
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Input & Rule Selection */}
          <div className="lg:col-span-1 space-y-4">
            {/* Rule Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select A True Rule To Edit and Verify</CardTitle>
                <CardDescription>Choose a rule from the axioms and theorems to verify</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {allRules.slice(0, 30).map((rule) => (
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
                    placeholder=", i \\Pu,"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    Ending Expression
                  </label>
                  <SyntaxInput
                    value={endExpression}
                    onChange={setEndExpression}
                    placeholder=", j \\Pu,"
                  />
                </div>
                <div className="flex gap-2">
                  {!isProving ? (
                    <>
                      <Button
                        onClick={performProof}
                        disabled={!startExpression.trim() || !endExpression.trim()}
                        className="flex-1 gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Prove Rule
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetProof}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={cancelProof}
                        variant="destructive"
                        className="flex-1 gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                    </>
                  )}
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
              <CardContent className="space-y-4">
                {/* Original Expression */}
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
                {/* Normalized Expression */}
                {(() => {
                  try {
                    const normalized = normalizeRule(startExpression, endExpression);
                    return (
                      <div className="flex items-center justify-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex-1 text-center">
                          <div className="mb-2">
                            <ExpressionRenderer expression={normalized.left.originalExpression} size={20} />
                          </div>
                          <code className="text-xs text-primary font-mono">
                            {normalized.left.integerExpression}
                          </code>
                        </div>
                        <EquivalenceSymbol size={32} />
                        <div className="flex-1 text-center">
                          <div className="mb-2">
                            <ExpressionRenderer expression={normalized.right.originalExpression} size={20} />
                          </div>
                          <code className="text-xs text-primary font-mono">
                            {normalized.right.integerExpression}
                          </code>
                        </div>
                      </div>
                    );
                  } catch (error) {
                    return null;
                  }
                })()}
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
                  <span>
                    {isTrue 
                      ? 'Rule is TRUE - Match found in existing rules!'
                      : 'Rule is FALSE - No matching rule found in the glossary.'
                    }
                    {elapsedTime !== null && (
                      <span className="ml-2 font-semibold">
                        ({elapsedTime < 1000 
                          ? `${elapsedTime.toFixed(2)} ms`
                          : `${(elapsedTime / 1000).toFixed(3)}s`
                        })
                      </span>
                    )}
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Proof Steps */}
            {proofSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Proof Steps</CardTitle>
                  <CardDescription>
                    {isProving ? (
                      <>Searching through {allRules.length} rules... ({proofSteps.length} of {totalStepsRef.current} steps checked)</>
                    ) : (
                      <>Searched through {allRules.length} rules ({proofSteps.length} of {totalStepsRef.current} steps checked)</>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]" ref={scrollAreaRef}>
                    <div className="space-y-3">
                      {proofSteps.map((step, idx) => (
                        <div
                          key={idx}
                          ref={step.result === 'match' ? matchedStepRef : null}
                          className={`p-3 rounded-lg border transition-colors ${
                            step.result === 'match'
                              ? 'bg-green-500/10 border-green-500/30'
                              : step.result === 'no-match'
                              ? 'bg-muted/30 border-border'
                              : 'bg-muted/20 border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
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
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                  {step.inferenceRule}
                                </Badge>
                                {step.matchPosition && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    {step.matchPosition.description}
                                  </Badge>
                                )}
                              </div>
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
                          {/* Show substitution context if Equivalent Substitution is used */}
                          {step.inferenceRule === 'Equivalent Substitution' && step.matchPosition && 
                           (step.matchPosition.prefix || step.matchPosition.suffix) && (
                            <div className="mt-2 p-2 bg-primary/5 rounded border border-primary/20">
                              <div className="text-xs text-muted-foreground mb-1 font-semibold">Substitution Context (M·A·N):</div>
                              <div className="flex items-center gap-2 text-xs font-mono">
                                {step.matchPosition.prefix && (
                                  <>
                                    <span className="text-muted-foreground">M =</span>
                                    <code className="text-foreground bg-muted/30 px-1.5 py-0.5 rounded">{step.matchPosition.prefix}</code>
                                  </>
                                )}
                                {step.matchPosition.prefix && step.matchPosition.suffix && (
                                  <span className="text-primary">·</span>
                                )}
                                {step.matchPosition.suffix && (
                                  <>
                                    <span className="text-muted-foreground">N =</span>
                                    <code className="text-foreground bg-muted/30 px-1.5 py-0.5 rounded">{step.matchPosition.suffix}</code>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
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
                    Enter expressions and click "Prove Rule" to find satisfiable inference rules.
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
