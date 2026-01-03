import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="py-12 px-6 border-t border-border bg-card/50">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo and description */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-primary font-mono font-bold text-sm">UL</span>
              </div>
              <span className="font-semibold text-foreground">
                Universal Language Proof Assistant
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Based on "The Way of Machine Thinking" by Weili Chen (2023).
              A formal system for machine reasoning with self-defining axioms and equivalence relations.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link 
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Introduction
            </Link>
            <Link 
              to="/normalizer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Operand Normalizer
            </Link>
            <Link 
              to="/proof-step"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Proof Step
            </Link>
            <Link 
              to="/glossary"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Glossary
            </Link>
            <Link 
              to="/verifier"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Verifier
            </Link>
          </div>
        </div>

        <div className="section-divider my-8" />

        <p className="text-center text-xs text-muted-foreground">
          This proof assistant is an interactive implementation of the formal system described in the book.
          All axioms and theorems are derived from the original work.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
