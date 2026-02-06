import Navigation from '@/components/layout/Navigation';
import ProofVerifierSection from '@/components/sections/ProofVerifierSection';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import WorkbenchContainer from '@/components/workbench/WorkbenchContainer';
import { usePanelContext } from '@/contexts/PanelContext';

const Verifier = () => {
  const { isWorkbenchExpanded, isRulesPanelOpen } = usePanelContext();

  return (
    <div className="h-screen flex flex-col overflow-hidden gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16 flex-shrink-0" />
      
      {/* Rules Side Panel */}
      <RulesSidePanel />
      
      <main 
        className="flex-1 overflow-hidden transition-all duration-300"
        style={{
          marginRight: isRulesPanelOpen ? '380px' : '0',
          marginBottom: isWorkbenchExpanded ? '50vh' : '48px',
        }}
      >
        <ProofVerifierSection />
      </main>
      
      {/* Workbench (Workbench | Debug tabs) */}
      <WorkbenchContainer />
    </div>
  );
};

export default Verifier;
