/**
 * RendererExperience
 *
 * Full-page layout for the "Render (A2UI)" mode.
 * Orchestrates:
 *   - JSONSourcePanel  (left)  — schema source selection + validation
 *   - A2UIPreviewPanel (center) — live rendered output
 *   - Event log / debug tree   — right side of A2UIPreviewPanel
 *
 * State flow:
 *   sourceType + customJSON → rawJSON → parse → validate → render
 */
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useBuilderStore } from '@/store/builderStore';
import {
  validateRawJSON,
  prepareSchema,
  autoRepairSchema,
  getSDKInfo,
  isA2UIFormat,
} from '@/services/a2uiRenderer';
import { getRenderer, getAllRenderers, type RendererType } from '@/services/rendererFactory';
import { optimizeSchemaForA2UI } from '@/services/aiService';
import type { A2UIEvent, A2UIRenderResult, A2UITheme } from '@/services/mockA2UI';
import { JSONSourcePanel, type SourceType } from './JSONSourcePanel';
import { A2UIPreviewPanel } from './A2UIPreviewPanel';
import { cn } from '@/utils/cn';
import {
  Zap,
  Settings2,
  Moon,
  Sun,
  Bug,
  Sparkles,
  Loader2,
  ChevronDown,
} from 'lucide-react';

export function RendererExperience() {
  const rendererJSON = useBuilderStore((s) => s.rendererJSON);

  // ── Source state ────────────────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<SourceType>(
    rendererJSON ? 'transformed' : 'canvas'
  );
  const [customJSON, setCustomJSON] = useState('[\n  {\n    "id": "demo-1",\n    "type": "Container",\n    "props": { "layout": "vertical", "gap": 16, "padding": 20 },\n    "children": []\n  }\n]');

  // ── Renderer state ─────────────────────────────────────────────────────────
  const [rendererType, setRendererType] = useState<RendererType>('a2ui');
  const [theme, setTheme] = useState<A2UITheme>('light');
  const [debug, setDebug] = useState(false);

  // ── Runtime state ──────────────────────────────────────────────────────────
  const [rawJSON, setRawJSON] = useState('[]');
  const [renderResult, setRenderResult] = useState<A2UIRenderResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [events, setEvents] = useState<A2UIEvent[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [isGoogleFormat, setIsGoogleFormat] = useState(false);
  const [showRendererMenu, setShowRendererMenu] = useState(false);

  const renderers = getAllRenderers();
  const adapter = getRenderer(rendererType);
  const sdkInfo = getSDKInfo(rendererType);

  // ── Event capture ──────────────────────────────────────────────────────────
  const handleEvent = useCallback((event: A2UIEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const doRender = useCallback(
    (json: string) => {
      setParseError(null);
      try {
        // Detect Google A2UI format before parse
        try {
          const preliminary = JSON.parse(json);
          setIsGoogleFormat(Array.isArray(preliminary) && isA2UIFormat(preliminary));
        } catch {
          setIsGoogleFormat(false);
        }
        const schema = prepareSchema(json);
        const { schema: repaired } = autoRepairSchema(schema);
        const result = adapter.render(repaired, {
          theme,
          debug,
          onEvent: handleEvent,
        });
        setRenderResult(result);
      } catch (e) {
        setParseError((e as Error).message);
        setRenderResult(null);
      }
    },
    [adapter, theme, debug, handleEvent]
  );

  // Track last rawJSON so re-render button can use it
  const rawJSONRef = useRef(rawJSON);
  rawJSONRef.current = rawJSON;

  const handleRawJSONChange = useCallback(
    (json: string) => {
      setRawJSON(json);
      doRender(json);
    },
    [doRender]
  );

  // Re-render when renderer settings change
  useEffect(() => {
    if (rawJSONRef.current) doRender(rawJSONRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererType, theme, debug]);

  const handleManualRender = useCallback(() => {
    doRender(rawJSONRef.current);
  }, [doRender]);

  // ── AI Optimize ────────────────────────────────────────────────────────────
  const handleAIOptimize = useCallback(async () => {
    setAiLoading(true);
    setAiStatus(null);
    try {
      const schema = prepareSchema(rawJSONRef.current);
      const result = await optimizeSchemaForA2UI(schema);
      const optimizedJSON = JSON.stringify(result.optimized, null, 2);
      if (sourceType === 'custom') {
        setCustomJSON(optimizedJSON);
      }
      doRender(optimizedJSON);
      setAiStatus(
        result.changes.length > 0
          ? `${result.changes.length} fix${result.changes.length !== 1 ? 'es' : ''} applied${result.mock ? ' (mock)' : ''}`
          : 'Already optimal'
      );
    } catch (e) {
      setAiStatus(`Error: ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
      setTimeout(() => setAiStatus(null), 4000);
    }
  }, [sourceType, doRender]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Top Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 flex-wrap">
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">A2UI Renderer</span>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{sdkInfo.version}</span>
          {sdkInfo.mock && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
              mock
            </span>
          )}
          {isGoogleFormat && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
              Google A2UI format
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Renderer selector */}
        <div className="relative">
          <button
            onClick={() => setShowRendererMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <Settings2 size={12} />
            {adapter.label}
            <ChevronDown size={11} />
          </button>
          {showRendererMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-52">
              {renderers.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRendererType(r.id);
                    setShowRendererMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                    r.id === rendererType && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white',
                        r.badgeColor
                      )}
                    >
                      {r.id}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{r.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
            theme === 'dark'
              ? 'bg-slate-800 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
          )}
        >
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          {theme === 'dark' ? 'Dark' : 'Light'}
        </button>

        {/* Debug toggle */}
        <button
          onClick={() => setDebug((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors',
            debug
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
          )}
        >
          <Bug size={12} />
          Debug
        </button>

        <div className="flex-1" />

        {/* AI Optimize */}
        <button
          onClick={handleAIOptimize}
          disabled={aiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md transition-colors"
        >
          {aiLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          AI Optimize
        </button>

        {aiStatus && (
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
            {aiStatus}
          </span>
        )}
      </div>

      {/* ── Main Layout ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: JSON Source */}
        <JSONSourcePanel
          sourceType={sourceType}
          onSourceChange={setSourceType}
          customJSON={customJSON}
          onCustomJSONChange={setCustomJSON}
          onRawJSONChange={handleRawJSONChange}
        />

        {/* Center + Right: Preview + Events */}
        <A2UIPreviewPanel
          renderResult={renderResult}
          parseError={parseError}
          adapter={adapter}
          theme={theme}
          debug={debug}
          events={events}
          onClearEvents={() => setEvents([])}
          onRender={handleManualRender}
        />
      </div>

      {/* Click anywhere to close renderer menu */}
      {showRendererMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowRendererMenu(false)}
        />
      )}
    </div>
  );
}
