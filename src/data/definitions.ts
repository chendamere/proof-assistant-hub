/**
 * Definitions - equivalence rules that define concepts.
 * Structure matches axioms.ts and theorems.ts.
 */

import type { Rule } from './axioms';

export const definitions: Rule[] = [
  // Definition of node value comparison (from relationships.tex)
  {
    id: 'def-pe-oe-same',
    name: 'Pe/Oe same node',
    type: 'definition',
    category: 'relationships',
    description: 'Definition: Pe same node as Oe same node',
    leftSide: ', \\Blb{i \\Pe i}{,}{,}',
    rightSide: ', \\Blb{i \\Oe i}{,}{,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison',
  },
  {
    id: 'def-pe-branch',
    name: 'Pe same node proposition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition: i Pe i as branch',
    leftSide: ',i \\Pe i,',
    rightSide: ', \\Bb{i \\Pe i}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison',
  },
  {
    id: 'def-pe-oe-diff',
    name: 'Pe/Oe different nodes',
    type: 'definition',
    category: 'relationships',
    description: 'Definition: Pe different nodes as Oe different nodes',
    leftSide: ', \\Blb{i \\Pe j}{,}{,}',
    rightSide: ', \\Blb{i \\Oe j}{,}{,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison',
  },
  {
    id: 'def-pe-diff-branch',
    name: 'Pe different nodes proposition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition: i Pe j as branch',
    leftSide: ',i \\Pe j,',
    rightSide: ', \\Bb{i \\Pe j}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison',
  },
  {
    id: 'def-npe',
    name: 'nPe definition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition: i nPe j',
    leftSide: ',i \\nPe j,',
    rightSide: ', \\Bb{i \\Pe j}{,\\Or,}{,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison',
  },
];
