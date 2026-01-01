import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Operator patterns for highlighting
const operatorPatterns = [
  // Negated relationship operators (must come before regular ones)
  { pattern: /\\nPne/g, className: 'text-rose-400' },
  { pattern: /\\nPnl/g, className: 'text-rose-400' },
  { pattern: /\\nPnm/g, className: 'text-rose-400' },
  { pattern: /\\nPb/g, className: 'text-rose-400' },
  { pattern: /\\nPc/g, className: 'text-rose-400' },
  { pattern: /\\nPe/g, className: 'text-rose-400' },
  { pattern: /\\nPn/g, className: 'text-rose-400' },
  { pattern: /\\nPp/g, className: 'text-rose-400' },
  { pattern: /\\nPs/g, className: 'text-rose-400' },
  { pattern: /\\nPu/g, className: 'text-rose-400' },
  
  // Relationship operators (P)
  { pattern: /\\Pne/g, className: 'text-cyan-400' },
  { pattern: /\\Pnl/g, className: 'text-cyan-400' },
  { pattern: /\\Pnm/g, className: 'text-cyan-400' },
  { pattern: /\\Pb/g, className: 'text-cyan-400' },
  { pattern: /\\Pc/g, className: 'text-cyan-400' },
  { pattern: /\\Pe/g, className: 'text-cyan-400' },
  { pattern: /\\Pn/g, className: 'text-cyan-400' },
  { pattern: /\\Pp/g, className: 'text-cyan-400' },
  { pattern: /\\Ps/g, className: 'text-cyan-400' },
  { pattern: /\\Pu/g, className: 'text-cyan-400' },
  
  // Binary operators (O)
  { pattern: /\\Oa/g, className: 'text-amber-400' },
  { pattern: /\\Ob/g, className: 'text-amber-400' },
  { pattern: /\\Oc/g, className: 'text-amber-400' },
  { pattern: /\\Od/g, className: 'text-amber-400' },
  { pattern: /\\Oe/g, className: 'text-amber-400' },
  
  // Unary operators
  { pattern: /\\Og/g, className: 'text-emerald-400' },
  { pattern: /\\Ot/g, className: 'text-emerald-400' },
  { pattern: /\\On/g, className: 'text-violet-400' },
  { pattern: /\\Op/g, className: 'text-violet-400' },
  { pattern: /\\Os/g, className: 'text-emerald-400' },
  { pattern: /\\Or/g, className: 'text-red-500' },
  { pattern: /\\Tc/g, className: 'text-emerald-400' },
  { pattern: /\\Tt/g, className: 'text-emerald-400' },
  
  // Branch operators
  { pattern: /\\Bb/g, className: 'text-pink-400' },
  { pattern: /\\Blb/g, className: 'text-pink-400' },
  { pattern: /\\Br/g, className: 'text-pink-400' },
  
  // Functions
  { pattern: /R\([^)]*\)/g, className: 'text-blue-400' },
  { pattern: /Rc\([^)]*\)/g, className: 'text-blue-400' },
  { pattern: /Rcpo\([^)]*\)/g, className: 'text-blue-400' },
  { pattern: /Rcpm\([^)]*\)/g, className: 'text-blue-400' },
];

// Special character highlighting
const specialPatterns = [
  { pattern: /,/g, className: 'text-muted-foreground' },
  { pattern: /:/g, className: 'text-orange-400' },
  { pattern: /\+/g, className: 'text-green-400' },
  { pattern: /\*/g, className: 'text-green-400' },
];

interface SyntaxInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  isActive?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const highlightSyntax = (text: string): string => {
  if (!text) return '';
  
  let result = escapeHtml(text);
  
  // Create a map to track replacements
  const replacements: { start: number; end: number; replacement: string }[] = [];
  
  // Find all operator matches
  [...operatorPatterns, ...specialPatterns].forEach(({ pattern, className }) => {
    const regex = new RegExp(pattern.source, 'g');
    let match;
    while ((match = regex.exec(result)) !== null) {
      // Check if this position overlaps with existing replacement
      const overlaps = replacements.some(
        r => (match!.index >= r.start && match!.index < r.end) ||
             (match!.index + match![0].length > r.start && match!.index + match![0].length <= r.end)
      );
      
      if (!overlaps) {
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          replacement: `<span class="${className}">${match[0]}</span>`,
        });
      }
    }
  });
  
  // Sort by position (reverse order to replace from end to start)
  replacements.sort((a, b) => b.start - a.start);
  
  // Apply replacements
  replacements.forEach(({ start, end, replacement }) => {
    result = result.slice(0, start) + replacement + result.slice(end);
  });
  
  // Replace newlines with <br> for proper display
  result = result.replace(/\n/g, '<br>');
  
  return result;
};

export const SyntaxInput: React.FC<SyntaxInputProps> = ({
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  className,
  isActive,
  textareaRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Highlighted background layer */}
      <div
        ref={highlightRef}
        className={cn(
          "absolute inset-0 overflow-hidden pointer-events-none",
          "font-mono text-sm p-3 whitespace-pre-wrap break-words",
          "bg-muted/50 rounded-md border border-border"
        )}
        style={{ 
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ 
          __html: highlightSyntax(value) || `<span class="text-muted-foreground">${placeholder || ''}</span>` 
        }}
      />
      
      {/* Transparent textarea on top */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onScroll={handleScroll}
        placeholder=""
        className={cn(
          "relative w-full min-h-[80px] resize-none",
          "font-mono text-sm p-3",
          "bg-transparent text-transparent caret-foreground",
          "rounded-md border border-transparent",
          "focus:outline-none",
          isActive && "ring-2 ring-primary/50"
        )}
        style={{ 
          lineHeight: '1.5',
          WebkitTextFillColor: 'transparent',
        }}
        spellCheck={false}
      />
    </div>
  );
};

export default SyntaxInput;
