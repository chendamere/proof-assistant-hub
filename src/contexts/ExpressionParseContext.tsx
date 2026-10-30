import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  fromOperatorFirst,
  markOperatorFirst,
  type ExpressionParseMode,
} from '@engine/inferenceRules/operatorFirst';

export type { ExpressionParseMode };

interface ExpressionParseContextValue {
  mode: ExpressionParseMode;
  setMode: (mode: ExpressionParseMode) => void;
  /** Mark a user-typed expression so the checker reads it in the selected mode. Stored rules stay unmarked. */
  prepare: (expr: string) => string;
  /** Book form for on-screen rendering. Stored expressions are already in this form. */
  display: (expr: string) => string;
  /** Book form for comparing a typed rule with the stored database. */
  toBook: (expr: string) => string;
}

const ExpressionParseContext = createContext<ExpressionParseContextValue | null>(null);

const STORAGE_KEY = 'expression-parse-mode';

export const ExpressionParseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ExpressionParseMode>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'operator-first' ? 'operator-first' : 'normal';
    } catch {
      return 'normal';
    }
  });

  const setMode = useCallback((next: ExpressionParseMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ExpressionParseContextValue>(() => {
    const operatorFirst = mode === 'operator-first';
    return {
      mode,
      setMode,
      prepare: (expr) => (operatorFirst ? markOperatorFirst(expr) : expr),
      display: (expr) => (operatorFirst ? fromOperatorFirst(expr) : expr),
      toBook: (expr) => (operatorFirst ? fromOperatorFirst(expr) : expr),
    };
  }, [mode, setMode]);

  return <ExpressionParseContext.Provider value={value}>{children}</ExpressionParseContext.Provider>;
};

export function useExpressionParseMode(): ExpressionParseContextValue {
  const ctx = useContext(ExpressionParseContext);
  if (!ctx) {
    return {
      mode: 'normal',
      setMode: () => {},
      prepare: (expr) => expr,
      display: (expr) => expr,
      toBook: (expr) => expr,
    };
  }
  return ctx;
}
