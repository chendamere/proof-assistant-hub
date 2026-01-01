import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import ProofVerifierSection from '@/components/sections/ProofVerifierSection';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import UserWorkbench from '@/components/workbench/UserWorkbench';
import { usePanelContext } from '@/contexts/PanelContext';

const Verifier = () => {
  const { isWorkbenchExpanded } = usePanelContext();

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16" />
      
      {/* Rules Side Panel */}
      <RulesSidePanel />
      
      <main className={`transition-all duration-300 ${isWorkbenchExpanded ? 'pb-80' : 'pb-12'}`}>
        <ProofVerifierSection />
      </main>
      
      <Footer />
      
      {/* User Workbench */}
      <UserWorkbench />
    </div>
  );
};

export default Verifier;
