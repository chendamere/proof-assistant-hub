/**
 * Debug Workbench: inspect expressions as DAGs, check isomorphisms, and try all rules.
 * Fixed to bottom, expandable, same layout as UserWorkbench.
 */

import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Bug, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { exprToDAG, SingleRootDAGInjection } from '@/lib/dag';
import { DAGGraphVisual } from '@/components/dag/DAGGraphVisual';
import { checkInferenceRules } from '@/lib/inferenceRules';
import { trySubstitution } from '@/lib/inferenceRules/substitution';
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

/** Parse dragged rule from dataTransfer (RulesSidePanel format). draggedSide: 'left'|'right'|undefined (legacy) */
function parseDroppedRule(e: React.DragEvent): { leftSide: string; rightSide: string; draggedSide?: 'left' | 'right' } | null {
  try {
    const json = e.dataTransfer.getData('application/json');
    if (!json) return null;
    const data = JSON.parse(json);
    if (data?.leftSide != null && data?.rightSide != null) return data;
  } catch {
    // ignore
  }
  return null;
}

const DebugWorkbench: React.FC<DebugWorkbenchProps> = ({
  embedded = false,
  initialLeft = '',
  initialRight = '',
}) => {
  const ctx = usePanelContext();
  const [localLeft, setLocalLeft] = React.useState(initialLeft);
  const [localRight, setLocalRight] = React.useState(initialRight);
  const [leftDragOver, setLeftDragOver] = React.useState(false);
  const [rightDragOver, setRightDragOver] = React.useState(false);

  const leftExpr = embedded ? ctx.debugWorkbenchLeft : localLeft;
  const rightExpr = embedded ? ctx.debugWorkbenchRight : localRight;
  const setLeftExpr = embedded ? ctx.setDebugWorkbenchLeft : setLocalLeft;
  const setRightExpr = embedded ? ctx.setDebugWorkbenchRight : setLocalRight;
  const { isWorkbenchExpanded, isRulesPanelOpen } = ctx;
  const [ruleLeft, setRuleLeft] = React.useState('');
  const [ruleRight, setRuleRight] = React.useState('');
  const [ruleLeftDragOver, setRuleLeftDragOver] = React.useState(false);
  const [ruleRightDragOver, setRuleRightDragOver] = React.useState(false);

  /** Snapshot of inputs used for computation; updated only on Refresh to avoid heavy work on every keystroke */
  const [snapshot, setSnapshot] = React.useState<{
    left: string;
    right: string;
    ruleLeft: string;
    ruleRight: string;
  }>({ left: '', right: '', ruleLeft: '', ruleRight: '' });

  const onRefresh = React.useCallback(() => {
    setSnapshot({ left: leftExpr, right: rightExpr, ruleLeft, ruleRight });
  }, [leftExpr, rightExpr, ruleLeft, ruleRight]);

  const leftDAG = useMemo(() => (snapshot.left.trim() ? safeExprToDAG(snapshot.left) : null), [snapshot.left]);
  const rightDAG = useMemo(() => (snapshot.right.trim() ? safeExprToDAG(snapshot.right) : null), [snapshot.right]);
  const ruleLeftDAG = useMemo(() => (snapshot.ruleLeft.trim() ? safeExprToDAG(snapshot.ruleLeft) : null), [snapshot.ruleLeft]);
  const ruleRightDAG = useMemo(() => (snapshot.ruleRight.trim() ? safeExprToDAG(snapshot.ruleRight) : null), [snapshot.ruleRight]);

  const hasRule = snapshot.ruleLeft.trim() && snapshot.ruleRight.trim();

  const isomorphismResults = useMemo(() => {
    const hasMatch = (p: DAGStructure<ExprNodeData>, t: DAGStructure<ExprNodeData>) => {
      for (const _ of SingleRootDAGInjection(p, t)) return true;
      return false;
    };
    const results: { label: string; match: boolean }[] = [];
    if (!hasRule || !ruleLeftDAG || !ruleRightDAG) return results;
    if (leftDAG) {
      results.push({
        label: 'ruleLeft subgraph of left',
        match: hasMatch(ruleLeftDAG, leftDAG),
      });
      results.push({
        label: 'ruleRight subgraph of left',
        match: hasMatch(ruleRightDAG, leftDAG),
      });
    }
    if (rightDAG) {
      results.push({
        label: 'ruleLeft subgraph of right',
        match: hasMatch(ruleLeftDAG, rightDAG),
      });
      results.push({
        label: 'ruleRight subgraph of right',
        match: hasMatch(ruleRightDAG, rightDAG),
      });
    }
    return results;
  }, [hasRule, ruleLeftDAG, ruleRightDAG, leftDAG, rightDAG]);

  const hasIsomorphismMatch = isomorphismResults.some((r) => r.match);

  const equivalentSubstitutionResult = useMemo((): { match: boolean; direction?: string; substituted?: string; replace?: string } => {
    if (!hasRule || !hasIsomorphismMatch || !snapshot.left.trim() || !snapshot.right.trim()) {
      return { match: false };
    }
    const attempts: Array<{ target: string; ruleSide: string; otherSide: string; expected: string; targetForOperands: string; side: 'left' | 'right'; direction: string; replace: string }> = [
      { target: snapshot.left, ruleSide: snapshot.ruleLeft, otherSide: snapshot.ruleRight, expected: snapshot.right, targetForOperands: snapshot.left, side: 'left', direction: 'left → right', replace: `${snapshot.ruleLeft} → ${snapshot.ruleRight}` },
      { target: snapshot.left, ruleSide: snapshot.ruleRight, otherSide: snapshot.ruleLeft, expected: snapshot.right, targetForOperands: snapshot.left, side: 'left', direction: 'left → right', replace: `${snapshot.ruleRight} → ${snapshot.ruleLeft}` },
      { target: snapshot.right, ruleSide: snapshot.ruleLeft, otherSide: snapshot.ruleRight, expected: snapshot.left, targetForOperands: snapshot.right, side: 'right', direction: 'right → left', replace: `${snapshot.ruleLeft} → ${snapshot.ruleRight}` },
      { target: snapshot.right, ruleSide: snapshot.ruleRight, otherSide: snapshot.ruleLeft, expected: snapshot.left, targetForOperands: snapshot.right, side: 'right', direction: 'right → left', replace: `${snapshot.ruleRight} → ${snapshot.ruleLeft}` },
    ];
    for (const a of attempts) {
      try {
        const r = trySubstitution(a.target, a.ruleSide, a.otherSide, a.expected, a.targetForOperands, a.side);
        if (r?.match && r.reconstructedExpr != null) {
          return { match: true, direction: a.direction, substituted: r.reconstructedExpr, replace: a.replace };
        }
      } catch {
        // continue to next attempt
      }
    }
    return { match: false };
  }, [hasRule, hasIsomorphismMatch, snapshot.left, snapshot.right, snapshot.ruleLeft, snapshot.ruleRight]);

  const showEquivalentSubstitution = hasRule && hasIsomorphismMatch;

  const allRulesResults = useMemo(() => {
    if (!snapshot.left.trim() || !snapshot.right.trim() || hasRule) return [];
    const allRules = [...axioms, ...definitions, ...theorems];
    return allRules.map((r) => {
      const result = checkInferenceRules(snapshot.left, snapshot.right, r.leftSide, r.rightSide);
      return { rule: r, match: result.match, inferenceRule: result.inferenceRule };
    });
  }, [snapshot.left, snapshot.right, hasRule]);

  const content = (
        <div className="h-[calc(100%-3rem)] flex overflow-hidden">
          {/* Inputs */}
          <div className="w-80 flex-shrink-0 border-r border-border flex flex-col p-3 gap-3">
            <div>
              <Label className="text-xs">Left expression</Label>
              <div
                className={`rounded-md border transition-colors mt-1 ${leftDragOver ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setLeftDragOver(true);
                }}
                onDragLeave={() => setLeftDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setLeftDragOver(false);
                  const rule = parseDroppedRule(e);
                  if (rule) setLeftExpr(rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide);
                }}
              >
                <Input
                  value={leftExpr}
                  onChange={(e) => setLeftExpr(e.target.value)}
                  placeholder=", a \Od b, (or drag rule here)"
                  className="h-8 text-xs font-mono border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Right expression</Label>
              <div
                className={`rounded-md border transition-colors mt-1 ${rightDragOver ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setRightDragOver(true);
                }}
                onDragLeave={() => setRightDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRightDragOver(false);
                  const rule = parseDroppedRule(e);
                  if (rule) setRightExpr(rule.draggedSide === 'right' ? rule.rightSide : rule.leftSide);
                }}
              >
                <Input
                  value={rightExpr}
                  onChange={(e) => setRightExpr(e.target.value)}
                  placeholder=", b \Od a, (or drag rule here)"
                  className="h-8 text-xs font-mono border-border"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rule (optional)</Label>
              <div
                className={`rounded-md border transition-colors mt-1 ${ruleLeftDragOver ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setRuleLeftDragOver(true); }}
                onDragLeave={() => setRuleLeftDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setRuleLeftDragOver(false); const r = parseDroppedRule(e); if (r) setRuleLeft(r.draggedSide === 'right' ? r.rightSide : r.leftSide); }}
              >
                <Input
                  value={ruleLeft}
                  onChange={(e) => setRuleLeft(e.target.value)}
                  placeholder="Rule left (or drag rule)"
                  className="h-7 text-xs font-mono border-border"
                />
              </div>
              <div
                className={`rounded-md border transition-colors mt-1 ${ruleRightDragOver ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setRuleRightDragOver(true); }}
                onDragLeave={() => setRuleRightDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setRuleRightDragOver(false); const r = parseDroppedRule(e); if (r) setRuleRight(r.draggedSide === 'right' ? r.rightSide : r.leftSide); }}
              >
                <Input
                  value={ruleRight}
                  onChange={(e) => setRuleRight(e.target.value)}
                  placeholder="Rule right (or drag rule)"
                  className="h-7 text-xs font-mono border-border"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onRefresh}
              title="Refresh (compute DAG, isomorphism, substitution)"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
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
                  <p className="text-xs text-muted-foreground p-2">
                    {leftExpr.trim() || rightExpr.trim() ? 'Click Refresh to compute' : 'Enter expressions and click Refresh'}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* DAG structure visual (like Substitution DAG page) */}
          <div className="w-[520px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              DAG structure
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <div className="p-2 space-y-3 min-w-max">
                {leftDAG && leftDAG.nodes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Left</div>
                    <DAGGraphVisual structure={leftDAG} />
                  </div>
                )}
                {rightDAG && rightDAG.nodes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Right</div>
                    <DAGGraphVisual structure={rightDAG} />
                  </div>
                )}
                {ruleLeftDAG && ruleLeftDAG.nodes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Rule left</div>
                    <DAGGraphVisual structure={ruleLeftDAG} />
                  </div>
                )}
                {ruleRightDAG && ruleRightDAG.nodes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Rule right</div>
                    <DAGGraphVisual structure={ruleRightDAG} />
                  </div>
                )}
                {!leftDAG && !rightDAG && !ruleLeftDAG && !ruleRightDAG && (
                  <p className="text-xs text-muted-foreground p-2">
                    {leftExpr.trim() || rightExpr.trim() ? 'Click Refresh to compute' : 'Enter expressions and click Refresh'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Subgraph injection / All rules results */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
              {hasRule ? 'Subgraph injection' : 'All rules (axioms + definitions + theorems)'}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {hasRule ? (
                  <div className="space-y-2">
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
                    {showEquivalentSubstitution && (
                      <div className="pt-2 mt-2 border-t border-border">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Equivalent substitution</div>
                        {equivalentSubstitutionResult.match ? (
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs w-full hover:bg-muted/50 rounded px-1 py-0.5">
                              <ChevronRight className="w-3 h-3" />
                              <span className="text-green-600 dark:text-green-400">✓</span> {equivalentSubstitutionResult.direction} ({equivalentSubstitutionResult.replace})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="text-[10px] font-mono whitespace-pre-wrap p-1 bg-muted/30 rounded mt-0.5 overflow-x-auto">
                                {equivalentSubstitutionResult.substituted}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <p className="text-xs text-muted-foreground py-0.5">No equivalent substitution found</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : snapshot.left.trim() && snapshot.right.trim() ? (
                  <div className="space-y-1">
                    {allRulesResults.filter((r) => r.match).length > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground mb-1">Matching rules:</p>
                        {allRulesResults
                          .filter((r) => r.match)
                          .map((r, i) => (
                            <div key={i} className="text-xs flex items-center gap-2">
                              <span className="text-green-600 dark:text-green-400">✓</span>
                              <span className="font-mono truncate">{r.rule.name}</span>
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
                              <span className="font-mono truncate">{r.rule.name}</span>
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
                    {leftExpr.trim() && rightExpr.trim()
                      ? 'Click Refresh to run checks'
                      : 'Enter left and right expressions, then click Refresh. With no rule, all axioms, definitions, and theorems are tried.'}
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
        isWorkbenchExpanded ? 'h-[50vh]' : 'h-12'
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
