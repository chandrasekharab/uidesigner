/**
 * A2UIPreviewPanel
 *
 * Center + right panels of the Renderer Experience:
 *   - Center: live rendered output via the selected renderer adapter
 *   - Right:  event log and (when debug is on) component tree
 */
'use client';

import React, { memo } from 'react';
import type { A2UIRenderResult, A2UIEvent, A2UITheme } from '@/services/mockA2UI';
import type { RendererAdapter } from '@/services/rendererFactory';
import { cn } from '@/utils/cn';
import {
  Play,
  Zap,
  AlertTriangle,
  XCircle,
  Trash2,
  Info,
  ChevronRight,
} from 'lucide-react';

interface A2UIPreviewPanelProps {
  renderResult: A2UIRenderResult | null;
  parseError: string | null;
  adapter: RendererAdapter;
  theme: A2UITheme;
  debug: boolean;
  events: A2UIEvent[];
  onClearEvents: () => void;
  onRender: () => void;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const EVENT_COLORS: Record<string, string> = {
  click: 'text-blue-600 bg-blue-50',
  change: 'text-emerald-600 bg-emerald-50',
  focus: 'text-purple-600 bg-purple-50',
  blur: 'text-slate-500 bg-slate-50',
  submit: 'text-orange-600 bg-orange-50',
};

export const A2UIPreviewPanel = memo(function A2UIPreviewPanel({
  renderResult,
  parseError,
  adapter,
  theme,
  debug,
  events,
  onClearEvents,
  onRender,
}: A2UIPreviewPanelProps) {
  const isDark = theme === 'dark';

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Center: Rendered Output ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden border-r border-slate-200 dark:border-slate-700">
        {/* Sub-header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full text-white',
                adapter.badgeColor
              )}
            >
              {adapter.label}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{adapter.sdkVersion}</span>
            {debug && (
              <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                DEBUG
              </span>
            )}
          </div>
          <button
            onClick={onRender}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          >
            <Play size={11} />
            Re-render
          </button>
        </div>

        {/* Rendered area */}
        <div
          className={cn(
            'flex-1 overflow-y-auto p-6',
            isDark ? 'bg-gray-900' : 'bg-slate-50 dark:bg-slate-950'
          )}
        >
          {parseError ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg max-w-lg mx-auto">
              <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Schema Error</p>
                <p className="text-xs text-red-600 mt-1 font-mono">{parseError}</p>
              </div>
            </div>
          ) : !renderResult ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-3">
              <Zap size={32} className="opacity-30" />
              <p className="text-sm">Click Re-render to display the schema</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              {/* SDK banner */}
              <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <Zap size={10} />
                Rendered by {adapter.sdkName} · {renderResult.componentCount} component
                {renderResult.componentCount !== 1 ? 's' : ''}
                {renderResult.warnings.length > 0 && (
                  <span className="text-yellow-500 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    {renderResult.warnings.length} warning
                    {renderResult.warnings.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* SDK output */}
              {renderResult.elements}

              {/* Warnings */}
              {renderResult.warnings.length > 0 && (
                <div className="mt-4 space-y-1">
                  {renderResult.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2.5 py-1.5"
                    >
                      <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Event Log + Debug Tree ───────────────────────────────────── */}
      <div className="w-56 flex flex-col bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0">
        {/* Events header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Event Log</span>
          {events.length > 0 && (
            <button
              onClick={onClearEvents}
              title="Clear events"
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* Events list */}
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 dark:text-slate-500">
              <Info size={16} className="mb-1 opacity-40" />
              <p className="text-[11px]">Interact with the form</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600">to see events here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((ev, i) => (
                <div key={i} className="px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={cn(
                        'text-[9px] font-bold uppercase px-1 py-0.5 rounded',
                        EVENT_COLORS[ev.type] ?? 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-700'
                      )}
                    >
                      {ev.type}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono ml-auto">
                      {formatTime(ev.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium truncate">
                    {ev.label ?? ev.componentType}
                  </p>
                  {ev.value !== undefined && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      → {JSON.stringify(ev.value)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debug tree */}
        {debug && renderResult && renderResult.debugTree.length > 0 && (
          <>
            <div className="flex items-center gap-1 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
              <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
                Component Tree
              </span>
            </div>
            <div className="overflow-y-auto max-h-48 border-t border-blue-100">
              {renderResult.debugTree.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  style={{ paddingLeft: `${8 + node.depth * 12}px` }}
                >
                  {node.depth > 0 && (
                    <ChevronRight size={9} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  )}
                  <span className="text-[9px] font-mono font-bold text-blue-500 flex-shrink-0">
                    {node.type}
                  </span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate ml-1">{node.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
});
