import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import IntroductionSection from '@/components/sections/IntroductionSection';

const Index = () => {
  return (
    <div className="min-h-screen gradient-bg">
      <Navigation />
      
      {/* Spacer for fixed nav */}
      <div className="h-16" />
      
      <main>
        <IntroductionSection />
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
