import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, CheckSquare, Hash, GitBranch } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const navItems: NavItem[] = [
    { path: '/', label: 'Introduction', icon: <BookOpen className="w-4 h-4" /> },
    { path: '/verifier', label: 'Verifier', icon: <CheckSquare className="w-4 h-4" /> },
    { path: '/normalizer', label: 'Normalizer', icon: <Hash className="w-4 h-4" /> },
    { path: '/proof-step', label: 'Proof Step', icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-mono font-bold text-sm">UL</span>
            </div>
            <span className="font-semibold text-foreground hidden sm:block">
              Universal Language
            </span>
          </Link>

          {/* Nav Items */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  location.pathname === item.path
                    ? 'text-foreground bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.icon}
                <span className="text-sm hidden sm:block">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/verifier"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors hidden md:block"
          >
            Start Proving
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
