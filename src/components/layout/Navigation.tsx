import React from 'react';
import { BookOpen, List, CheckSquare } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const Navigation: React.FC = () => {
  const navItems: NavItem[] = [
    { id: 'introduction', label: 'Introduction', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'glossary', label: 'Glossary', icon: <List className="w-4 h-4" /> },
    { id: 'verifier', label: 'Verifier', icon: <CheckSquare className="w-4 h-4" /> },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-mono font-bold text-sm">UL</span>
            </div>
            <span className="font-semibold text-foreground hidden sm:block">
              Universal Language
            </span>
          </div>

          {/* Nav Items */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {item.icon}
                <span className="text-sm hidden sm:block">{item.label}</span>
              </button>
            ))}
          </div>

          {/* CTA */}
          <a
            href="#verifier"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('verifier');
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors hidden md:block"
          >
            Start Proving
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
