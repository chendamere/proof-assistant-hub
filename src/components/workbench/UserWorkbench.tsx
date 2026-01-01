import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { axioms, Rule } from '@/data/axioms';
import { usePanelContext } from '@/contexts/PanelContext';
import { 
  ChevronUp, 
  ChevronDown, 
  Download, 
  Upload, 
  FileText, 
  Trash2,
  Briefcase 
} from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';

interface ImportedRule {
  id: string;
  leftSide: string;
  rightSide: string;
  source: string;
}

const UserWorkbench: React.FC = () => {
  const { isRulesPanelOpen, isWorkbenchExpanded, setWorkbenchExpanded } = usePanelContext();
  const [contextRules, setContextRules] = useState<Rule[]>([]);
  const [importedRules, setImportedRules] = useState<ImportedRule[]>([]);
  const [delimiter, setDelimiter] = useState('---');
  const [isDragOver, setIsDragOver] = useState(false);

  // Parse rules from text content
  const parseRulesFromText = (content: string, filename: string): ImportedRule[] => {
    const rules: ImportedRule[] = [];
    
    // Pattern to match: leftSide ≡ rightSide or leftSide = rightSide
    const equivalencePatterns = [
      /([^\n≡=]+)\s*≡\s*([^\n]+)/g,
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

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    
    files.forEach(file => {
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
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle rule drop from RulesSidePanel
  const handleRuleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.id && data.leftSide && data.rightSide) {
          const existingRule = axioms.find(r => r.id === data.id);
          if (existingRule && !contextRules.find(r => r.id === existingRule.id)) {
            setContextRules(prev => [...prev, existingRule]);
          }
        }
      }
    } catch (err) {
      // Not a rule drop, might be a file
    }
  }, [contextRules]);

  // Download rules as txt
  const downloadRules = () => {
    const allRules = [
      ...contextRules.map(r => `${r.leftSide} ≡ ${r.rightSide}`),
      ...importedRules.map(r => `${r.leftSide} ≡ ${r.rightSide}`),
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

  // Clear all rules
  const clearAll = () => {
    setContextRules([]);
    setImportedRules([]);
  };

  const totalRules = contextRules.length + importedRules.length;

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
          <Briefcase className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">User Workbench</span>
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
          <div className="flex-1 border-r border-border flex flex-col">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                Context Rules ({contextRules.length})
              </span>
              {contextRules.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setContextRules([])}
                >
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div 
                className="p-3 space-y-2 min-h-full"
                onDrop={handleRuleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {contextRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <p>Drag rules here from the Rules Panel</p>
                  </div>
                ) : (
                  contextRules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="bg-card border border-border rounded p-2 flex items-center justify-between gap-2 group"
                    >
                      <div className="flex-1 flex items-center gap-2 text-xs overflow-x-auto">
                        <ExpressionRenderer expression={rule.leftSide} size={10} />
                        <span className="text-primary font-mono">≡</span>
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

          {/* Imported Rules / File Drop Section */}
          <div className="flex-1 border-r border-border flex flex-col">
            <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">
                Imported Rules ({importedRules.length})
              </span>
              {importedRules.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setImportedRules([])}
                >
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div 
                className={`p-3 space-y-2 min-h-full transition-colors ${
                  isDragOver ? 'bg-primary/10' : ''
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {importedRules.length === 0 ? (
                  <div 
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">
                      Drop .txt or .tex files here
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Rules will be extracted automatically
                    </p>
                  </div>
                ) : (
                  importedRules.map((rule) => (
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
                      <div className="font-mono text-xs text-foreground break-all">
                        {rule.leftSide} ≡ {rule.rightSide}
                      </div>
                    </div>
                  ))
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
