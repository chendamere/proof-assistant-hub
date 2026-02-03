/**
 * Demo page for DAG-based substitution in rule inference.
 * Shows how expressions convert to DAGs and how rule applicability
 * after operand normalization is equivalent to DAG isomorphism.
 */

import { useState } from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { exprToDAG, vf2ExprSubgraphIsomorphism } from '@/lib/dag';
import { findSubstitution as findSubst } from '@/lib/inferenceRules/substitution';
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
    rule: ', 1 \\Oc 2, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ', 1 \\Oc 2, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
  },
  {
    name: 'Op after branch',
    rule: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, 1 \\Oc 2',
    target: ', \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, 1 \\Oc 2',
  },
  {
    name: 'Op + branch + op',
    rule: ', 1 \\Oc 2, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, 2 \\Od 3',
    target: ', 1 \\Oc 2, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, }, 2 \\Od 3',
  },
  {
    name: 'Copy-release pattern',
    rule: ', i \\Oc m, m \\Os,',
    target: ', 1 \\Oc 2, 2 \\Os,',
  },
  {
    name: 'Simple ops chain',
    rule: ', i \\Od j, j \\Oc k,',
    target: ', 1 \\Od 2, 2 \\Oc 3,',
  },
  {
    name: 'i Op with branch (rule)',
    rule: ', i \\Op, \\Bb{i \\Oe j}{,i \\Op, }{, i \\Op, },',
    target: ', 1 \\Op, \\Bb{1 \\Oe 2}{,1 \\Op, }{, 1 \\Op, },',
  },
];

const DEMO_TARGET = DAG_EXAMPLES[0].target;
const DEMO_RULE = DAG_EXAMPLES[0].rule;

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
      </div>
      <Footer />
    </div>
  );
}
