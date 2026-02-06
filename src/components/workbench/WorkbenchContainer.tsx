/**
 * Workbench container: fixed bottom panel with Workbench | Debug tabs.
 * Renders UserWorkbench or DebugWorkbench based on active tab.
 */

import React from 'react';
import { ChevronUp, ChevronDown, Briefcase, Bug, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePanelContext } from '@/contexts/PanelContext';
import UserWorkbench from './UserWorkbench';
import DebugWorkbench from './DebugWorkbench';

const WorkbenchContainer: React.FC = () => {
  const {
    isWorkbenchExpanded,
    setWorkbenchExpanded,
    workbenchTab,
    setWorkbenchTab,
    isRulesPanelOpen,
    setRulesPanelOpen,
  } = usePanelContext();

  return (
    <div
      className={`fixed bottom-0 left-0 bg-background border-t border-border shadow-lg z-30 transition-all duration-300 ease-in-out ${
        isWorkbenchExpanded ? 'h-[50vh]' : 'h-12'
      }`}
      style={{ right: isRulesPanelOpen ? '380px' : '0' }}
    >
      {/* Header with tabs */}
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
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWorkbenchTab('debug');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                workbenchTab === 'debug' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              Debug
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWorkbenchTab('workbench');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                workbenchTab === 'workbench'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Workbench
            </button>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          {isWorkbenchExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content: only one workbench is mounted based on tab */}
      {workbenchTab === 'debug' ? (
        <DebugWorkbench embedded />
      ) : (
        <UserWorkbench embedded />
      )}
    </div>
  );
};

export default WorkbenchContainer;
