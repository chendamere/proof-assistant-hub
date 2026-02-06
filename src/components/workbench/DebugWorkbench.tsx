/**
 * Debug Workbench: inspect expressions as DAGs, check isomorphisms, and try all rules.
 * Fixed to bottom, expandable, same layout as UserWorkbench.
 */

import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Bug, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { exprToDAG, vf2ExprSubgraphIsomorphism } from '@/lib/dag';
import { checkInferenceRules } from '@/lib/inferenceRules';
import { axioms } from '@/data/axioms';
import { definitions } from '@/data/definitions';
import { theorems } from '@/data/theorems';
import type { DAGStructure, ExprNodeData } from '@/lib/dag';
import { normalizeSpacing } from '@/lib/inferenceRules/utils';
import { usePanelContext } from '@/contexts/PanelContext';

function safeExprToDAG(expr: string): DAGStructure<ExprNodeData> | null {
  try {
    return exprToDAG(normalizeSpacing(expr));
  } catch {
    return null;
  }
}

function formatDAG(dag: DAGStructure<ExprNodeData>): string {
  const nodeLines = dag.nodes.map((n) => {
    const d = n.data as ExprNodeData | undefined;
    const op = d?.op ?? '?';
    const operands = (d?.operands ?? []).join(', ');
    const range = d?.start != null && d?.end != null ? ` [${d.start}-${d.end}]` : '';
    return `  ${n.id}: op=${op} operands=[${operands}]${range}`;
  });
  const edgeLines = dag.edges.map((e) => `  ${e.from} -> ${e.to}`);
  return `nodes (${dag.nodes.length}):\n${nodeLines.join('\n')}\nedges (${dag.edges.length}):\n${edgeLines.join('\n')}`;
}

interface DebugWorkbenchProps {
  /** When true, render only the content (no fixed wrapper/header); used inside WorkbenchContainer */
  embedded?: boolean;
  /** Optional: pass expressions from parent (e.g. proof step context) */
  initialLeft?: string;
  initialRight?: string;
}

const DebugWorkbench: React.FC<DebugWorkbenchProps> = ({
  embedded = false,
  initialLeft = '',
  initialRight = '',
}) => {
  const ctx = usePanelContext();
  const [localLeft, setLocalLeft] = React.useState(initialLeft);
  const [localRight, setLocalRight] = React.useState(initialRight);

  const leftExpr = embedded ? ctx.debugWorkbenchLeft : localLeft;
  const rightExpr = embedded ? ctx.debugWorkbenchRight : localRight;
  const setLeftExpr = embedded ? ctx.setDebugWorkbenchLeft : setLocalLeft;
  const setRightExpr = embedded ? ctx.setDebugWorkbenchRight : setLocalRight;
  const { isWorkbenchExpanded, isRulesPanelOpen } = ctx;
  const [ruleLeft, setRuleLeft] = React.useState('');
  const [ruleRight, setRuleRight] = React.useState('');

  const leftDAG = useMemo(() => (leftExpr.trim() ? safeExprToDAG(leftExpr) : null), [leftExpr]);
  const rightDAG = useMemo(() => (rightExpr.trim() ? safeExprToDAG(rightExpr) : null), [rightExpr]);
  const ruleLeftDAG = useMemo(() => (ruleLeft.trim() ? safeExprToDAG(ruleLeft) : null), [ruleLeft]);
  const ruleRightDAG = useMemo(() => (ruleRight.trim() ? safeExprToDAG(ruleRight) : null), [ruleRight]);

  const hasRule = ruleLeft.trim() && ruleRight.trim();

  const isomorphismResults = useMemo(() => {
    const results: { label: string; match: boolean }[] = [];
    if (!hasRule || !ruleLeftDAG || !ruleRightDAG) return results;
    if (leftDAG) {
      results.push({
        label: 'ruleLeft subgraph of left',
        match: vf2ExprSubgraphIsomorphism(ruleLeftDAG, leftDAG) !== null,
      });
      results.push({
        label: 'ruleRight subgraph of left',
        match: vf2ExprSubgraphIsomorphism(ruleRightDAG, leftDAG) !== null,
      });
    }
    if (rightDAG) {
      results.push({
        label: 'ruleLeft subgraph of right',
        match: vf2ExprSubgraphIsomorphism(ruleLeftDAG, rightDAG) !== null,
      });
      results.push({
        label: 'ruleRight subgraph of right',
        match: vf2ExprSubgraphIsomorphism(ruleRightDAG, rightDAG) !== null,
      });
    }
    return results;
  }, [hasRule, ruleLeftDAG, ruleRightDAG, leftDAG, rightDAG]);

  const allRulesResults = useMemo(() => {
    if (!leftExpr.trim() || !rightExpr.trim() || hasRule) return [];
    const allRules = [...axioms, ...definitions, ...theorems];
    return allRules.map((r) => {
      const result = checkInferenceRules(leftExpr, rightExpr, r.leftSide, r.rightSide);
      return { rule: r, match: result.match, inferenceRule: result.inferenceRule };
    });
  }, [leftExpr, rightExpr, hasRule]);

  const content = (
        <div className="h-[calc(100%-3rem)] flex overflow-hidden">
          {/* Inputs */}
          <div className="w-80 flex-shrink-0 border-r border-border flex flex-col p-3 gap-3">
            <div>
              <Label className="text-xs">Left expression</Label>
              <Input
                value={leftExpr}
                onChange={(e) => setLeftExpr(e.target.value)}
                placeholder=", a \Od b,"
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Right expression</Label>
              <Input
                value={rightExpr}
                onChange={(e) => setRightExpr(e.target.value)}
                placeholder=", b \Od a,"
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rule (optional)</Label>
              <Input
                value={ruleLeft}
                onChange={(e) => setRuleLeft(e.target.value)}
                placeholder="Rule left"
                className="h-7 text-xs font-mono mt-1"
              />
              <Input
                value={ruleRight}
                onChange={(e) => setRuleRight(e.target.value)}
                placeholder="Rule right"
                className="h-7 text-xs font-mono mt-1"
              />
            </div>
          </div>

          {/* DAG displays */}
          <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              DAG expressions
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {leftDAG && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs w-full hover:bg-muted/50 rounded px-1 py-0.5">
                      <ChevronRight className="w-3 h-3" />
                      Left
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap p-1 bg-muted/30 rounded mt-0.5 overflow-x-auto">
                        {formatDAG(leftDAG)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {rightDAG && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs w-full hover:bg-muted/50 rounded px-1 py-0.5">
                      <ChevronRight className="w-3 h-3" />
                      Right
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap p-1 bg-muted/30 rounded mt-0.5 overflow-x-auto">
                        {formatDAG(rightDAG)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {ruleLeftDAG && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs w-full hover:bg-muted/50 rounded px-1 py-0.5">
                      <ChevronRight className="w-3 h-3" />
                      Rule left
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap p-1 bg-muted/30 rounded mt-0.5 overflow-x-auto">
                        {formatDAG(ruleLeftDAG)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {ruleRightDAG && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs w-full hover:bg-muted/50 rounded px-1 py-0.5">
                      <ChevronRight className="w-3 h-3" />
                      Rule right
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-[10px] font-mono whitespace-pre-wrap p-1 bg-muted/30 rounded mt-0.5 overflow-x-auto">
                        {formatDAG(ruleRightDAG)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {!leftDAG && !rightDAG && !ruleLeftDAG && !ruleRightDAG && (
                  <p className="text-xs text-muted-foreground p-2">Enter expressions to see DAGs</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Isomorphism / All rules results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              {hasRule ? 'Isomorphism' : 'All rules (axioms + definitions + theorems)'}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {hasRule ? (
                  <div className="space-y-1">
                    {isomorphismResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={r.match ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {r.match ? '✓' : '✗'}
                        </span>
                        <span>{r.label}</span>
                      </div>
                    ))}
                  </div>
                ) : leftExpr.trim() && rightExpr.trim() ? (
                  <div className="space-y-1">
                    {allRulesResults.filter((r) => r.match).length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground mb-1">Matching rules:</p>
                        {allRulesResults
                          .filter((r) => r.match)
                          .map((r, i) => (
                            <div key={i} className="text-xs flex items-center gap-2">
                              <span className="text-green-600 dark:text-green-400">✓</span>
                              <span className="font-mono truncate">{r.rule.id}</span>
                              {r.inferenceRule && (
                                <span className="text-muted-foreground">({r.inferenceRule})</span>
                              )}
                            </div>
                          ))}
                        <p className="text-xs text-muted-foreground mt-2 mb-1">Non-matching:</p>
                        {allRulesResults
                          .filter((r) => !r.match)
                          .slice(0, 20)
                          .map((r, i) => (
                            <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                              <span>✗</span>
                              <span className="font-mono truncate">{r.rule.id}</span>
                            </div>
                          ))}
                        {allRulesResults.filter((r) => !r.match).length > 20 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ... and {allRulesResults.filter((r) => !r.match).length - 20} more
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No matching rules. {allRulesResults.length} rules tried.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enter left and right expressions. With no rule, all axioms, definitions, and theorems are tried.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
  );

  if (embedded) {
    return isWorkbenchExpanded ? content : null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 bg-background border-t border-border shadow-lg z-30 transition-all duration-300 ease-in-out ${
        isWorkbenchExpanded ? 'h-80' : 'h-12'
      }`}
      style={{ right: isRulesPanelOpen ? '380px' : '0' }}
    >
      <div className="h-12 px-4 flex items-center justify-between border-b border-border cursor-pointer hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Bug className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Debug Workbench</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {isWorkbenchExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>
      {isWorkbenchExpanded && content}
    </div>
  );
};

export default DebugWorkbench;
