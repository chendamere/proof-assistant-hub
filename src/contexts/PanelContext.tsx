import React, { createContext, useContext, useState, ReactNode } from 'react';

export type WorkbenchTab = 'workbench' | 'debug';

interface PanelContextType {
  isRulesPanelOpen: boolean;
  setRulesPanelOpen: (open: boolean) => void;
  isWorkbenchExpanded: boolean;
  setWorkbenchExpanded: (expanded: boolean) => void;
  workbenchTab: WorkbenchTab;
  setWorkbenchTab: (tab: WorkbenchTab) => void;
  debugWorkbenchLeft: string;
  debugWorkbenchRight: string;
  setDebugWorkbenchLeft: (v: string) => void;
  setDebugWorkbenchRight: (v: string) => void;
  setDebugWorkbenchExpressions: (left: string, right: string) => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export const PanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRulesPanelOpen, setRulesPanelOpen] = useState(false);
  const [isWorkbenchExpanded, setWorkbenchExpanded] = useState(false);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('debug');
  const [debugWorkbenchLeft, setDebugWorkbenchLeft] = useState('');
  const [debugWorkbenchRight, setDebugWorkbenchRight] = useState('');

  const setDebugWorkbenchExpressions = (left: string, right: string) => {
    setDebugWorkbenchLeft(left);
    setDebugWorkbenchRight(right);
    setWorkbenchTab('debug');
    setWorkbenchExpanded(true);
  };

  return (
    <PanelContext.Provider value={{
      isRulesPanelOpen,
      setRulesPanelOpen,
      isWorkbenchExpanded,
      setWorkbenchExpanded,
      workbenchTab,
      setWorkbenchTab,
      debugWorkbenchLeft,
      debugWorkbenchRight,
      setDebugWorkbenchLeft,
      setDebugWorkbenchRight,
      setDebugWorkbenchExpressions,
    }}>
      {children}
    </PanelContext.Provider>
  );
};

export const usePanelContext = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within a PanelProvider');
  }
  return context;
};
