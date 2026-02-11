/**
 * Workbench container: fixed bottom panel with Debug tab only.
 * Height is adjustable by dragging the top edge.
 */

import React, { useCallback, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Bug, PanelRightOpen, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePanelContext } from '@/contexts/PanelContext';
import DebugWorkbench from './DebugWorkbench';

const MIN_HEIGHT = 48; // collapsed header
const DEFAULT_HEIGHT = 360;
const MAX_HEIGHT_RATIO = 0.8;

const WorkbenchContainer: React.FC = () => {
  const {
    isWorkbenchExpanded,
    setWorkbenchExpanded,
    isRulesPanelOpen,
    setRulesPanelOpen,
  } = usePanelContext();

  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = panelHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panelHeight]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    const maxH = window.innerHeight * MAX_HEIGHT_RATIO;
    const newH = Math.max(120, Math.min(maxH, startH.current + delta));
    setPanelHeight(newH);
    if (!isWorkbenchExpanded && newH > MIN_HEIGHT + 20) {
      setWorkbenchExpanded(true);
    }
  }, [isWorkbenchExpanded, setWorkbenchExpanded]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 bg-background border-t border-border shadow-lg z-30 flex flex-col"
      style={{
        right: isRulesPanelOpen ? '380px' : '0',
        height: isWorkbenchExpanded ? `${panelHeight}px` : `${MIN_HEIGHT}px`,
        transition: dragging.current ? 'none' : 'height 0.3s ease-in-out',
      }}
    >
      {/* Drag handle */}
      {isWorkbenchExpanded && (
        <div
          className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize flex items-center justify-center z-40 group"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="w-12 h-1 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
        </div>
      )}

      {/* Header */}
      <div
        className="h-12 px-4 flex items-center justify-between border-b border-border cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
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
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Bug className="w-3.5 h-3.5" />
            Debug
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Visual hint when collapsed */}
          {!isWorkbenchExpanded && (
            <span className="text-xs text-muted-foreground/70 hidden sm:inline animate-pulse">
              Click to open debug panel
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isWorkbenchExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Content */}
      <DebugWorkbench embedded />
    </div>
  );
};

export default WorkbenchContainer;
