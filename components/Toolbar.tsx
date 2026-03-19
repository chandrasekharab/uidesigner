'use client';

import React, { memo, useState, useCallback } from 'react';
import { useBuilderStore } from '@/store/builderStore';
import { saveUI, loadUI } from '@/services/uiService';
import { generateUIFromPrompt } from '@/services/aiService';
import { cn } from '@/utils/cn';
import {
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Save,
  FolderOpen,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hammer,
  ArrowLeftRight,
  Play,
  SendToBack,
  Moon,
  Sun,
  ScanLine,
} from 'lucide-react';

type ToastState = { type: 'success' | 'error'; message: string } | null;

export const Toolbar = memo(function Toolbar() {
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);
  const canUndo = useBuilderStore((s) => s.canUndo());
  const canRedo = useBuilderStore((s) => s.canRedo());
  const previewMode = useBuilderStore((s) => s.previewMode);
  const togglePreview = useBuilderStore((s) => s.togglePreview);
  const setComponents = useBuilderStore((s) => s.setComponents);
  const components = useBuilderStore((s) => s.components);
  const appMode = useBuilderStore((s) => s.appMode);
  const setAppMode = useBuilderStore((s) => s.setAppMode);
  const theme = useBuilderStore((s) => s.theme);
  const toggleTheme = useBuilderStore((s) => s.toggleTheme);
  const setPendingTransformJSON = useBuilderStore((s) => s.setPendingTransformJSON);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSendToTransform = useCallback(() => {
    if (components.length === 0) return;
    setPendingTransformJSON(JSON.stringify(components, null, 2));
    setAppMode('transform');
  }, [components, setPendingTransformJSON, setAppMode]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveUI(components);
      showToast('success', 'UI saved successfully');
    } catch {
      showToast('error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [components, showToast]);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadUI();
      setComponents(data.components);
      showToast('success', `Loaded: ${data.name}`);
    } catch {
      showToast('error', 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [setComponents, showToast]);

  const handleClear = useCallback(() => {
    if (components.length === 0) return;
    if (confirm('Clear the canvas? This cannot be undone.')) {
      setComponents([]);
    }
  }, [components, setComponents]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await generateUIFromPrompt(aiPrompt);
      setComponents(result.components);
      setAiPrompt('');
      setShowAI(false);
      showToast('success', result.mock ? 'Mock UI generated (add AI key for real)' : 'UI generated!');
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, setComponents, showToast]);

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
    active = false
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium',
        'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );

  return (
    <header className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-1 relative z-30">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-3">
        <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
          <span className="text-white text-xs font-bold">UI</span>
        </div>
        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm hidden sm:block">
          Low-Code Builder
        </span>
      </div>

      {/* Mode Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 mr-3">
        <button
          onClick={() => setAppMode('builder')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
            appMode === 'builder'
              ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
        >
          <Hammer size={12} /> Builder
        </button>
        <button
          onClick={() => setAppMode('transform')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
            appMode === 'transform'
              ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
        >
          <ArrowLeftRight size={12} /> Transform
        </button>
        <button
          onClick={() => setAppMode('renderer')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
            appMode === 'renderer'
              ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
        >
          <Play size={12} /> Render
        </button>
        <button
          onClick={() => setAppMode('design')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
            appMode === 'design'
              ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
        >
          <ScanLine size={12} /> Generate
        </button>
      </div>

      {/* Builder-only controls */}
      {appMode === 'builder' && (
        <>
          <div className="h-5 w-px bg-slate-200 mx-1" />
          {iconBtn('Undo', <Undo2 size={15} />, undo, !canUndo)}
          {iconBtn('Redo', <Redo2 size={15} />, redo, !canRedo)}
          <div className="h-5 w-px bg-slate-200 mx-1" />
          {iconBtn('Save', saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />, handleSave, saving)}
          {iconBtn('Load', loading ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />, handleLoad, loading)}
          {iconBtn('Clear', <Trash2 size={15} />, handleClear, components.length === 0)}
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={handleSendToTransform}
            disabled={components.length === 0}
            title="Send canvas schema to Transform Studio as source"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <SendToBack size={15} />
            <span className="hidden lg:inline">Send to Transform</span>
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          {iconBtn(
            previewMode ? 'Edit Mode' : 'Preview',
            previewMode ? <EyeOff size={15} /> : <Eye size={15} />,
            togglePreview,
            false,
            previewMode
          )}
        </>
      )}

      {appMode === 'transform' && (
        <span className="text-xs text-orange-600 font-medium ml-1 hidden md:flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
          <ArrowLeftRight size={12} />
          Schema Transformation Studio
        </span>
      )}

      {appMode === 'renderer' && (
        <span className="text-xs text-blue-600 font-medium ml-1 hidden md:flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
          <Play size={12} />
          A2UI Renderer Experience
        </span>
      )}

      {appMode === 'design' && (
        <span className="text-xs text-violet-700 font-medium ml-1 hidden md:flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-md">
          <ScanLine size={12} />
          Design-to-Pega Generator
        </span>
      )}

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mr-1"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* AI Button (builder mode only) */}
      {appMode === 'builder' && (
      <button
        onClick={() => setShowAI((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          showAI
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700'
        )}
      >
        <Sparkles size={15} />
        <span className="hidden md:inline">AI Generate</span>
      </button>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'absolute right-4 -bottom-12 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 transition-all',
          toast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.message}
        </div>
      )}

      {/* AI Popover */}
      {showAI && (
        <div className="absolute right-4 top-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4 w-80 z-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-purple-600" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">AI UI Generator</h3>
            <span className="ml-auto text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded font-medium">
              Mock
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Describe a UI (e.g. &quot;login form&quot;, &quot;contact form&quot;). Add{' '}
            <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">NEXT_PUBLIC_AI_API_KEY</code> for real AI.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="login form, dashboard..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
            />
            <button
              onClick={handleAIGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : 'Go'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
});
