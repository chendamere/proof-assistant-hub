import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { axioms, Rule, RuleType, RuleCategory } from '@/data/axioms';
import { usePanelContext } from '@/contexts/PanelContext';
import { 
  ChevronUp, 
  ChevronDown, 
  Download, 
  Upload, 
  FileText, 
  Trash2,
  Briefcase,
  PanelRightOpen,
  Search,
  ArrowRight
} from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';

interface ImportedRule {
  id: string;
  leftSide: string;
  rightSide: string;
  source: string;
}

const UserWorkbench: React.FC = () => {
  const { isRulesPanelOpen, setRulesPanelOpen, isWorkbenchExpanded, setWorkbenchExpanded } = usePanelContext();
  const [contextRules, setContextRules] = useState<Rule[]>([]);
  const [importedRules, setImportedRules] = useState<ImportedRule[]>([]);
  const [delimiter, setDelimiter] = useState('---');
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextRulesSearch, setContextRulesSearch] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Parse rules from text content
  const parseRulesFromText = (content: string, filename: string): ImportedRule[] => {
    const rules: ImportedRule[] = [];
    
    // Pattern to match: leftSide \\Rq rightSide or leftSide = rightSide
    const equivalencePatterns = [
      /([^\n\\Rq=]+)\s*\\Rq\s*([^\n]+)/g,
      /([^\n]+)\s*\\equiv\s*([^\n]+)/g,
    ];

    for (const pattern of equivalencePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const leftSide = match[1].trim();
        const rightSide = match[2].trim();
        if (leftSide && rightSide) {
          rules.push({
            id: `imported-${Date.now()}-${rules.length}`,
            leftSide,
            rightSide,
            source: filename,
          });
        }
      }
    }

    return rules;
  };

  // Handle file selection from file input
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.name.endsWith('.txt') || file.name.endsWith('.tex') || file.name.endsWith('.latex')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const parsedRules = parseRulesFromText(content, file.name);
          setImportedRules(prev => [...prev, ...parsedRules]);
        };
        reader.readAsText(file);
      }
    });

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Open file picker
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're actually leaving the target area (not just moving to a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  // Handle rule drop from RulesSidePanel
  const handleRuleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.id && data.leftSide && data.rightSide) {
          const existingRule = axioms.find(r => r.id === data.id);
          if (existingRule) {
            setContextRules(prev => {
              // Check if rule already exists to avoid duplicates
              if (prev.find(r => r.id === existingRule.id)) {
                return prev;
              }
              return [...prev, existingRule];
            });
          }
        }
      }
    } catch (err) {
      // Not a rule drop, might be a file
      console.error('Failed to parse dropped data:', err);
    }
  }, []);

  // Download rules as txt
  const downloadRules = () => {
    const allRules = [
      ...contextRules.map(r => `${r.leftSide} \\Rq ${r.rightSide}`),
      ...importedRules.map(r => `${r.leftSide} \\Rq ${r.rightSide}`),
    ];
    
    const content = allRules.join(`\n${delimiter}\n`);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-rules.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Remove a context rule
  const removeContextRule = (id: string) => {
    setContextRules(prev => prev.filter(r => r.id !== id));
  };

  // Remove an imported rule
  const removeImportedRule = (id: string) => {
    setImportedRules(prev => prev.filter(r => r.id !== id));
  };

  // Add all imported rules to context rules and clear imported rules
  const addAllImportedToContext = useCallback(() => {
    const newContextRules: Rule[] = importedRules.map((importedRule) => {
      // Convert ImportedRule to Rule format
      return {
        id: `imported-context-${importedRule.id}`,
        name: `Imported: ${importedRule.leftSide} \\Rq ${importedRule.rightSide}`,
        type: 'definition' as RuleType,
        category: 'logic' as RuleCategory,
        description: `Imported rule from ${importedRule.source}`,
        leftSide: importedRule.leftSide,
        rightSide: importedRule.rightSide,
      };
    });

    // Add to context rules, avoiding duplicates based on leftSide and rightSide
    setContextRules(prev => {
      const existingPairs = new Set(
        prev.map(r => `${r.leftSide}\\Rq${r.rightSide}`)
      );
      const uniqueNewRules = newContextRules.filter(
        r => !existingPairs.has(`${r.leftSide}\\Rq${r.rightSide}`)
      );
      return [...prev, ...uniqueNewRules];
    });

    // Clear imported rules
    setImportedRules([]);
  }, [importedRules]);

  // Clear all rules
  const clearAll = () => {
    setContextRules([]);
    setImportedRules([]);
  };

  const totalRules = contextRules.length + importedRules.length;

  // Filter context rules based on search query
  const filteredContextRules = React.useMemo(() => {
    if (!contextRulesSearch.trim()) {
      return contextRules;
    }
    const searchLower = contextRulesSearch.toLowerCase();
    return contextRules.filter(rule => 
      rule.name.toLowerCase().includes(searchLower) ||
      rule.leftSide.toLowerCase().includes(searchLower) ||
      rule.rightSide.toLowerCase().includes(searchLower) ||
      rule.description?.toLowerCase().includes(searchLower) ||
      rule.type.toLowerCase().includes(searchLower)
    );
  }, [contextRules, contextRulesSearch]);

  return (
    <div 
      className={`fixed bottom-0 left-0 bg-background border-t border-border shadow-lg z-30 transition-all duration-300 ease-in-out ${
        isWorkbenchExpanded ? 'h-80' : 'h-12'
      }`}
      style={{
        right: isRulesPanelOpen ? '380px' : '0',
      }}
    >
      {/* Header / Toggle Bar */}
      <div 
        className="h-12 px-4 flex items-center justify-between border-b border-border cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setWorkbenchExpanded(!isWorkbenchExpanded)}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={(e) => {
              e.stopPropagation();
              setRulesPanelOpen(!isRulesPanelOpen);
            }}
          >
            <PanelRightOpen className="w-4 h-4" />
            Rules
          </Button>
          <div className="h-6 w-px bg-border" />
          <Briefcase className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Workbench</span>
          {totalRules > 0 && (
            <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-mono">
              {totalRules} rules
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isWorkbenchExpanded && totalRules > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                downloadRules();
              }}
            >
              <Download className="w-3 h-3" />
              Export
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isWorkbenchExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Workbench Content */}
      {isWorkbenchExpanded && (
        <div className="h-[calc(100%-3rem)] flex">
          {/* Context Rules Section */}
          <div 
            className={`flex-1 border-r border-border flex flex-col transition-colors ${
              isDragOver ? 'bg-primary/10 border-primary border-2' : ''
            }`}
            onDrop={handleRuleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={`px-4 py-2 border-b border-border flex items-center justify-between bg-muted/30 ${
              isDragOver ? 'border-primary' : ''
            }`}>
              <span className="text-xs font-medium text-muted-foreground">
                Context Rules ({contextRules.length})
              </span>
              {contextRules.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextRules([]);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            {/* Search Input */}
            {contextRules.length > 0 && (
              <div className="px-3 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search context rules..."
                    value={contextRulesSearch}
                    onChange={(e) => setContextRulesSearch(e.target.value)}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2 min-h-full">
                {contextRules.length === 0 ? (
                  <div className={`text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-colors ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-transparent'
                  }`}>
                    <p>Drag rules here from the Rules Panel</p>
                  </div>
                ) : filteredContextRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <p>No rules match your search</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  filteredContextRules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="bg-card border border-border rounded p-2 flex items-center justify-between gap-2 group"
                    >
                      <div className="flex-1 flex items-center gap-2 text-xs overflow-x-auto">
                        <ExpressionRenderer expression={rule.leftSide} size={10} />
                        <EquivalenceSymbol size={10} />
                        <ExpressionRenderer expression={rule.rightSide} size={10} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => removeContextRule(rule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Imported Rules / File Selection Section */}
          <div className="flex-1 border-r border-border flex flex-col">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                Imported Rules ({importedRules.length})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={handleImportClick}
                >
                  <Upload className="w-3 h-3" />
                  Import
                </Button>
                {importedRules.length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1 text-primary hover:text-primary"
                      onClick={addAllImportedToContext}
                    >
                      <ArrowRight className="w-3 h-3" />
                      Add All
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setImportedRules([])}
                    >
                      Clear
                    </Button>
                  </>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2 min-h-full">
                {importedRules.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-xs text-muted-foreground mb-2">
                      Import rules from files
                    </p>
                    <p className="text-xs text-muted-foreground/60 mb-4">
                      Select .txt or .tex files to extract rules
                    </p>
                    <Button
                      onClick={handleImportClick}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Select Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.tex,.latex"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <>
                    <div className="mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        onClick={handleImportClick}
                      >
                        <Upload className="w-3 h-3" />
                        Import More Files
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.tex,.latex"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                    {importedRules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="bg-card border border-border rounded p-2 group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-24">{rule.source}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => removeImportedRule(rule.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="font-mono text-xs text-foreground break-all flex items-center gap-1">
                        {rule.leftSide} <EquivalenceSymbol size={10} /> {rule.rightSide}
                      </div>
                    </div>
                  ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Export Settings Section */}
          <div className="w-64 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">Export Settings</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Rule Delimiter
                </label>
                <Input
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  placeholder="e.g. --- or ~~~"
                  className="h-8 text-xs font-mono"
                />
              </div>
              
              <Button 
                onClick={downloadRules}
                disabled={totalRules === 0}
                className="w-full gap-2"
                size="sm"
              >
                <Download className="w-4 h-4" />
                Download All Rules
              </Button>

              {totalRules > 0 && (
                <Button 
                  variant="outline"
                  onClick={clearAll}
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserWorkbench;
