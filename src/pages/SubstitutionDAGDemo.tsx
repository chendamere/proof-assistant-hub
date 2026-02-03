/**
 * Demo page for DAG-based substitution in rule inference.
 * Shows how expressions convert to DAGs and how rule applicability
 * after operand normalization is equivalent to DAG isomorphism.
 */

import { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { exprToDAG, vf2ExprSubgraphIsomorphism } from '@/lib/dag';
import { findSubstitution as findSubst, trySubstitution } from '@/lib/inferenceRules/substitution';
import { normalizeSpacing } from '@/lib/inferenceRules/utils';
import { DAGGraphVisual } from '@/components/dag/DAGGraphVisual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DAGExample {
  name: string;
  rule: string;
  target: string;
}

const DAG_EXAMPLES: DAGExample[] = [
  {
    name: 'Branch only',
    rule: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
  },
  {
    name: 'Op before branch',
    rule: ', a \\Oc b, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ', a \\Oc b, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
  },
  {
    name: 'Op after branch',
    rule: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, a \\Oc b',
    target: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, a \\Oc b',
  },
  {
    name: 'Op + branch + op',
    rule: ', a \\Oc b, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, a \\Od b',
    target: ', a \\Oc b, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, a \\Od b',
  },
  {
    name: 'Copy-release pattern',
    rule: ', i \\Oc m, m \\Os,',
    target: ', a \\Oc b, b \\Os,',
  },
  {
    name: 'Simple ops chain',
    rule: ', i \\Od j, j \\Oc k,',
    target: ', a \\Od b, b \\Oc c,',
  },
  {
    name: 'i Op with branch (rule)',
    rule: ', i \\Op, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ', a \\Op, \\Bb{i \\Oe j}{,a \\Op, }{, a \\Op, },',
  },
  {
    name: 'branch in branch',
    rule: ',\\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ',\\Bb{i \\Oe j}{\\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },}{, i \\Op, },',
  },
  {
    name: 'branch front',
    rule: ',\\Blb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ',\\Bb{i \\Oe j}{,i \\Op,}{, i \\Op, },',
  },
  {
    name: 'branch back',
    rule: ',\\Brb{,i \\Op, }{, i \\Op, },',
    target: ',\\Bb{i \\Oe j}{,i \\Op,}{, i \\Op, },',
  },
];

interface TrySubExample {
  name: string;
  targetLeft: string;
  targetRight: string;
  ruleLeft: string;
  ruleRight: string;
  description: string;
}

const TRY_SUB_EXAMPLES: TrySubExample[] = [
  {
    name: 'Copy-release (non-branch)',
    targetLeft: ', a \\Oc b, b \\Os,',
    targetRight: ', a \\Oc b, b\\Os,',
    ruleLeft: ', i \\Oc m, m \\Os,',
    ruleRight: ', i \\Oc m, m \\Os,',
    description: 'Rule matches target exactly; substitution yields same result.',
  },
  {
    name: 'Branch identity',
    targetLeft: ', \\Bb{a \\Oe c}{,a \\Op,}{, a \\Op, },',
    targetRight: ', \\Bb{a \\Oe c}{,a \\Op,}{, a \\Op, },',
    ruleLeft: ', \\Bb{i \\Oe j}{,i \\Op,}{, i \\Op, },',
    ruleRight: ', \\Bb{i \\Oe j}{,i \\Op,}{, i \\Op, },',
    description: 'Branch structure matches; rule left = rule right.',
  },
  {
    name: 'Branch arm swap',
    targetLeft: ', \\Bb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},',
    targetRight: ', \\Bb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},',
    ruleLeft: ', i \\Od j, j \\Oc k,',
    ruleRight: ', i \\Od j, k \\Oc j,',
    description: 'Substitute inside branch top arm: swap j\\Oc k with k\\Oc j.',
  },
  {
    name: 'Branch arm swap2',
    targetLeft: ', \\Bb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},',
    targetRight: ', \\Bb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},',
    ruleLeft: ', \\Blb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},',
    ruleRight: ', \\Blb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},',
    description: 'Substitute inside branch top arm: swap j\\Oc k with k\\Oc j.',
  },
  {
    name: 'Branch arm swap3',
    targetLeft: ', \\Bb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},',
    targetRight: ', \\Bb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},',
    ruleLeft: ', \\Brb{,c \\Od e, e \\Oc f,}{,},',
    ruleRight: ', \\Brb{,c \\Od e, f \\Oc e,}{,},',
    description: 'Substitute inside branch top arm: swap j\\Oc k with k\\Oc j.',
  },
];

const DEMO_TARGET = DAG_EXAMPLES[0].target;
const DEMO_RULE = DAG_EXAMPLES[0].rule;

function safeTrySubstitution(
  target: string,
  ruleSide: string,
  otherRuleSide: string,
  expectedResult: string,
  targetSideForOperands: string,
  side: 'left' | 'right'
) {
  try {
    return trySubstitution(target, ruleSide, otherRuleSide, expectedResult, targetSideForOperands, side);
  } catch {
    return null;
  }
}

function TrySubstitutionSection() {
  const [selected, setSelected] = useState(TRY_SUB_EXAMPLES[0].name);
  const ex = TRY_SUB_EXAMPLES.find((e) => e.name === selected) ?? TRY_SUB_EXAMPLES[0];

  const results = {
    leftRuleLeft: safeTrySubstitution(ex.targetLeft, ex.ruleLeft, ex.ruleRight, ex.targetRight, ex.targetLeft, 'left'),
    leftRuleRight: safeTrySubstitution(ex.targetLeft, ex.ruleRight, ex.ruleLeft, ex.targetRight, ex.targetLeft, 'left'),
    rightRuleLeft: safeTrySubstitution(ex.targetRight, ex.ruleLeft, ex.ruleRight, ex.targetLeft, ex.targetRight, 'right'),
    rightRuleRight: safeTrySubstitution(ex.targetRight, ex.ruleRight, ex.ruleLeft, ex.targetLeft, ex.targetRight, 'right'),
  };
  const matchResult = results.leftRuleLeft ?? results.leftRuleRight ?? results.rightRuleLeft ?? results.rightRuleRight;
  const matchDirection =
    results.leftRuleLeft
      ? 'targetLeft: ruleLeft→ruleRight'
      : results.leftRuleRight
        ? 'targetLeft: ruleRight→ruleLeft'
        : results.rightRuleLeft
          ? 'targetRight: ruleLeft→ruleRight'
          : results.rightRuleRight
            ? 'targetRight: ruleRight→ruleLeft'
            : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Try Substitution Demo</CardTitle>
        <CardDescription>
          Equivalent Substitution: A ⟺ B allows replacing A with B in any context. Try all four directions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="try-sub-select" className="shrink-0">Example:</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="try-sub-select" className="w-[280px]">
              <SelectValue placeholder="Choose an example..." />
            </SelectTrigger>
            <SelectContent>
              {TRY_SUB_EXAMPLES.map((e) => (
                <SelectItem key={e.name} value={e.name}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">{ex.description}</p>
        <div className="grid gap-4 md:grid-cols-2 text-sm font-mono">
          <div>
            <p className="font-semibold text-foreground mb-1">Target</p>
            <p className="text-muted-foreground">Left: <span className="text-foreground">{ex.targetLeft}</span></p>
            <p className="text-muted-foreground">Right: <span className="text-foreground">{ex.targetRight}</span></p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Rule A ⟺ B</p>
            <p className="text-muted-foreground">A: <span className="text-foreground">{ex.ruleLeft}</span></p>
            <p className="text-muted-foreground">B: <span className="text-foreground">{ex.ruleRight}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Badge variant={matchResult ? 'default' : 'secondary'}>
            {matchResult ? 'Match found' : 'No match'}
          </Badge>
          {matchDirection && (
            <span className="text-sm text-muted-foreground">
              Via: {matchDirection}
            </span>
          )}
          {matchResult?.position?.operandMapping && (
            <span className="text-sm">
              Operand mapping: {[...matchResult.position.operandMapping.entries()]
                .map(([k, v]) => `${k}→${v}`)
                .join(', ')}
            </span>
          )}
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono">
          <p className="font-semibold mb-2">Tried directions:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>targetLeft, replace ruleLeft→ruleRight: {results.leftRuleLeft ? '✓' : '—'}</li>
            <li>targetLeft, replace ruleRight→ruleLeft: {results.leftRuleRight ? '✓' : '—'}</li>
            <li>targetRight, replace ruleLeft→ruleRight: {results.rightRuleLeft ? '✓' : '—'}</li>
            <li>targetRight, replace ruleRight→ruleLeft: {results.rightRuleRight ? '✓' : '—'}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubstitutionDAGDemo() {
  const [targetExpr, setTargetExpr] = useState(DEMO_TARGET);
  const [ruleExpr, setRuleExpr] = useState(DEMO_RULE);
  const [selectedExample, setSelectedExample] = useState<string>(DAG_EXAMPLES[0].name);

  const normalizedTarget = normalizeSpacing(targetExpr);
  const patternDAG = exprToDAG(ruleExpr);
  const targetDAG = exprToDAG(normalizedTarget);

  // Try to find substitution match in target
  const subResult = findSubst(normalizedTarget, ruleExpr, 'left');
  const matchFound = subResult.match;

  // Check if rule DAG is isomorphic to (subgraph of) target DAG
  const vf2Result = vf2ExprSubgraphIsomorphism(patternDAG, targetDAG);

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      <div className="h-16" />
      <div className="container max-w-6xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">DAG-Based Substitution Demo</h1>
        <p className="text-muted-foreground mt-2">
          Rule applicability after operand normalization is equivalent to DAG isomorphism.
          Expressions are converted to DAGs with operations as nodes; Bb, Blb, Brb have two outgoing edges.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Label htmlFor="example-select" className="shrink-0">Load example:</Label>
          <Select
            value={selectedExample}
            onValueChange={(value) => {
              const ex = DAG_EXAMPLES.find((e) => e.name === value);
              if (ex) {
                setSelectedExample(ex.name);
                setRuleExpr(ex.rule);
                setTargetExpr(ex.target);
              }
            }}
          >
            <SelectTrigger id="example-select" className="w-[280px]">
              <SelectValue placeholder="Choose an example..." />
            </SelectTrigger>
            <SelectContent>
              {DAG_EXAMPLES.map((ex) => (
                <SelectItem key={ex.name} value={ex.name}>
                  {ex.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rule (Pattern)</CardTitle>
            <CardDescription>Expression from the inference rule (original operands i, m, j)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="rule">Rule expression</Label>
              <Input
                id="rule"
                value={ruleExpr}
                onChange={(e) => setRuleExpr(e.target.value)}
                className="font-mono mt-2"
              />
            </div>
            <div>
              <Label>Pattern DAG</Label>
              <div className="mt-2 text-xs text-muted-foreground font-mono overflow-auto max-h-32">
                {JSON.stringify(patternDAG, null, 2)}
              </div>
            </div>
            {patternDAG.nodes.length > 0 && (
              <DAGGraphVisual structure={patternDAG} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target</CardTitle>
            <CardDescription>Target expression (normalized, integer operands)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="target">Target expression</Label>
              <Input
                id="target"
                value={targetExpr}
                onChange={(e) => setTargetExpr(e.target.value)}
                className="font-mono mt-2"
              />
            </div>
            <div>
              <Label>Target DAG</Label>
              <div className="mt-2 text-xs text-muted-foreground font-mono overflow-auto max-h-32">
                {JSON.stringify(targetDAG, null, 2)}
              </div>
            </div>
            {targetDAG.nodes.length > 0 && (
              <DAGGraphVisual structure={targetDAG} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>VF2 Isomorphism Result</CardTitle>
          <CardDescription>
            Rule DAG vs Target DAG — isomorphic when rule structure matches target
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={vf2Result ? 'default' : 'secondary'}>
              {vf2Result ? 'Isomorphic' : 'Not isomorphic'}
            </Badge>
            {vf2Result && (
              <span className="text-sm">
                Operand mapping: {[...vf2Result.operandMapping.entries()].map(([k, v]) => `${k}→${v}`).join(', ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={matchFound ? 'default' : 'secondary'}>
              findSubstitution: {matchFound ? 'Match found' : 'No match'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ul>
            <li><strong>Expression → DAG:</strong> Each operation (\Oc, \Od, \Os, etc.) becomes a node. Operands are stored in node data.</li>
            <li><strong>Sequential edges:</strong> Operations in a comma-separated list form a chain (op₁→op₂→op₃).</li>
            <li><strong>Bb, Blb, Brb:</strong> Branch operators have two outgoing edges to the top and bottom arms.</li>
            <li><strong>VF2:</strong> Subgraph isomorphism with variable binding—rule operands (i, m, j) match target operands (1, 2, 3) consistently.</li>
          </ul>
        </CardContent>
      </Card>

      <TrySubstitutionSection />
      </div>
      <Footer />
    </div>
  );
}
