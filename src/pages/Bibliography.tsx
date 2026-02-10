import React from 'react';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink } from 'lucide-react';

interface Reference {
  id: string;
  authors: string;
  title: string;
  publication: string;
  year: number;
  url?: string;
  annotation?: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  references: Reference[];
}

const SECTIONS: Section[] = [
  {
    id: 'formal-systems',
    title: 'Formal Systems & Proof Theory',
    description: 'Foundational works on formal languages, proof systems, and mechanized reasoning.',
    references: [
      {
        id: 'frege1879',
        authors: 'Frege, G.',
        title: 'Begriffsschrift, eine der arithmetischen nachgebildete Formelsprache des reinen Denkens',
        publication: 'Halle: Louis Nebert',
        year: 1879,
        annotation: 'The origin of formal logic as a symbolic calculus — the first formal system with quantifiers and propositional connectives.',
      },
      {
        id: 'leibniz1666',
        authors: 'Leibniz, G. W.',
        title: 'Dissertatio de Arte Combinatoria',
        publication: 'Leipzig',
        year: 1666,
        annotation: 'Leibniz\'s vision of a "calculus ratiocinator" — a universal formal language for reasoning — directly inspires the Universal Language concept.',
      },
      {
        id: 'godel1931',
        authors: 'Gödel, K.',
        title: 'Über formal unentscheidbare Sätze der Principia Mathematica und verwandter Systeme I',
        publication: 'Monatshefte für Mathematik und Physik, 38(1), 173–198',
        year: 1931,
        annotation: 'Incompleteness theorems establishing fundamental limits of formal systems — essential context for the paradox chapter.',
      },
      {
        id: 'gentzen1935',
        authors: 'Gentzen, G.',
        title: 'Untersuchungen über das logische Schließen',
        publication: 'Mathematische Zeitschrift, 39(1), 176–210',
        year: 1935,
        annotation: 'Introduction of natural deduction and sequent calculus, foundational to structural proof theory.',
      },
      {
        id: 'curry1958',
        authors: 'Curry, H. B. & Feys, R.',
        title: 'Combinatory Logic, Volume I',
        publication: 'North-Holland Publishing Company',
        year: 1958,
        annotation: 'Foundational treatment of combinatory logic, relevant to the system\'s operator-based formalism without variable binding.',
      },
      {
        id: 'debruijn1968',
        authors: 'de Bruijn, N. G.',
        title: 'The Mathematical Language AUTOMATH, Its Usage and Some of Its Extensions',
        publication: 'Symposium on Automatic Demonstration, Lecture Notes in Mathematics 125, Springer',
        year: 1968,
        annotation: 'One of the first systems for writing mathematics in a formal language checkable by machine.',
      },
      {
        id: 'coquand1988',
        authors: 'Coquand, T. & Huet, G.',
        title: 'The Calculus of Constructions',
        publication: 'Information and Computation, 76(2–3), 95–120',
        year: 1988,
        annotation: 'Type-theoretic foundation for proof assistants like Coq; demonstrates how formal systems can verify their own proofs.',
      },
      {
        id: 'harrison2009',
        authors: 'Harrison, J., Urban, J., & Wiedijk, F.',
        title: 'History of Interactive Theorem Proving',
        publication: 'Handbook of the History of Logic, 9, 135–214. Elsevier',
        year: 2009,
        url: 'https://doi.org/10.1016/S1874-5857(09)70018-7',
        annotation: 'Survey of mechanized proof systems (HOL, Isabelle, Coq, Mizar) — context for the proof verification approach used here.',
      },
    ],
  },
  {
    id: 'equational-logic',
    title: 'Universal Algebra & Equational Logic',
    description: 'Theory of equivalence-based reasoning, term rewriting, and algebraic structures.',
    references: [
      {
        id: 'birkhoff1935',
        authors: 'Birkhoff, G.',
        title: 'On the Structure of Abstract Algebras',
        publication: 'Proceedings of the Cambridge Philosophical Society, 31(4), 433–454',
        year: 1935,
        annotation: 'Birkhoff\'s HSP theorem — varieties defined by equational axioms, directly relevant to the equivalence-only axiom system.',
      },
      {
        id: 'knuth1970',
        authors: 'Knuth, D. E. & Bendix, P. B.',
        title: 'Simple Word Problems in Universal Algebras',
        publication: 'Computational Problems in Abstract Algebra, 263–297. Pergamon Press',
        year: 1970,
        annotation: 'The Knuth-Bendix completion algorithm for equational reasoning — the algorithmic foundation for rewriting-based proof search.',
      },
      {
        id: 'baader1998',
        authors: 'Baader, F. & Nipkow, T.',
        title: 'Term Rewriting and All That',
        publication: 'Cambridge University Press',
        year: 1998,
        annotation: 'Comprehensive treatment of term rewriting systems, unification, and completion — directly relevant to the substitution engine.',
      },
      {
        id: 'burris1981',
        authors: 'Burris, S. & Sankappanavar, H. P.',
        title: 'A Course in Universal Algebra',
        publication: 'Springer-Verlag',
        year: 1981,
        url: 'https://www.math.uwaterloo.ca/~snburris/htdocs/ualg.html',
        annotation: 'Standard reference for universal algebra; covers congruences, free algebras, and equational classes.',
      },
      {
        id: 'meinke1992',
        authors: 'Meinke, K. & Tucker, J. V.',
        title: 'Universal Algebra',
        publication: 'Handbook of Logic in Computer Science, 1, 189–411. Oxford University Press',
        year: 1992,
        annotation: 'Survey connecting universal algebra to computer science, covering algebraic specifications and initial semantics.',
      },
      {
        id: 'tarski1968',
        authors: 'Tarski, A.',
        title: 'Equational Logic and Equational Theories of Algebras',
        publication: 'Contributions to Mathematical Logic, North-Holland, 275–288',
        year: 1968,
        annotation: 'Tarski\'s work on equational logic as a complete deductive system — the theoretical basis for equivalence-only inference.',
      },
    ],
  },
  {
    id: 'graph-algorithms',
    title: 'Graph & Tree Algorithms',
    description: 'Subgraph isomorphism, DAG representations, and tree matching algorithms used in the implementation.',
    references: [
      {
        id: 'cordella2004',
        authors: 'Cordella, L. P., Foggia, P., Sansone, C., & Vento, M.',
        title: 'A (Sub)Graph Isomorphism Algorithm for Matching Large Graphs',
        publication: 'IEEE Transactions on Pattern Analysis and Machine Intelligence, 26(10), 1367–1372',
        year: 2004,
        url: 'https://doi.org/10.1109/TPAMI.2004.75',
        annotation: 'The VF2 algorithm used in this system for DAG-based rule matching via subgraph isomorphism.',
      },
      {
        id: 'cordella2001',
        authors: 'Cordella, L. P., Foggia, P., Sansone, C., & Vento, M.',
        title: 'An Improved Algorithm for Matching Large Graphs',
        publication: '3rd IAPR-TC15 Workshop on Graph-based Representations in Pattern Recognition, 149–159',
        year: 2001,
        annotation: 'Earlier formulation of the VF2 approach with detailed feasibility analysis for candidate pair selection.',
      },
      {
        id: 'ullmann1976',
        authors: 'Ullmann, J. R.',
        title: 'An Algorithm for Subgraph Isomorphism',
        publication: 'Journal of the ACM, 23(1), 31–42',
        year: 1976,
        url: 'https://doi.org/10.1145/321921.321925',
        annotation: 'The classical backtracking algorithm for subgraph isomorphism — predecessor to VF2.',
      },
      {
        id: 'aho1974',
        authors: 'Aho, A. V., Hopcroft, J. E., & Ullman, J. D.',
        title: 'The Design and Analysis of Computer Algorithms',
        publication: 'Addison-Wesley',
        year: 1974,
        annotation: 'Classic reference covering DAG representations of expressions and tree pattern matching algorithms.',
      },
      {
        id: 'comon2007',
        authors: 'Comon, H., Dauchet, M., Gilleron, R., et al.',
        title: 'Tree Automata Techniques and Applications (TATA)',
        publication: 'Online publication',
        year: 2007,
        url: 'http://tata.gforge.inria.fr/',
        annotation: 'Comprehensive treatment of tree automata — relevant to tree-structured expression matching and transformation.',
      },
      {
        id: 'bonnici2013',
        authors: 'Bonnici, V., Giugno, R., Pulvirenti, A., Shasha, D., & Ferro, A.',
        title: 'A Subgraph Isomorphism Algorithm and Its Application to Biochemical Data',
        publication: 'BMC Bioinformatics, 14(Suppl 7), S13',
        year: 2013,
        url: 'https://doi.org/10.1186/1471-2105-14-S7-S13',
        annotation: 'RI algorithm for subgraph isomorphism with improved pruning strategies — alternative to VF2 for large graphs.',
      },
    ],
  },
];

const Bibliography: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 pt-24 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Bibliography &amp; References
            </h1>
            <p className="text-sm text-muted-foreground">
              Academic works relevant to the formal system, its proof engine, and underlying algorithms.
            </p>
          </div>

          <Accordion type="multiple" defaultValue={SECTIONS.map(s => s.id)} className="space-y-3">
            {SECTIONS.map((section) => (
              <AccordionItem key={section.id} value={section.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 py-3 hover:no-underline text-base font-semibold">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                  <div className="space-y-4">
                    {section.references.map((ref) => (
                      <div key={ref.id} className="border-l-2 border-primary/30 pl-4 space-y-1">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{ref.authors}</span>{' '}
                          <span className="text-muted-foreground">({ref.year}).</span>{' '}
                          <span className="italic">{ref.title}.</span>{' '}
                          <span className="text-muted-foreground">{ref.publication}.</span>
                          {ref.url && (
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </p>
                        {ref.annotation && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {ref.annotation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Bibliography;
