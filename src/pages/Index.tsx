import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import IntroductionSection from '@/components/sections/IntroductionSection';
import GlossarySection from '@/components/sections/GlossarySection';
import ProofVerifierSection from '@/components/sections/ProofVerifierSection';

const Index = () => {
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16" />
      
      <main>
        <IntroductionSection />
        <div className="section-divider" />
        <GlossarySection />
        <div className="section-divider" />
        <ProofVerifierSection />
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
