'use client';

/**
 * FigmaImportDialog
 * ──────────────────
 * Modal dialog for importing a Figma layout into the Template Mapping Studio.
 *
 * Import modes:
 *  1. Sample — Load one of the built-in demo Figma layouts
 *  2. Upload — Parse a local Figma JSON export file
 *  3. Paste  — Paste raw Figma JSON text directly
 *  4. URL    — Load via Figma REST API (requires token, optional)
 *
 * On success, calls onImport(parseResult) with the parsed Figma structure.
 */

import React, { memo, useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Link2,
  FileJson,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { parseFigmaExport, type FigmaParseResult } from '@/services/figmaParser';
import FIGMA_SAMPLES, { type FigmaSampleEntry } from '@/data/mockFigmaSamples';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FigmaImportDialogProps {
  onImport: (result: FigmaParseResult, sourceName: string) => void;
  onClose: () => void;
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type ImportTab = 'sample' | 'upload' | 'paste' | 'url';

const TABS: Array<{ key: ImportTab; label: string; icon: React.ReactNode }> = [
  { key: 'sample', label: 'Samples',     icon: <Sparkles size={13} /> },
  { key: 'upload', label: 'Upload JSON', icon: <Upload size={13} /> },
  { key: 'paste',  label: 'Paste JSON',  icon: <FileJson size={13} /> },
  { key: 'url',    label: 'Figma URL',   icon: <Link2 size={13} /> },
];

// ─── Figma URL parsing helper ─────────────────────────────────────────────────

function extractFigmaFileId(url: string): string | null {
  // https://www.figma.com/file/FILEID/name
  const match = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

interface SamplePanelProps {
  onSelect: (sample: FigmaSampleEntry) => void;
  loading: boolean;
}

const SamplePanel = memo(function SamplePanel({ onSelect, loading }: SamplePanelProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Load a built-in demo layout to explore the Figma mapping features without any external dependencies.
      </p>
      {FIGMA_SAMPLES.map((sample) => (
        <button
          key={sample.id}
          onClick={() => onSelect(sample)}
          disabled={loading}
          className={cn(
            'w-full text-left p-3.5 rounded-xl border-2 transition-all',
            'border-slate-200 dark:border-slate-700',
            'hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/20',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Layers size={14} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{sample.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {sample.description}
              </p>
            </div>
            <ChevronRight size={14} className="text-slate-400 mt-0.5 shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
});

interface UploadPanelProps {
  onParsed: (json: unknown, name: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

const UploadPanel = memo(function UploadPanel({ onParsed, loading, setLoading, setError }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Only .json files are supported. Export from Figma → File → Save local copy, then rename to .json.');
      return;
    }
    setLoading(true);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        onParsed(parsed, file.name.replace(/\.json$/, ''));
      } catch {
        setError('Failed to parse JSON. Make sure it is a valid Figma export file.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, [onParsed, setLoading, setError]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Export your Figma file as JSON (Figma Desktop → Plugins → Export JSON, or use a community plugin).
      </p>
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          dragOver
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-600'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {loading ? (
          <Loader2 size={24} className="text-violet-500 animate-spin mx-auto mb-2" />
        ) : (
          <Upload size={24} className="text-slate-400 mx-auto mb-2" />
        )}
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {loading ? 'Parsing…' : 'Drop Figma JSON here'}
        </p>
        <p className="text-xs text-slate-400 mt-1">or click to browse</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
});

interface PastePanelProps {
  onParsed: (json: unknown, name: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

const PastePanel = memo(function PastePanel({ onParsed, loading, setLoading, setError }: PastePanelProps) {
  const [text, setText] = useState('');

  const handleParse = useCallback(() => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parsed = JSON.parse(text.trim());
      onParsed(parsed, 'Pasted Figma JSON');
    } catch {
      setError('Invalid JSON. Please paste a valid Figma export.');
    } finally {
      setLoading(false);
    }
  }, [text, onParsed, setLoading, setError]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Paste the contents of a Figma JSON export directly.
      </p>
      <textarea
        className="w-full h-48 text-xs font-mono px-3 py-2.5 bg-slate-950/5 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400"
        placeholder={'{\n  "document": {\n    "type": "DOCUMENT",\n    "children": [...]\n  }\n}'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      <button
        onClick={handleParse}
        disabled={!text.trim() || loading}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all',
          'bg-violet-600 hover:bg-violet-700 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} />}
        Parse JSON
      </button>
    </div>
  );
});

interface URLPanelProps {
  onParsed: (json: unknown, name: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
}

const URLPanel = memo(function URLPanel({ onParsed, loading, setLoading, setError }: URLPanelProps) {
  const [url, setUrl]     = useState('');
  const [token, setToken] = useState('');

  const handleFetch = useCallback(async () => {
    const fileId = extractFigmaFileId(url);
    if (!fileId) {
      setError('Could not extract a Figma file ID from the URL. Expected: https://www.figma.com/file/FILE_ID/...');
      return;
    }
    if (!token.trim()) {
      setError('A Figma personal access token is required. Generate one in Figma → Settings → Personal Access Tokens.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/figma/file?fileId=${encodeURIComponent(fileId)}`, {
        headers: { 'x-figma-token': token.trim() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      onParsed(data, `Figma: ${fileId}`);
    } catch (e) {
      setError(`Failed to load Figma file: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [url, token, onParsed, setLoading, setError]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Load a Figma file directly via the REST API. Your token is never stored — it is only used for this request.
      </p>
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          Figma File URL
        </label>
        <input
          type="url"
          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
          placeholder="https://www.figma.com/file/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          Personal Access Token
        </label>
        <input
          type="password"
          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 dark:text-slate-100 placeholder-slate-400"
          placeholder="figd_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
        />
        <p className="text-[10px] text-slate-400">
          Generate at Figma.com → Settings → Security → Personal access tokens
        </p>
      </div>
      <button
        onClick={handleFetch}
        disabled={!url.trim() || !token.trim() || loading}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all',
          'bg-violet-600 hover:bg-violet-700 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
        Load from Figma
      </button>
    </div>
  );
});

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export const FigmaImportDialog = memo(function FigmaImportDialog({
  onImport,
  onClose,
}: FigmaImportDialogProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('sample');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const handleParsed = useCallback((rawJson: unknown, name: string) => {
    setError('');
    const result = parseFigmaExport(rawJson);
    if (result.nodes.length === 0) {
      setError('No structural frames found in this Figma file. Make sure it contains at least one Frame or Group.');
      return;
    }
    setSuccess(`Parsed ${result.meta.totalNodes} nodes (${result.meta.frameCount} frames, ${result.meta.componentCount} components)`);
    setTimeout(() => {
      onImport(result, name);
      onClose();
    }, 800);
  }, [onImport, onClose]);

  const handleSampleSelect = useCallback((sample: FigmaSampleEntry) => {
    setLoading(true);
    setError('');
    // Small tick to show loading state
    setTimeout(() => {
      handleParsed(sample.data, sample.name);
      setLoading(false);
    }, 200);
  }, [handleParsed]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Layers size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Import Figma Layout</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Use as target for region mapping</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 p-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setError(''); setSuccess(''); }}
              className={cn(
                'flex items-center gap-1.5 flex-1 justify-center px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeTab === t.key
                  ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-96 overflow-y-auto">
          {activeTab === 'sample' && (
            <SamplePanel onSelect={handleSampleSelect} loading={loading} />
          )}
          {activeTab === 'upload' && (
            <UploadPanel
              onParsed={handleParsed}
              loading={loading}
              setLoading={setLoading}
              setError={setError}
            />
          )}
          {activeTab === 'paste' && (
            <PastePanel
              onParsed={handleParsed}
              loading={loading}
              setLoading={setLoading}
              setError={setError}
            />
          )}
          {activeTab === 'url' && (
            <URLPanel
              onParsed={handleParsed}
              loading={loading}
              setLoading={setLoading}
              setError={setError}
            />
          )}
        </div>

        {/* Status bar */}
        {(error || success) && (
          <div className={cn(
            'px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs',
            error   ? 'bg-red-50   dark:bg-red-950/20   text-red-700   dark:text-red-400' :
                      'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
          )}>
            {error
              ? <AlertCircle size={13} className="shrink-0" />
              : <CheckCircle2 size={13} className="shrink-0" />}
            <span>{error || success}</span>
          </div>
        )}
      </div>
    </div>
  );
});
