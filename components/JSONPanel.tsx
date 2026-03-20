'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useBuilderStore } from '@/store/builderStore';
import { treeToJSON, jsonToTree } from '@/utils/jsonEngine';
import { cn } from '@/utils/cn';
import { Download, Upload, Copy, CheckCircle2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { useResizePanel } from '@/utils/resizePanel';
import { ResizeHandle } from '@/components/ResizeHandle';

// Lazy-load CodeMirror to avoid SSR issues and improve bundle splitting
const CodeMirrorEditor = dynamic(() => import('./CodeMirrorEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#282c34]">
      <span className="text-slate-400 text-sm">Loading editor…</span>
    </div>
  ),
});

// ─── JSON Panel ───────────────────────────────────────────────────────────────

export const JSONPanel = memo(function JSONPanel() {
  const { width, handleProps } = useResizePanel({ initial: 320, direction: 'left' });
  const components = useBuilderStore((s) => s.components);
  const setComponents = useBuilderStore((s) => s.setComponents);
  const setPendingTransformJSON = useBuilderStore((s) => s.setPendingTransformJSON);
  const setAppMode = useBuilderStore((s) => s.setAppMode);

  const liveJSON = useMemo(() => treeToJSON(components), [components]);

  const [editorValue, setEditorValue] = useState(liveJSON);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Keep editor in sync with canvas when not user-editing
  useEffect(() => {
    if (!isEditing) {
      setEditorValue(liveJSON);
      setError(null);
    }
  }, [liveJSON, isEditing]);

  const handleChange = useCallback((value: string) => {
    setEditorValue(value);
    setIsEditing(true);
    setError(null);

    try {
      const tree = jsonToTree(value);
      setComponents(tree);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setComponents]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSendToTransform = useCallback(() => {
    if (components.length === 0) return;
    setPendingTransformJSON(liveJSON);
    setAppMode('transform');
  }, [liveJSON, components.length, setPendingTransformJSON, setAppMode]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(liveJSON);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [liveJSON]);

  const handleExport = useCallback(() => {
    const blob = new Blob([liveJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ui-schema.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [liveJSON]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        try {
          const tree = jsonToTree(text);
          setComponents(tree);
          setError(null);
        } catch (err) {
          setError((err as Error).message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setComponents]);

  return (
    <aside style={{ width }} className="relative flex-shrink-0 bg-[#282c34] flex flex-col border-l border-slate-700">
      <ResizeHandle handleProps={handleProps} className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize z-10" />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            JSON Schema
          </h2>
          {error ? (
            <span className="flex items-center gap-1 text-red-400 text-[10px]">
              <AlertCircle size={10} /> Invalid
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-400" title="Valid JSON" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleSendToTransform}
            disabled={components.length === 0}
            title="Send schema to Transform Studio"
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold text-orange-400 hover:bg-orange-900/40 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-orange-800/50 mr-1"
          >
            <ArrowLeftRight size={11} />
            Transform
          </button>
          <button
            onClick={handleCopy}
            title="Copy JSON"
            aria-label="Copy JSON to clipboard"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <button
            onClick={handleExport}
            title="Export JSON file"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleImport}
            title="Import JSON file"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Upload size={14} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-3 py-2 bg-red-900/40 border-b border-red-800">
          <p className="text-xs text-red-300 font-mono break-words">{error}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirrorEditor
          value={editorValue}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-slate-700">
        <p className="text-[10px] text-slate-500 font-mono">
          {components.length} root component{components.length !== 1 ? 's' : ''} •{' '}
          {editorValue.length} chars
        </p>
      </div>
    </aside>
  );
});
