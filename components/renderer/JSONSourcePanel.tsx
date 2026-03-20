/**
 * JSONSourcePanel
 *
 * Left panel in the Renderer Experience.
 * Lets the user pick between three JSON sources:
 *   - Canvas   : current builder canvas components
 *   - Transformed : JSON passed in from TransformationStudio ("Render in A2UI")
 *   - Custom   : free-text paste area
 *
 * Emits the current raw JSON string and parsed components up to the parent
 * via `onSchemaChange`.
 */
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { useBuilderStore } from '@/store/builderStore';
import { treeToJSON } from '@/utils/jsonEngine';
import { validateRawJSON } from '@/services/a2uiRenderer';
import { cn } from '@/utils/cn';
import {
  Layers,
  ArrowLeftRight,
  Code2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useResizePanel } from '@/utils/resizePanel';
import { ResizeHandle } from '@/components/ResizeHandle';

export type SourceType = 'canvas' | 'transformed' | 'custom';

interface JSONSourcePanelProps {
  sourceType: SourceType;
  onSourceChange: (type: SourceType) => void;
  customJSON: string;
  onCustomJSONChange: (val: string) => void;
  /** Called whenever the effective raw JSON changes */
  onRawJSONChange: (raw: string) => void;
}

const SOURCE_TABS: { id: SourceType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'canvas', label: 'Canvas', icon: <Layers size={12} />, color: 'text-indigo-600' },
  { id: 'transformed', label: 'Transformed', icon: <ArrowLeftRight size={12} />, color: 'text-orange-600' },
  { id: 'custom', label: 'Custom', icon: <Code2 size={12} />, color: 'text-emerald-600' },
];

export function JSONSourcePanel({
  sourceType,
  onSourceChange,
  customJSON,
  onCustomJSONChange,
  onRawJSONChange,
}: JSONSourcePanelProps) {
  const { width, handleProps } = useResizePanel({ initial: 256, direction: 'right' });
  const storeComponents = useBuilderStore((s) => s.components);
  const rendererJSON = useBuilderStore((s) => s.rendererJSON);

  // Compute effective raw JSON based on source
  const rawJSON =
    sourceType === 'canvas'
      ? treeToJSON(storeComponents)
      : sourceType === 'transformed'
      ? rendererJSON || '[]'
      : customJSON;

  // Notify parent on change
  const prevRaw = useRef('');
  useEffect(() => {
    if (rawJSON !== prevRaw.current) {
      prevRaw.current = rawJSON;
      onRawJSONChange(rawJSON);
    }
  }, [rawJSON, onRawJSONChange]);

  const validation = validateRawJSON(rawJSON);

  const handleCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onCustomJSONChange(e.target.value);
    },
    [onCustomJSONChange]
  );

  const formatCustom = useCallback(() => {
    try {
      onCustomJSONChange(JSON.stringify(JSON.parse(customJSON), null, 2));
    } catch {
      /* silently ignore parse errors */
    }
  }, [customJSON, onCustomJSONChange]);

  let componentCount = 0;
  try {
    const arr = JSON.parse(rawJSON);
    if (Array.isArray(arr)) componentCount = arr.length;
  } catch {
    /* ignore */
  }

  return (
    <div style={{ width }} className="relative flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0">
      <ResizeHandle handleProps={handleProps} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10" />
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          JSON Source
        </p>
      </div>

      {/* Source tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSourceChange(tab.id)}
            disabled={tab.id === 'transformed' && !rendererJSON}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
              sourceType === tab.id
                ? `bg-slate-50 dark:bg-slate-800 border-b-2 border-indigo-500 ${tab.color}`
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed'
            )}
            title={
              tab.id === 'transformed' && !rendererJSON
                ? 'No transformed schema yet — use TransformationStudio first'
                : undefined
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Validation status */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs flex-shrink-0 border-b',
          validation.valid
            ? validation.warnings.length > 0
              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
              : 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        )}
      >
        {validation.valid ? (
          validation.warnings.length > 0 ? (
            <AlertTriangle size={12} />
          ) : (
            <CheckCircle2 size={12} />
          )
        ) : (
          <XCircle size={12} />
        )}
        <span className="font-medium">
          {validation.valid
            ? `Valid · ${componentCount} root component${componentCount !== 1 ? 's' : ''}`
            : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`}
        </span>
        {validation.warnings.length > 0 && (
          <span className="ml-auto text-yellow-600">{validation.warnings.length}w</span>
        )}
      </div>

      {/* Errors / warnings list */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 space-y-1 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0 max-h-28 overflow-y-auto">
          {validation.errors.map((e, i) => (
            <p key={i} className="text-[10px] text-red-600 flex items-start gap-1">
              <XCircle size={9} className="mt-0.5 flex-shrink-0" />
              {e}
            </p>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={i} className="text-[10px] text-yellow-600 flex items-start gap-1">
              <AlertTriangle size={9} className="mt-0.5 flex-shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* JSON content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {sourceType === 'custom' ? (
          <>
            <div className="flex items-center justify-between px-2 py-1 bg-slate-800 flex-shrink-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                Paste JSON
              </span>
              <button
                onClick={formatCustom}
                title="Format JSON"
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw size={9} /> Format
              </button>
            </div>
            <textarea
              value={customJSON}
              onChange={handleCustomChange}
              spellCheck={false}
              className="flex-1 w-full p-2 bg-[#282c34] text-[11px] font-mono text-slate-100 resize-none outline-none overflow-y-auto leading-relaxed"
              placeholder={`[\n  {\n    "id": "...",\n    "type": "Container",\n    "props": {},\n    "children": []\n  }\n]`}
            />
          </>
        ) : (
          <>
            <div className="px-2 py-1 bg-slate-800 flex-shrink-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                {sourceType === 'canvas' ? 'Canvas JSON' : 'Transformed JSON'} · read-only
              </span>
            </div>
            <pre className="flex-1 overflow-y-auto p-2 bg-[#282c34] text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {rawJSON
                ? (() => { try { return JSON.stringify(JSON.parse(rawJSON), null, 2); } catch { return rawJSON; } })()
                : '[]'}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
