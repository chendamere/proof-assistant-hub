import React from 'react';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import NodeDiagram from '@/components/visuals/NodeDiagram';
import TreeStructureDiagram from '@/components/visuals/TreeStructureDiagram';
import { BookOpen, ExternalLink, Hash, GitBranch, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const IntroductionSection: React.FC = () => {
  return (
    <section id="introduction" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <span className="text-primary font-mono text-sm tracking-widest uppercase mb-4 block">
            Volume 1: Rules of Universal Language
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-glow mb-6">
            The Way of Machine Thinking
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A formal system for machine reasoning — a universal language completely independent 
            of human natural language. This closed, self-defining system uses equivalence relations 
            to express all axioms, definitions, and theorems.
          </p>
        </div>

        {/* Book Section */}
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 card-glow animate-fade-in delay-500 mb-8">
          <div className="flex items-start gap-4 mb-4">
            <BookOpen className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-semibold text-primary mb-1">The Book</h3>
              <p className="text-sm text-muted-foreground font-mono">Volume 1: Rules of Universal Language and Fundamental Math</p>
            </div>
          </div>
          
          <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
            <p>
              In order to allow the machine to think in its own way, I designed this universal machine language. 
              This language is not just a programming language, but also a calculus language as conceived by Leibniz. 
              The calculus of language is the thinking process of machines.
            </p>
            <p>
              This language is very small, only 11 operators, but it is very complex and powerful. 
              It can understand its own structure and operation, and use this as a starting point to define 
              mathematical concepts and derive basic mathematical laws.
            </p>
            <p>
              In order to be able to perform calculations, first establish a logical system based on the principle 
              of equivalence, and then construct a propositional system based on selected operators. 
              All propositional properties can thus be deduced.
            </p>
            <p>
              Contradiction is clearly defined by which compatibility can be demonstrated. 
              The paradox can also be clearly defined. It can be shown that a paradox cannot lead to a contradiction.
            </p>
            <p>
              Except for the introduction of the first chapter, the book is written in universal language. 
              If you like proofs, you will really enjoy this book because it consists of explicit proofs. 
              Proof is also a thought process.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a 
              href="https://www.amazon.com/Way-Machine-Thinking-Universal-Fundamental/dp/B0CHL7WS7B" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                <span>Get the Book on Amazon</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
            <div className="font-bold text-sm text-amber-600 dark:text-amber-500">
              ⚠ Warning: The book consists primarily of proofs in UL
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-mono">801 pages</span>
              <span className="mx-2">·</span>
              <span>by Weili Chen</span>
            </div>
          </div>
        </div>
        {/* Data Structure Section with Diagrams */}
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 card-glow animate-fade-in delay-100 mb-8">
          <h3 className="text-xl font-semibold text-primary mb-4">Data Structure</h3>
          <p className="text-muted-foreground mb-6">
            The foundation is a tree-like multidimensional structure with doubly-linked circular nodes. 
            Each node contains:
          </p>
          
          <div className="grid md:grid-cols-[1fr,auto,auto] gap-6 items-start">
            {/* Text list */}
            <ul className="space-y-2 text-sm font-mono">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary/50" />
                <span>Data value</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-next" />
                <span>Link → next node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-next" />
                <span>Link → previous node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-next" />
                <span>Link → child node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-id" />
                <span>Unique node ID</span>
              </li>
            </ul>
            
            {/* Node Diagram */}
            <div className="flex items-center justify-center">
              <NodeDiagram />
            </div>
            
            {/* Tree Structure Diagram */}
            <div className="flex items-center justify-center">
              <TreeStructureDiagram />
            </div>
          </div>
        </div>

        {/* Core Concepts Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Logic System */}
          <div className="bg-card border border-border rounded-lg p-6 card-glow animate-fade-in delay-200">
            <h3 className="text-xl font-semibold text-primary mb-4">Logic System</h3>
            <p className="text-muted-foreground mb-4">
              Rules express equivalence relations between code sequences. All rules use the format:
            </p>
            <div className="bg-muted/30 rounded-md p-4 font-mono text-center flex items-center justify-center gap-2 text-lg">
              <span className="text-foreground">A</span>
              <EquivalenceSymbol size={28} />
              <span className="text-foreground">B</span>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">
              Where A and B are equivalent rule texts that can replace each other in any context after normalization.
            </p>
          </div>

          {/* Inference Rules */}
          <div className="bg-card border border-border rounded-lg p-6 card-glow animate-fade-in delay-300">
            <h3 className="text-xl font-semibold text-primary mb-4">Inference Rules</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">1.</span>
                <div>
                  <span className="font-semibold">Equivalent Commutativity</span>
                  <p className="text-muted-foreground">A ⟺ B implies B ⟺ A</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">2.</span>
                <div>
                  <span className="font-semibold">Equivalent Transitivity</span>
                  <p className="text-muted-foreground">A ⟺ B and B ⟺ C implies A ⟺ C</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-primary font-bold">3.</span>
                <div>
                  <span className="font-semibold">Equivalent Substitution</span>
                  <p className="text-muted-foreground">A ⟺ B allows replacing A with B in any context M·A·N → M·B·N</p>
                </div>
              </div>
            </div>
          </div>

          {/* Types of Rules */}
          <div className="bg-card border border-border rounded-lg p-6 card-glow animate-fade-in delay-400 md:col-span-2">
            <h3 className="text-xl font-semibold text-primary mb-4">Types of Rules</h3>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30">
                  AXIOM
                </span>
                <span className="text-muted-foreground text-sm">Natural properties, no proof needed</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs font-mono bg-operator-temp/20 text-operator-temp border border-operator-temp/30">
                  DEFINITION
                </span>
                <span className="text-muted-foreground text-sm">Concept definitions via rules</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs font-mono bg-operator-next/20 text-operator-next border border-operator-next/30">
                  THEOREM
                </span>
                <span className="text-muted-foreground text-sm">Proven conclusions from inference</span>
              </div>
            </div>
          </div>
        </div>

        

        {/* Navigation hint */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            Explore the complete system below
          </p>
          <div className="flex items-center justify-center gap-2 text-primary animate-bounce mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/normalizer">
              <Button variant="outline" className="gap-2">
                <Hash className="w-4 h-4" />
                Operand Normalizer
              </Button>
            </Link>
            <Link to="/proof-step">
              <Button variant="outline" className="gap-2">
                <GitBranch className="w-4 h-4" />
                Proof Step Demo
              </Button>
            </Link>
            <Link to="/glossary">
              <Button variant="outline" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Glossary
              </Button>
            </Link>
            <Link to="/verifier">
              <Button variant="outline" className="gap-2">
                <Play className="w-4 h-4" />
                Proof Verifier
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroductionSection;
