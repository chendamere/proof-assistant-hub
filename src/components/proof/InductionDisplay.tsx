import React from 'react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';

export interface InductionEq {
  left: string;
  right: string;
}

export interface InductionSchema {
  filename: string;
  title: string;
  base: InductionEq | null;
  stepIf: InductionEq | null;
  stepThen: InductionEq | null;
  conclusion: InductionEq | null;
}

export interface InductionProof {
  base: string[];
  hypothesis: InductionEq | null;
  then: string[];
  conclusion: InductionEq | null;
}

export interface InductionDisplayData {
  schemas: InductionSchema[];
  proofs: Record<string, InductionProof[]>;
}

/** In the induction axiom, \Tt is the same hole as \Tc. */
function holeAsTc(expr: string): string {
  return expr.replace(/\\Tt\b/g, '\\Tc');
}

function EqRow({ left, right, mapHoles }: { left: string; right: string; mapHoles?: boolean }) {
  const show = (s: string) => (mapHoles ? holeAsTc(s) : s);
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <ExpressionRenderer expression={show(left) || ','} size={12} />
      {right ? (
        <>
          <EquivalenceSymbol size={12} className="shrink-0 text-muted-foreground" />
          <ExpressionRenderer expression={show(right)} size={12} />
        </>
      ) : null}
    </div>
  );
}

function StepList({
  steps,
  results,
  resultStart,
}: {
  steps: string[];
  results?: Record<number, boolean>;
  resultStart: number;
}) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const verdict = i > 0 ? results?.[resultStart + i - 1] : undefined;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <li className="flex items-center gap-2 pl-8 text-xs list-none">
                <EquivalenceSymbol size={12} className="text-muted-foreground" />
                {verdict === true && <span className="text-green-600">passed</span>}
                {verdict === false && <span className="text-destructive">failed</span>}
              </li>
            )}
            <li
              className={`flex items-start gap-2 text-sm py-1 px-2 rounded border ${
                verdict === false ? 'bg-destructive/10 border-destructive/40' : 'bg-muted/30 border-border/50'
              }`}
            >
              <span className="text-muted-foreground shrink-0 font-mono w-6">{i + 1}.</span>
              <ExpressionRenderer expression={step} size={12} />
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

export function InductionSchemaCard({ schema }: { schema: InductionSchema }) {
  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div>
        <div className="text-sm font-semibold">{schema.title}</div>
        <p className="text-xs text-muted-foreground mt-1">
          This is the induction method, not a rule in the library. Two premises prove the conclusion.
          {' '}<span className="font-mono">\Tt</span> is the same hole as <span className="font-mono">\Tc</span>.
          {' '}<span className="font-mono">\Ri</span> is the arrow from the induction hypothesis to the induction step.
        </p>
      </div>
      {schema.conclusion && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Conclusion</div>
          <EqRow left={schema.conclusion.left} right={schema.conclusion.right} mapHoles />
        </div>
      )}
      {schema.base && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Premise 1, base case</div>
          <EqRow left={schema.base.left} right={schema.base.right} mapHoles />
        </div>
      )}
      {(schema.stepIf || schema.stepThen) && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Premise 2, induction step</div>
          {schema.stepIf && (
            <div className="pl-2 border-l-2 border-border space-y-1">
              <div className="text-xs text-muted-foreground">If</div>
              <EqRow left={schema.stepIf.left} right={schema.stepIf.right} mapHoles />
            </div>
          )}
          {schema.stepThen && (
            <div className="pl-2 border-l-2 border-primary/40 space-y-1">
              <div className="text-xs text-muted-foreground">then</div>
              <EqRow left={schema.stepThen.left} right={schema.stepThen.right} mapHoles />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InductionProofView({
  proofs,
  results,
}: {
  proofs: InductionProof[];
  results?: Record<number, boolean>;
}) {
  let cursor = 0;
  return (
    <div className="space-y-4">
      {proofs.map((proof, n) => {
        const baseStart = cursor;
        cursor += Math.max(0, proof.base.length - 1);
        const thenStart = cursor;
        cursor += Math.max(0, proof.then.length - 1);
        return (
        <div key={n} className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Induction proof{proofs.length > 1 ? ` ${n + 1}` : ''}
          </div>
          <div>
            <div className="text-xs font-medium mb-1">Base case</div>
            <StepList steps={proof.base} results={results} resultStart={baseStart} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium">Induction step</div>
            {proof.hypothesis && (
              <div className="pl-2 border-l-2 border-border space-y-1">
                <div className="text-xs text-muted-foreground">If</div>
                <EqRow left={proof.hypothesis.left} right={proof.hypothesis.right} />
              </div>
            )}
            <div className="pl-2 border-l-2 border-primary/40 space-y-1">
              <div className="text-xs text-muted-foreground">then</div>
              <StepList steps={proof.then} results={results} resultStart={thenStart} />
            </div>
          </div>
          {proof.conclusion && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Conclusion</div>
              <EqRow left={proof.conclusion.left} right={proof.conclusion.right} />
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
