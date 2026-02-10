import React from 'react';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import NodeDiagram from '@/components/visuals/NodeDiagram';
import TreeStructureDiagram from '@/components/visuals/TreeStructureDiagram';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const IntroductionSection: React.FC = () => {
  return (
    <section id="introduction" className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <span className="text-primary font-mono text-sm tracking-widest uppercase mb-4 block">
            Volume 1: Rules of Universal Language
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-glow mb-6">
            The Way of Machine Thinking
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A formal system for machine reasoning — a (maximal) universal language completely independent 
            of human natural language. This closed, self-defining system uses equivalence relations 
            to express all axioms, definitions, and theorems.
          </p>
        </div>

        <Accordion type="multiple" defaultValue={["book"]} className="space-y-3">
          {/* Book Section */}
          <AccordionItem value="book" className="bg-card border border-border rounded-lg card-glow animate-fade-in delay-500">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="text-left">
                  <span className="text-lg font-semibold text-primary">The Book</span>
                  <span className="text-xs text-muted-foreground font-mono ml-3">Volume 1</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
                <p>
                  The author designed this formal system and its language to serve as a machine reasoning language. 
                  This language is not just a programming language, but also a calculus language conceivable by 
                  Leibniz's idea of calculus of language.
                </p>
                <p>
                  This core of the language is very small, with only 11 primitive operators, but it is very complex and powerful. 
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
            </AccordionContent>
          </AccordionItem>

          {/* Data Structure Section */}
          <AccordionItem value="data-structure" className="bg-card border border-border rounded-lg card-glow animate-fade-in delay-100">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-lg font-semibold text-primary">Data Structure</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <p className="text-muted-foreground mb-6">
                The assumed data structure is a multidimensional cyclical graph with bidirectional links between nodes. Each cycle contains a null node. 
                Each node contains a link to a null child cycle.  
                Each node contains:
              </p>
              <div className="grid md:grid-cols-[1fr,auto,auto] gap-6 items-start">
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
                <div className="flex items-center justify-center">
                  <NodeDiagram />
                </div>
                <div className="flex items-center justify-center">
                  <TreeStructureDiagram />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Logic System */}
          <AccordionItem value="logic" className="bg-card border border-border rounded-lg card-glow animate-fade-in delay-200">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-lg font-semibold text-primary">Logic System</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
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
            </AccordionContent>
          </AccordionItem>

          {/* Inference Rules */}
          <AccordionItem value="inference" className="bg-card border border-border rounded-lg card-glow animate-fade-in delay-300">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-lg font-semibold text-primary">Inference Rules</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
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
                    <p className="text-muted-foreground">A ⟺ B allows inserting A with B in any context M·A·N → M·B·N</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Types of Rules */}
          <AccordionItem value="types" className="bg-card border border-border rounded-lg card-glow animate-fade-in delay-400">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <span className="text-lg font-semibold text-primary">Types of Rules</span>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
};

export default IntroductionSection;
