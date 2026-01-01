import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import IntroductionSection from '@/components/sections/IntroductionSection';
import ProofVerifierSection from '@/components/sections/ProofVerifierSection';
import RulesSidePanel from '@/components/rules/RulesSidePanel';
import UserWorkbench from '@/components/workbench/UserWorkbench';
import { usePanelContext } from '@/contexts/PanelContext';

const Index = () => {
  const { isWorkbenchExpanded } = usePanelContext();

  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16" />
      
      {/* Fixed Rules Panel Button */}
      <div className="fixed bottom-6 left-6 z-50">
        <RulesSidePanel />
      </div>
      
      <main className={`transition-all duration-300 ${isWorkbenchExpanded ? 'pb-80' : 'pb-12'}`}>
        <IntroductionSection />
        <div className="section-divider" />
        <ProofVerifierSection />
      </main>
      
      <Footer />
      
      {/* User Workbench */}
      <UserWorkbench />
    </div>
  );
};

export default Index;
