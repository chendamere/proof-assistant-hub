import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map chapter/section names to categories
function mapToCategory(chapter, section) {
  const chapterLower = chapter.toLowerCase();
  const sectionLower = section.toLowerCase();
  
  if (chapterLower.includes('operator') || sectionLower.includes('operator')) {
    return 'operators';
  }
  if (chapterLower.includes('relationship') || sectionLower.includes('relationship') || 
      sectionLower.includes('comparison') || sectionLower.includes('connectivity') ||
      sectionLower.includes('subnode') || sectionLower.includes('node')) {
    return 'relationships';
  }
  if (sectionLower.includes('proposition') || sectionLower.includes('branch')) {
    return 'propositions';
  }
  if (sectionLower.includes('induction')) {
    return 'induction';
  }
  if (sectionLower.includes('arithmetic') || sectionLower.includes('number') ||
      sectionLower.includes('addition') || sectionLower.includes('multiplication')) {
    return 'arithmetic';
  }
  if (sectionLower.includes('logic') || sectionLower.includes('paradox') ||
      sectionLower.includes('empty') || sectionLower.includes('branch function')) {
    return 'logic';
  }
  
  // Default to operators if unclear
  return 'operators';
}

// Generate a unique ID from filename and rule content
function generateId(filename, index, leftSide, rightSide) {
  const baseName = path.basename(filename, '.tex').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Create a short hash from the rule content
  const contentHash = (leftSide + rightSide).slice(0, 20).replace(/[^a-z0-9]/g, '').slice(0, 8);
  
  return `${baseName}-${index}-${contentHash}`;
}

// Generate a name from the rule content
// Extract text before ":" if present, otherwise use section/subsection name
function generateName(leftSide, rightSide, section, subsection) {
  // If there's a section or subsection, use it as the base name
  let baseName = '';
  if (subsection) {
    baseName = subsection;
  } else if (section) {
    baseName = section;
  }
  
  // Extract text before ":" if present
  if (baseName && baseName.includes(':')) {
    baseName = baseName.split(':')[0].trim();
  }
  
  // If we have a base name, return it
  if (baseName) {
    return baseName;
  }
  
  // Fallback: generate from rule content
  if (!leftSide || leftSide.trim() === '' || leftSide.trim() === ',') {
    const rightClean = rightSide.replace(/^,\s*|,\s*$/g, '').slice(0, 30);
    return `Create: ${rightClean}`;
  }
  
  // Try to extract meaningful parts
  const leftClean = leftSide.replace(/^,\s*|,\s*$/g, '').slice(0, 40);
  const rightClean = rightSide.replace(/^,\s*|,\s*$/g, '').slice(0, 40);
  
  return `${leftClean} ⟺ ${rightClean}`;
}

// Determine if a rule type should be 'axiom', 'definition', or 'theorem'
function determineRuleType(chapter, section, subsection, hasProof, filename) {
  const chapterLower = chapter.toLowerCase();
  const sectionLower = section.toLowerCase();
  const subsectionLower = subsection.toLowerCase();
  const filenameLower = filename.toLowerCase();
  
  // Check for explicit "axiom" indicators
  if (sectionLower.includes('axiom') || subsectionLower.includes('axiom') || 
      chapterLower.includes('axiom') || filenameLower.includes('axiom')) {
    return 'axiom';
  }
  
  // Check for explicit "definition" indicators
  if (sectionLower.includes('definition') || subsectionLower.includes('definition') ||
      chapterLower.includes('definition')) {
    return 'definition';
  }
  
  // If there's a proof, it's likely a theorem
  if (hasProof) {
    return 'theorem';
  }
  
  // Default to theorem for theorem files
  return 'theorem';
}

// Parse LaTeX file and extract rules
function parseLatexFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  
  // Track proof blocks to skip rules inside them
  // Mark lines that are inside proof blocks
  const lines = content.split('\n');
  const isInProofBlock = new Array(lines.length).fill(false);
  let inProofBlock = false;
  let proofBlockStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for start of proof block
    if (line.includes('proof:\\') || line.includes('\\begin{math}')) {
      inProofBlock = true;
      proofBlockStart = i;
    }
    
    // Check for end of proof block
    if (inProofBlock && line.includes('\\end{math}')) {
      // Mark all lines from start to end as being in proof block
      for (let j = proofBlockStart; j <= i; j++) {
        isInProofBlock[j] = true;
      }
      inProofBlock = false;
      proofBlockStart = -1;
    } else if (inProofBlock) {
      isInProofBlock[i] = true;
    }
  }
  
  const rules = [];
  let currentChapter = '';
  let currentSection = '';
  let currentSubsection = '';
  let ruleIndex = 0;
  let lastRuleLeftSide = ''; // Track previous rule's left side for \sim expansion
  let lastRuleRightSide = ''; // Track previous rule's right side for \sim expansion
  let emptyLeftRuleCount = 0; // Track consecutive empty left rules (proof steps)
  let hasProofBlock = false; // Track if current section has a proof block
  let seenProofBlock = false; // Track if we've seen a proof block in current section
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and comments
    if (!line || line.startsWith('%')) {
      continue;
    }
    
    // Check if we're entering/exiting a proof block
    if (line.includes('proof:\\') || line.includes('\\begin{math}')) {
      hasProofBlock = true;
      seenProofBlock = true;
      // Skip this line and all subsequent lines until \end{math}
      continue;
    }
    if (line.includes('\\end{math}')) {
      hasProofBlock = false;
      continue;
    }
    
    // Skip lines inside proof blocks
    if (isInProofBlock[i]) {
      continue;
    }
    
    // Extract chapter
    const chapterMatch = line.match(/\\chapter\{([^}]+)\}/);
    if (chapterMatch) {
      currentChapter = chapterMatch[1];
      currentSection = '';
      currentSubsection = '';
      lastRuleLeftSide = ''; // Reset when new chapter
      lastRuleRightSide = ''; // Reset when new chapter
      emptyLeftRuleCount = 0;
      hasProofBlock = false;
      seenProofBlock = false;
    }
    
    // Extract section
    const sectionMatch = line.match(/\\section\{([^}]+)\}/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentSubsection = '';
      lastRuleLeftSide = ''; // Reset when new section
      lastRuleRightSide = ''; // Reset when new section
      emptyLeftRuleCount = 0;
      hasProofBlock = false;
      seenProofBlock = false;
    }
    
    // Extract subsection
    const subsectionMatch = line.match(/\\subsection\{([^}]+)\}/);
    if (subsectionMatch) {
      currentSubsection = subsectionMatch[1];
      lastRuleLeftSide = ''; // Reset when new subsection
      lastRuleRightSide = ''; // Reset when new subsection
      emptyLeftRuleCount = 0;
      hasProofBlock = false;
      seenProofBlock = false;
    }
    
    // Extract rules - pattern: \[, leftSide, \Rq , rightSide,\]
    // Also handle: \[, leftSide, \Rq \sim, rightSide,\]
    // And: \[, \Rq , rightSide,\] (empty left side)
    // Need to match the full \[...\] block, handling nested braces in branch operators
    let ruleMatch = null;
    
    // Check if line contains a rule pattern
    if (line.includes('\\[') && line.includes('\\Rq') && line.includes('\\]')) {
      // More robust pattern that handles nested structures
      // Match: \[, ... , \Rq( \sim)? , ... ,\]
      // Use a more sophisticated approach to handle nested braces
      
      // First, try to find the positions of \[ and \]
      const startIdx = line.indexOf('\\[');
      const endIdx = line.lastIndexOf('\\]');
      
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const ruleContent = line.substring(startIdx + 2, endIdx); // Content between \[ and \]
        
        // Find \Rq position - handle both with and without comma before \Rq
        // Pattern: (comma or start), spaces, \Rq, optional \sim, spaces, comma
        let rqMatch = ruleContent.match(/,\s*\\Rq(?:\s*\\sim)?\s*,/);
        
        // If no match with comma before, try without comma (space before \Rq)
        if (!rqMatch) {
          rqMatch = ruleContent.match(/\s+\\Rq(?:\s*\\sim)?\s*,/);
        }
        
        // If still no match, try just \Rq followed by comma or end
        if (!rqMatch) {
          rqMatch = ruleContent.match(/\\Rq(?:\s*\\sim)?\s*,/);
        }
        
        if (rqMatch) {
          const rqPos = rqMatch.index;
          let leftSide = ruleContent.substring(0, rqPos).trim();
          let rightSide = ruleContent.substring(rqPos + rqMatch[0].length).trim();
          
          // Remove leading comma from leftSide if present
          leftSide = leftSide.replace(/^,\s*/, '');
          // Remove trailing comma from rightSide if present
          rightSide = rightSide.replace(/,\s*$/, '');
          
          // Remove leading/trailing commas and whitespace
          leftSide = leftSide.replace(/^,\s*|,\s*$/g, '').trim();
          rightSide = rightSide.replace(/^,\s*|,\s*$/g, '').trim();
          
          ruleMatch = [null, leftSide, rightSide]; // Create array-like match result
        }
        
        // Handle empty left side: \[, \Rq , ... ,\]
        if (!ruleMatch) {
          const emptyLeftMatch = ruleContent.match(/,\s*\\Rq(?:\s*\\sim)?\s*,\s*(.*?)\s*,?\s*$/);
          if (emptyLeftMatch) {
            let rightSide = emptyLeftMatch[1].trim();
            rightSide = rightSide.replace(/,\s*$/, '').trim();
            ruleMatch = [null, '', rightSide];
          }
        }
        
        // Handle case where \Rq is at the start (no comma before)
        if (!ruleMatch) {
          const startRqMatch = ruleContent.match(/^\\Rq(?:\s*\\sim)?\s*,\s*(.*?)\s*,?\s*$/);
          if (startRqMatch) {
            let rightSide = startRqMatch[1].trim();
            rightSide = rightSide.replace(/,\s*$/, '').trim();
            ruleMatch = [null, '', rightSide];
          }
        }
      }
    }
    
    // If line has incomplete rule markers, skip (might span multiple lines)
    if (!ruleMatch && (line.includes('\\[') && line.includes('\\Rq') && !line.includes('\\]'))) {
      continue;
    }
    
    if (ruleMatch) {
      let leftSide = ruleMatch[1] ? ruleMatch[1].trim() : '';
      let rightSide = ruleMatch[2] ? ruleMatch[2].trim() : '';
      const hasSim = ruleMatch[0] && ruleMatch[0].includes('\\sim');
      
      // Check if left side is empty (just comma or whitespace)
      const isEmptyLeft = !leftSide || leftSide.trim() === '' || leftSide.trim() === ',';
      
      // If we have consecutive empty left rules, this is likely a proof step sequence
      // Skip rules that are part of proof step sequences (more than 1 empty left rule in a row)
      if (isEmptyLeft) {
        emptyLeftRuleCount++;
        if (emptyLeftRuleCount > 1) {
          // This is a proof step, skip it
          continue;
        }
      } else {
        emptyLeftRuleCount = 0; // Reset counter when we see a non-empty left rule
      }
      
      // Handle \sim - it's an abbreviation meaning "contains whatever the previous rule on the same side contains"
      // If \sim is on the right side (after \Rq), replace right side with previous rule's right side
      // If \sim is on the left side (before \Rq), replace left side with previous rule's left side
      let expandedRightSide = rightSide; // Track if right side was expanded
      if (hasSim) {
        // Check if \sim appears after \Rq (on right side)
        const simAfterRq = ruleMatch[0].includes('\\Rq') && ruleMatch[0].indexOf('\\sim') > ruleMatch[0].indexOf('\\Rq');
        
        if (simAfterRq && lastRuleRightSide) {
          // Expand right side with previous rule's right side
          rightSide = lastRuleRightSide;
          expandedRightSide = rightSide;
        } else if (!simAfterRq && lastRuleLeftSide) {
          // Expand left side with previous rule's left side
          leftSide = lastRuleLeftSide;
        }
      }
      
      // Clean up sides - remove leading/trailing commas, whitespace, and trailing backslashes
      leftSide = leftSide.replace(/^,\s*|,\s*$/g, '').replace(/\\+$/, '').trim();
      rightSide = rightSide.replace(/^,\s*|,\s*$/g, '').replace(/\\+$/, '').trim();
      
      // Skip if both sides are empty or if this is clearly a proof step (single empty left in sequence that's after a proof block)
      if ((!leftSide && !rightSide) || (isEmptyLeft && hasProofBlock && emptyLeftRuleCount === 1)) {
        continue;
      }
      
      // Add back the commas at the beginning and end for consistency with axioms.ts format
      // Format: ', expression,'
      if (leftSide && leftSide.length > 0) {
        leftSide = ',' + leftSide + ',';
      } else {
        leftSide = ',';
      }
      
      if (rightSide && rightSide.length > 0) {
        rightSide = ',' + rightSide + ',';
      } else {
        rightSide = ',';
      }
      
      // Escape backslashes for TypeScript strings
      leftSide = leftSide.replace(/\\/g, '\\\\');
      rightSide = rightSide.replace(/\\/g, '\\\\');
      
      // Determine rule type (use seenProofBlock to check if section has proofs, not just current state)
      const ruleType = determineRuleType(currentChapter, currentSection, currentSubsection, seenProofBlock, filename);
      
      const category = mapToCategory(currentChapter, currentSection);
      const id = generateId(filePath, ruleIndex, leftSide, rightSide);
      const name = generateName(leftSide, rightSide, currentSection || currentChapter, currentSubsection);
      
      const rule = {
        id,
        name,
        type: ruleType,
        category,
        description: `${currentSection || currentChapter}${currentSubsection ? ' - ' + currentSubsection : ''}`,
        leftSide,
        rightSide,
        section: currentSection || undefined,
        subsection: currentSubsection || undefined,
      };
      
      rules.push(rule);
      ruleIndex++;
      
      // Update last rule's sides for \sim expansion (for next rule)
      // Store the cleaned but not yet escaped versions
      const originalLeftSide = ruleMatch[1] ? ruleMatch[1].trim().replace(/^,\s*|,\s*$/g, '') : '';
      const originalRightSide = ruleMatch[2] ? ruleMatch[2].trim().replace(/^,\s*|,\s*$/g, '') : '';
      
      // Update last rule's left side (for \sim on left side expansion)
      if (originalLeftSide && originalLeftSide.length > 0) {
        lastRuleLeftSide = ',' + originalLeftSide + ',';
      }
      
      // Update last rule's right side (for \sim on right side expansion)
      // Store the final right side (after expansion if \sim was used) before escaping
      // We need to store the version BEFORE escaping backslashes
      if (hasSim && ruleMatch[0].includes('\\Rq') && ruleMatch[0].indexOf('\\sim') > ruleMatch[0].indexOf('\\Rq')) {
        // Right side was expanded from previous rule (which was already stored), so just keep it
        // lastRuleRightSide already has the correct value
      } else {
        // Store the cleaned right side before escaping
        const cleanedRightSide = originalRightSide.trim().replace(/^,\s*|,\s*$/g, '');
        if (cleanedRightSide && cleanedRightSide.length > 0) {
          lastRuleRightSide = ',' + cleanedRightSide + ',';
        }
      }
    }
  }
  
  return rules;
}

// Main function
function main() {
  const theoremsDir = path.join(__dirname, '../src/data/theorems');
  const outputFile = path.join(__dirname, '../src/data/theorems.ts');
  
  // Get all .tex files
  const files = fs.readdirSync(theoremsDir)
    .filter(file => file.endsWith('.tex'))
    .map(file => path.join(theoremsDir, file));
  
  console.log(`Found ${files.length} theorem files`);
  
  const allRules = [];
  
  for (const file of files) {
    console.log(`Processing: ${path.basename(file)}`);
    const rules = parseLatexFile(file);
    console.log(`  Extracted ${rules.length} rules`);
    allRules.push(...rules);
  }
  
  console.log(`\nTotal rules extracted: ${allRules.length}`);
  
  // Generate TypeScript output
  const output = `// Auto-generated from LaTeX theorem files
// Run: npm run extract-theorems

export type RuleType = 'axiom' | 'definition' | 'theorem';
export type RuleCategory = 
  | 'operators' 
  | 'relationships' 
  | 'propositions' 
  | 'induction' 
  | 'arithmetic' 
  | 'logic';

export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  category: RuleCategory;
  description: string;
  leftSide: string;
  rightSide: string;
  section?: string;
  subsection?: string;
}

export const theorems: Rule[] = [
${allRules.map(rule => {
  const sectionStr = rule.section ? `    section: '${rule.section.replace(/'/g, "\\'")}',` : '';
  const subsectionStr = rule.subsection ? `    subsection: '${rule.subsection.replace(/'/g, "\\'")}',` : '';
  
  return `  {
    id: '${rule.id}',
    name: '${rule.name.replace(/'/g, "\\'")}',
    type: '${rule.type}',
    category: '${rule.category}',
    description: '${rule.description.replace(/'/g, "\\'")}',
    leftSide: '${rule.leftSide}',
    rightSide: '${rule.rightSide}',${sectionStr ? '\n' + sectionStr : ''}${subsectionStr ? '\n' + subsectionStr : ''}
  },`;
}).join('\n')}
];
`;
  
  fs.writeFileSync(outputFile, output, 'utf-8');
  console.log(`\nOutput written to: ${outputFile}`);
}

main();
