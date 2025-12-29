import React from 'react';
import { OperatorLegend, EquivalenceSymbol } from '@/components/operators/OperatorSymbols';

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

        {/* Core Concepts Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Data Structure */}
          <div className="bg-card border border-border rounded-lg p-6 card-glow animate-fade-in delay-100">
            <h3 className="text-xl font-semibold text-primary mb-4">Data Structure</h3>
            <p className="text-muted-foreground mb-4">
              The foundation is a tree-like multidimensional structure with doubly-linked circular nodes. 
              Each node contains:
            </p>
            <ul className="space-y-2 text-sm font-mono">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary/50" />
                <span>Data value</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-next/50" />
                <span>Link → next node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-prev/50" />
                <span>Link → previous node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-subnode/50" />
                <span>Link → child node</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-operator-id/50" />
                <span>Unique node ID</span>
              </li>
            </ul>
          </div>

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
              Where A and B are equivalent rule texts that can replace each other in any context.
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
          <div className="bg-card border border-border rounded-lg p-6 card-glow animate-fade-in delay-400">
            <h3 className="text-xl font-semibold text-primary mb-4">Types of Rules</h3>
            <div className="space-y-3">
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

        {/* Operators Section */}
        <div className="animate-fade-in delay-500">
          <h2 className="text-2xl font-semibold text-center mb-8">
            The 11 Operators
          </h2>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Universal Language uses 11 operators to manipulate data structures. 
            Each operator is represented by a unique symbol.
          </p>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <OperatorLegend />
          </div>
        </div>


        {/* Navigation hint */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-4">
            Explore the complete system below
          </p>
          <div className="flex items-center justify-center gap-2 text-primary animate-bounce">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntroductionSection;
