/**
 * Read induction axioms and induction proofs from the LaTeX sources.
 * The axiom of inference is not a library rule: it is a method with a base
 * case, an if-then induction step (\Ri is the arrow), and a conclusion
 * ,\Tc c_1, ⟺ ,\Tc c_2,. In that axiom, \Tt is the same hole as \Tc.
 *
 * Run: node scripts/extract-induction.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THEOREMS_DIR = path.join(__dirname, '..', 'src', 'data', 'theorems');
const OUT = path.join(__dirname, '..', 'public', 'induction-display.json');

function parseTheoremRule(line) {
  const startIdx = line.indexOf('\\[');
  const endIdx = line.lastIndexOf('\\]');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  const content = line.substring(startIdx + 2, endIdx);
  const match = content.match(/,\s*\\Rq(\s*\\sim)?\s*,/) || content.match(/\s+\\Rq(\s*\\sim)?\s*,/);
  if (!match) return null;
  const rqPos = content.indexOf(match[0]);
  let left = content.substring(0, rqPos).trim().replace(/^,\s*|,\s*$/g, '').trim();
  let right = content.substring(rqPos + match[0].length).trim().replace(/,\s*$/, '').trim();
  if (match[1]) right = right ? `\\sim, ${right}` : '\\sim';
  return { left, right };
}

function normalizeExpr(s) {
  s = s.replace(/\\\\+$/, '').replace(/\\+$/, '').trim();
  if (!s || s.length < 2) return '';
  if (!s.endsWith(',')) s = s + ',';
  if (!s.startsWith(',')) s = ',' + s;
  return s.replace(/\s+/g, ' ').trim();
}

function lastTopLevelJoin(text) {
  let depth = 0;
  let gap = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '(') depth++;
    else if ((c === '}' || c === ')') && depth > 0) depth--;
    if (depth === 0 && c === ',' && /^\s*,/.test(text.slice(i + 1))) gap = i;
  }
  if (gap < 0) return null;
  const head = text.slice(0, gap).replace(/,\s*$/, '').trim();
  const tail = text.slice(gap).replace(/^\s*,\s*,\s*/, '').trim();
  if (!head || !tail) return null;
  return { head, tail };
}

function extractProofSteps(accumulated) {
  const re = /\s*\\+Rq(\s*\\sim)?\s*,/g;
  const raw = [];
  let last = 0;
  let sim = false;
  let m;
  while ((m = re.exec(accumulated))) {
    raw.push({ text: accumulated.slice(last, m.index), sim });
    sim = Boolean(m[1]);
    last = m.index + m[0].length;
  }
  raw.push({ text: accumulated.slice(last), sim });
  const steps = [];
  for (let i = 0; i < raw.length; i++) {
    const part = raw[i];
    let text = part.text.replace(/^\s*\\+Rq\s*,?\s*/, '');
    if (raw[i + 1]?.sim) {
      const split = lastTopLevelJoin(text);
      if (split) {
        const head = normalizeExpr(split.head);
        if (head && head.length > 2) steps.push(head);
        text = split.tail;
      }
    }
    if (part.sim) text = text ? `\\sim, ${text}` : '\\sim';
    const expr = normalizeExpr(text.replace(/\\Ri\b/g, '').trim());
    if (expr && expr.length > 2 && !/^,\s*,$/.test(expr)) steps.push(expr);
  }
  return steps.filter((expr) => expr && expr.length > 2);
}

function cleanJoin(lines) {
  return lines
    .map((l) => l.replace(/\\+\s*$/, '').trim())
    .filter((l) => l && !/^\\(begin|end)\{/.test(l))
    .join(' ');
}

function splitEq(text) {
  const src = text.replace(/\\Ri\b/g, '').trim();
  const m = src.match(/\s*\\+Rq\s*,?/);
  if (!m || m.index == null) {
    const only = normalizeExpr(src);
    return only ? { left: only, right: '' } : null;
  }
  const left = normalizeExpr(src.slice(0, m.index));
  const right = normalizeExpr(src.slice(m.index + m[0].length));
  if (!left && !right) return null;
  return { left, right };
}

function labelOf(line) {
  const t = line.trim();
  if (/^premise\s*(?:\\;)?\s*1\b/i.test(t)) return 'base';
  if (/^premise\s*(?:\\;)?\s*2\b/i.test(t)) return 'step';
  if (/^conclusion\b/i.test(t)) return 'conclusion';
  return null;
}

function parseInductionBody(lines) {
  const buckets = { base: [], step: [], conclusion: [] };
  let current = null;
  for (const line of lines) {
    const label = labelOf(line);
    if (label) {
      current = label;
      continue;
    }
    if (current) buckets[current].push(line);
  }
  const stepText = cleanJoin(buckets.step);
  const ri = stepText.search(/\\Ri\b/);
  let hypothesis = null;
  let thenSteps = [];
  if (ri >= 0) {
    hypothesis = splitEq(stepText.slice(0, ri));
    thenSteps = extractProofSteps(stepText.slice(ri + 3));
  } else if (stepText.trim()) {
    thenSteps = extractProofSteps(stepText);
  }
  return {
    base: extractProofSteps(cleanJoin(buckets.base)),
    hypothesis,
    then: thenSteps,
    conclusion: splitEq(cleanJoin(buckets.conclusion)),
  };
}

function parseSchemaPart(subsection, lines) {
  const text = cleanJoin(lines);
  const name = subsection.toLowerCase();
  if (/premise\s*1/.test(name) || /premise\s*(?:\\;)?\s*1/.test(text) && !/\\Ri/.test(text) && /premise/.test(name)) {
    return { kind: 'base', eq: splitEq(text) };
  }
  if (/^premise\s*1/i.test(subsection)) return { kind: 'base', eq: splitEq(text) };
  if (/^premise\s*2/i.test(subsection)) {
    const ri = text.search(/\\Ri\b/);
    if (ri < 0) return { kind: 'step', hypothesis: splitEq(text), then: null };
    return {
      kind: 'step',
      hypothesis: splitEq(text.slice(0, ri)),
      then: splitEq(text.slice(ri + 3)),
    };
  }
  if (/^conclusion/i.test(subsection)) return { kind: 'conclusion', eq: splitEq(text) };
  return null;
}

function parseFile(filePath) {
  const filename = path.basename(filePath, '.tex');
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let ruleIndex = 0;
  let lastRule = null;
  let section = '';
  let subsection = '';
  let inMath = false;
  let mathLines = [];
  let pendingInduction = false;
  let schema = null;
  const proofs = {};
  const schemas = [];

  const flushSchema = () => {
    if (!schema) return;
    if (schema.base && schema.stepIf && schema.stepThen && schema.conclusion) schemas.push(schema);
    schema = null;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!inMath) {
      const sectionMatch = trimmed.match(/\\section\{([^}]+)\}/);
      if (sectionMatch) {
        flushSchema();
        section = sectionMatch[1];
        subsection = '';
      }
      const subsectionMatch = trimmed.match(/\\subsection\{([^}]+)\}/);
      if (subsectionMatch) {
        subsection = subsectionMatch[1];
        if (/^axiom of /i.test(section) && !schema) {
          schema = {
            filename,
            title: section,
            base: null,
            stepIf: null,
            stepThen: null,
            conclusion: null,
          };
        }
      }
      if (/induction\s*(?:\\;\s*)*proof/i.test(trimmed)) pendingInduction = true;
    }

    if (trimmed.includes('\\begin{math}')) {
      inMath = true;
      mathLines = [];
      continue;
    }
    if (inMath && trimmed.includes('\\end{math}')) {
      inMath = false;
      if (pendingInduction && lastRule) {
        const body = parseInductionBody(mathLines);
        const key = `${filename}::${lastRule.index}::${lastRule.ruleStr}`;
        if (!proofs[key]) proofs[key] = [];
        proofs[key].push(body);
        pendingInduction = false;
      } else if (/axiom of inference/i.test(subsection) || /^(premise|conclusion)/i.test(subsection)) {
        const part = parseSchemaPart(subsection, mathLines);
        if (schema && part?.kind === 'base' && part.eq) schema.base = part.eq;
        if (schema && part?.kind === 'step') {
          schema.stepIf = part.hypothesis;
          schema.stepThen = part.then;
        }
        if (schema && part?.kind === 'conclusion' && part.eq) schema.conclusion = part.eq;
      }
      mathLines = [];
      continue;
    }
    if (inMath) {
      mathLines.push(raw);
      continue;
    }

    const rule = parseTheoremRule(trimmed);
    if (rule) {
      ruleIndex += 1;
      lastRule = {
        index: ruleIndex,
        ruleStr: `, ${rule.left}, ⟺ , ${rule.right},`,
      };
      pendingInduction = false;
    }
  }
  flushSchema();
  return { proofs, schemas };
}

function main() {
  const files = fs.readdirSync(THEOREMS_DIR).filter((f) => f.endsWith('.tex'));
  const proofs = {};
  const schemas = [];
  for (const file of files) {
    const parsed = parseFile(path.join(THEOREMS_DIR, file));
    Object.assign(proofs, parsed.proofs);
    schemas.push(...parsed.schemas);
  }
  const payload = {
    note: 'Axiom of inference is a proof method, not a library rule. \\Tt in that axiom is the same hole as \\Tc. \\Ri is the if-then arrow of the induction step.',
    schemas,
    proofs,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8');
  const proofCount = Object.keys(proofs).length;
  const withHyp = Object.values(proofs).flat().filter((p) => p.hypothesis && p.hypothesis.right).length;
  console.log(`schemas=${schemas.length} theoremsWithInduction=${proofCount} proofs=${Object.values(proofs).flat().length} withHypothesis=${withHyp}`);
  console.log(`wrote ${OUT}`);
}

main();
