import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Network, ListOrdered, Library, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Navigation: React.FC = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const navItems: NavItem[] = [
    { path: '/', label: 'Introduction', icon: <BookOpen className="w-4 h-4" /> },
    { path: '/substitution-dag', label: 'Substitution DAG', icon: <Network className="w-4 h-4" /> },
    { path: '/proof-steps', label: 'Proof Steps', icon: <ListOrdered className="w-4 h-4" /> },
    { path: '/bibliography', label: 'Bibliography', icon: <Library className="w-4 h-4" /> },
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

          {/* Nav Items + Theme Toggle */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors relative ${
                  location.pathname === item.path
                    ? 'text-foreground bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {item.icon}
                <span className="text-sm hidden sm:block">{item.label}</span>
              </Link>
            ))}
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;