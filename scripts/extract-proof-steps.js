/**
 * Extract proof-step expressions from LaTeX theorem files.
 * Identifies theorems by \[, left, \Rq , right,\] and proof steps as expressions
 * on their own line (sometimes with \Rq). Outputs a table: theorem -> [proof steps].
 * Run: node scripts/extract-proof-steps.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THEOREMS_DIR = path.join(__dirname, '..', 'src', 'data', 'theorems');
const AXIOMS_FILE = path.join(__dirname, '..', 'src', 'data', 'axioms.tex');
const RELATIONSHIPS_FILE = path.join(__dirname, '..', 'src', 'data', 'relationships.tex');

/** Extract rule content from \[...\] line. Returns { left, right } or null. */
function parseTheoremRule(line) {
  const startIdx = line.indexOf('\\[');
  const endIdx = line.lastIndexOf('\\]');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  const content = line.substring(startIdx + 2, endIdx);
  const rqMatch = content.match(/,\s*\\Rq(?:\s*\\sim)?\s*,/);
  if (!rqMatch) {
    const alt = content.match(/\s+\\Rq(?:\s*\\sim)?\s*,/);
    if (!alt) return null;
  }
  const match = content.match(/,\s*\\Rq(?:\s*\\sim)?\s*,/) || content.match(/\s+\\Rq(?:\s*\\sim)?\s*,/);
  if (!match) return null;

  const rqPos = content.indexOf(match[0]);
  let left = content.substring(0, rqPos).trim().replace(/^,\s*|,\s*$/g, '').trim();
  let right = content.substring(rqPos + match[0].length).trim().replace(/,\s*$/, '').trim();
  return { left, right };
}

/** Check if a line looks like a proof-step expression (comma-led, has operators). */
function isProofStepLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return false;
  if (/^(premise|conclusion|induction)\s*(\\;|\s)/i.test(trimmed)) return false;
  if (/^\\Ri\s*$/.test(trimmed)) return false;
  const hasOperator = /\\[A-Z][a-z]*/.test(trimmed);
  const hasCommaOrRq = /^[,\s]*\\?Rq\s*,|^,/.test(trimmed) || trimmed.includes(',');
  return hasOperator && (hasCommaOrRq || trimmed.startsWith(','));
}

/** Extract and normalize a single expression. */
function normalizeExpr(s) {
  s = s.replace(/\\\\+$/, '').replace(/\\+$/, '').trim();
  if (!s || s.length < 2) return '';
  if (!s.endsWith(',')) s = s + ',';
  if (!s.startsWith(',')) s = ',' + s;
  return s.replace(/\s+/g, ' ').trim();
}

/** Split accumulated text by \Rq (or \\Rq etc) into individual proof steps, normalize each. */
function extractProofSteps(accumulated) {
  const steps = [];
  const parts = accumulated.split(/\s*\\+Rq\s*,/);
  for (const p of parts) {
    const expr = normalizeExpr(p.replace(/^\s*\\+Rq\s*,?\s*/, ''));
    if (expr && expr.length > 2) steps.push(expr);
  }
  return steps;
}

/** Parse a LaTeX file and extract theorems with their proof steps. */
function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath, '.tex');
  const lines = content.split('\n');

  const result = [];
  let currentChapter = '';
  let currentSection = '';
  let currentSubsection = '';
  let lastTheorem = null;
  let inProofBlock = false;
  let proofBlockStart = -1;
  let pendingStep = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const chapterMatch = trimmed.match(/\\chapter\{([^}]+)\}/);
    if (chapterMatch) {
      currentChapter = chapterMatch[1];
      currentSection = '';
      currentSubsection = '';
    }
    const sectionMatch = trimmed.match(/\\section\{([^}]+)\}/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentSubsection = '';
    }
    const subsectionMatch = trimmed.match(/\\subsection\{([^}]+)\}/);
    if (subsectionMatch) currentSubsection = subsectionMatch[1];

    if (trimmed.includes('\\begin{math}')) {
      inProofBlock = true;
      proofBlockStart = i;
      continue;
    }

    if (inProofBlock && trimmed.includes('\\end{math}')) {
      inProofBlock = false;
      if (pendingStep && lastTheorem) {
        for (const expr of extractProofSteps(pendingStep)) lastTheorem.steps.push(expr);
      }
      pendingStep = '';
      lastTheorem = null;
      continue;
    }

    if (inProofBlock) {
      if (isProofStepLine(line) || (pendingStep && line.match(/^\s*,?\s*[\w\s\\{}();,]+/))) {
        const continues = /\\\\\s*$/.test(line) || /\\\s*$/.test(line);
        const stepPart = line.replace(/\\\\\s*$/, '').replace(/\\\s*$/, '').trim();
        if (stepPart && !/^(premise|conclusion)\s*[\\;:]?/i.test(stepPart)) {
          if (pendingStep) {
            pendingStep += ' ' + stepPart;
          } else {
            pendingStep = stepPart;
          }
          if (!continues) {
            if (lastTheorem) for (const expr of extractProofSteps(pendingStep)) lastTheorem.steps.push(expr);
            pendingStep = '';
          }
        }
      } else {
        if (pendingStep && lastTheorem) for (const expr of extractProofSteps(pendingStep)) lastTheorem.steps.push(expr);
        pendingStep = '';
      }
      continue;
    }

    const rule = parseTheoremRule(line);
    if (rule) {
      if (pendingStep && lastTheorem) for (const expr of extractProofSteps(pendingStep)) lastTheorem.steps.push(expr);
      pendingStep = '';

      const key = [filename, currentChapter, currentSection, currentSubsection]
        .filter(Boolean)
        .join(' | ');
      const theoremEntry = {
        key: key || filename,
        filename,
        chapter: currentChapter,
        section: currentSection,
        subsection: currentSubsection,
        left: rule.left,
        right: rule.right,
        ruleStr: `, ${rule.left}, ⟺ , ${rule.right},`,
        steps: [],
      };
      result.push(theoremEntry);
      lastTheorem = theoremEntry;
    } else {
      if (!inProofBlock && (trimmed.includes('induction') || trimmed.includes('proof:'))) {
        lastTheorem = result.length > 0 ? result[result.length - 1] : null;
      }
    }
  }

  return result;
}

/** Build theorem -> proof steps table. Includes all theorems (empty array if no proof). */
function buildProofStepsTable(filePaths) {
  const table = {};
  const allTheorems = [];

  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const theorems = parseFile(filePath);
    theorems.forEach((t, idx) => {
      const baseKey = t.ruleStr || `, ${t.left}, ⟺ , ${t.right},`;
      const key = `${t.filename}::${idx}::${baseKey}`;
      table[key] = t.steps;
      allTheorems.push({ ...t, tableKey: key });
    });
  }

  return { table, allTheorems };
}

function main() {
  const texFiles = fs.readdirSync(THEOREMS_DIR)
    .filter((f) => f.endsWith('.tex'))
    .map((f) => path.join(THEOREMS_DIR, f));

  const extra = [AXIOMS_FILE, RELATIONSHIPS_FILE].filter((p) => fs.existsSync(p));
  const allPaths = [...texFiles, ...extra];

  const { table, allTheorems } = buildProofStepsTable(allPaths);

  const withSteps = allTheorems.filter((t) => t.steps.length > 0);
  const withoutSteps = allTheorems.filter((t) => t.steps.length === 0);

  console.log('=== PROOF STEPS TABLE (theorem -> proof step expressions) ===\n');
  console.log(JSON.stringify(table, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Theorems with proof steps: ${withSteps.length}`);
  console.log(`Theorems without proof steps: ${withoutSteps.length}`);
  console.log(`Total theorems in table: ${Object.keys(table).length}`);

  const outPath = path.join(__dirname, '..', 'proof-steps-table.json');
  const publicPath = path.join(__dirname, '..', 'public', 'proof-steps-table.json');
  const json = JSON.stringify(table, null, 2);
  fs.writeFileSync(outPath, json, 'utf-8');
  fs.writeFileSync(publicPath, json, 'utf-8');
  console.log(`\nTable written to ${outPath} and ${publicPath}`);
}

main();
