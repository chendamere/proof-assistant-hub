import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PanelContextType {
  isRulesPanelOpen: boolean;
  setRulesPanelOpen: (open: boolean) => void;
  isWorkbenchExpanded: boolean;
  setWorkbenchExpanded: (expanded: boolean) => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export const PanelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRulesPanelOpen, setRulesPanelOpen] = useState(false);
  const [isWorkbenchExpanded, setWorkbenchExpanded] = useState(false);

  return (
    <PanelContext.Provider value={{
      isRulesPanelOpen,
      setRulesPanelOpen,
      isWorkbenchExpanded,
      setWorkbenchExpanded,
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
