'use client';

// ─── Design-to-Pega Generator Experience ─────────────────────────────────────
// Full 3-panel UI for converting design screenshots into Pega Constellation
// View metadata JSON. Integrates into the existing mode system alongside
// Builder, Transform, and Renderer without modifying those experiences.

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  ImageIcon,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Layers,
  Wand2,
  RefreshCw,
  Copy,
  ArrowRight,
  X,
  Eye,
  EyeOff,
  Figma,
  ScanLine,
  Sliders,
  RotateCcw,
  Info,
  FileCode2,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { parseDesignInput } from '@/services/designParser';
import { generatePegaMetadata } from '@/services/pegaMetadataGenerator';
import { detectUIFromImage, generatePegaSchemaFromDesign } from '@/services/aiService';
import { useBuilderStore } from '@/store/builderStore';
import type { ParsedDesign, DetectedComponent } from '@/services/designParser';
import type { PegaConstellationMetadata } from '@/services/pegaMetadataGenerator';
import { DetectionOverlay } from './DetectionOverlay';
import { MOCK_DETECTION_SCENARIOS } from '@/data/mockDesignSamples';
import type { MockScenario } from '@/data/mockDesignSamples';
import {
  getAllDesignTransforms,
  saveDesignTransform,
  deleteDesignTransform,
  updateDesignTransform,
  countTransformsForTitle,
} from '@/services/designTransformService';
import type { DesignTransform } from '@/services/designTransformService';

// ─── Types ────────────────────────────────────────────────────────────────────

type InputMode = 'upload' | 'figma' | 'describe';
type PipelineStep = 'idle' | 'uploading' | 'detecting' | 'generating' | 'done' | 'error';

interface OverrideMap {
  [componentId: string]: Partial<DetectedComponent>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DesignGeneratorExperience = memo(function DesignGeneratorExperience() {
  // ── Input state ─────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [describeText, setDescribeText] = useState('');
  const [useAI, setUseAI] = useState(false);

  // ── Pipeline state ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<PipelineStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsedDesign, setParsedDesign] = useState<ParsedDesign | null>(null);
  const [pegaMetadata, setPegaMetadata] = useState<PegaConstellationMetadata | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [isMockResult, setIsMockResult] = useState(false);

  // ── Overlay state ────────────────────────────────────────────────────────────
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  // ── Copy state ───────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Saved transforms state ───────────────────────────────────────────────────
  const [savedTransforms, setSavedTransforms] = useState<DesignTransform[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showSaved, setShowSaved] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const setAppMode = useBuilderStore((s) => s.setAppMode);
  const setPendingTransformJSON = useBuilderStore((s) => s.setPendingTransformJSON);

  // ── Cleanup preview URL ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  useEffect(() => {
    setSavedTransforms(getAllDesignTransforms());
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a PNG or JPG image file.');
      return;
    }
    setUploadedFile(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError(null);
    setParsedDesign(null);
    setPegaMetadata(null);
    setOverrides({});
    setSelectedCompId(null);
    setStep('idle');
  }, [imagePreviewUrl]);

  const handleLoadSample = useCallback(async (scenario: MockScenario) => {
    setError(null);
    setUploadedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setParsedDesign(null);
    setPegaMetadata(null);
    setOverrides({});
    setSelectedCompId(null);
    setStep('detecting');

    // Short delay for UX feedback
    await new Promise((r) => setTimeout(r, 500));

    const s = MOCK_DETECTION_SCENARIOS[scenario];
    let counter = 0;
    const components: DetectedComponent[] = s.components.map((c) => ({
      ...c,
      id: `sample-${++counter}-${Date.now()}`,
      children: [],
      attributes: (c as { attributes?: Record<string, unknown> }).attributes ?? {},
    }));

    const design: ParsedDesign = {
      parseId: `sample-${Date.now()}`,
      screenType: s.screenType,
      title: s.title,
      components,
      layout: [],
      ocrLines: [...s.ocrLines],
      mock: true,
    };

    setParsedDesign(design);
    setStep('generating');
    await new Promise((r) => setTimeout(r, 300));

    const metadata = generatePegaMetadata(design);
    setPegaMetadata(metadata);
    setIsMockResult(true);
    setStep('done');
  }, [imagePreviewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleRunPipeline = useCallback(async () => {
    setError(null);
    setOverrides({});

    try {
      if (inputMode === 'describe') {
        setStep('generating');
        const result = await generatePegaSchemaFromDesign(describeText);
        setPegaMetadata(result.metadata);
        setIsMockResult(result.mock);
        setStep('done');
        return;
      }

      // Image or Figma path
      setStep('detecting');
      let design: ParsedDesign;

      if (inputMode === 'upload' && uploadedFile) {
        if (useAI) {
          const result = await detectUIFromImage(uploadedFile);
          design = result.design;
          setIsMockResult(result.mock);
        } else {
          design = await parseDesignInput(uploadedFile);
          setIsMockResult(design.mock);
        }
      } else if (inputMode === 'figma') {
        design = await parseDesignInput({ fileUrl: figmaUrl });
        setIsMockResult(design.mock);
      } else {
        setError('Please provide an input to process.');
        setStep('error');
        return;
      }

      setParsedDesign(design);

      setStep('generating');
      const metadata = generatePegaMetadata(design);
      setPegaMetadata(metadata);
      setStep('done');
    } catch (err) {
      setError((err as Error).message ?? 'Processing failed');
      setStep('error');
    }
  }, [inputMode, uploadedFile, figmaUrl, describeText, useAI]);

  const handleComponentOverride = useCallback(
    (compId: string, updates: Partial<DetectedComponent>) => {
      setOverrides((prev) => ({ ...prev, [compId]: { ...prev[compId], ...updates } }));

      // Re-generate metadata from the updated components
      if (parsedDesign) {
        const updatedComponents = parsedDesign.components.map((c) =>
          c.id === compId ? { ...c, ...updates } : c
        );
        const updated: ParsedDesign = { ...parsedDesign, components: updatedComponents };
        setParsedDesign(updated);
        setPegaMetadata(generatePegaMetadata(updated));
      }
    },
    [parsedDesign]
  );

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setFigmaUrl('');
    setDescribeText('');
    setParsedDesign(null);
    setPegaMetadata(null);
    setOverrides({});
    setError(null);
    setStep('idle');
    setIsMockResult(false);
    setSelectedCompId(null);
  }, [imagePreviewUrl]);

  const handleCopyJSON = useCallback(async () => {
    if (!pegaMetadata) return;
    await navigator.clipboard.writeText(JSON.stringify(pegaMetadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pegaMetadata]);

  const handleSendToTransform = useCallback(() => {
    if (!pegaMetadata) return;
    setPendingTransformJSON(JSON.stringify(pegaMetadata, null, 2));
    setAppMode('transform');
  }, [pegaMetadata, setPendingTransformJSON, setAppMode]);

  const handleSaveTransform = useCallback(() => {
    if (!parsedDesign || !pegaMetadata) return;
    const count = countTransformsForTitle(parsedDesign.title);
    const name = `${parsedDesign.title} — v${count + 1}`;
    saveDesignTransform({
      name,
      sourceTitle: parsedDesign.title,
      parsedDesign,
      overrides,
      pegaMetadata,
      isMockResult,
    });
    setSavedTransforms(getAllDesignTransforms());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }, [parsedDesign, pegaMetadata, overrides, isMockResult]);

  const handleLoadTransform = useCallback((t: DesignTransform) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setUploadedFile(null);
    setParsedDesign(t.parsedDesign);
    setPegaMetadata(t.pegaMetadata);
    setOverrides(t.overrides);
    setIsMockResult(t.isMockResult);
    setStep('done');
    setError(null);
    setSelectedCompId(null);
  }, [imagePreviewUrl]);

  const handleDeleteTransform = useCallback((id: string) => {
    deleteDesignTransform(id);
    setSavedTransforms(getAllDesignTransforms());
  }, []);

  const handleRenameTransform = useCallback((id: string, name: string) => {
    updateDesignTransform(id, { name: name.trim() || 'Untitled' });
    setSavedTransforms(getAllDesignTransforms());
    setRenamingId(null);
  }, []);

  const isRunnable =
    (inputMode === 'upload' && uploadedFile !== null) ||
    (inputMode === 'figma' && figmaUrl.trim().length > 0) ||
    (inputMode === 'describe' && describeText.trim().length > 10);

  const isRunning = step === 'detecting' || step === 'generating';

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Left Panel: Input ─────────────────────────────────────────────── */}
      <aside className="w-80 min-w-[272px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
              <ScanLine size={12} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Design Input
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-8">
            Upload · Figma URL · or describe your UI
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Input Mode Tabs */}
        <div className="px-4 pt-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 mb-4">
            {(
              [
                { id: 'upload', label: 'Image', icon: <Upload size={11} /> },
                { id: 'figma',  label: 'Figma',  icon: <Figma size={11} /> },
                { id: 'describe', label: 'Describe', icon: <Wand2 size={11} /> },
              ] as { id: InputMode; label: string; icon: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setInputMode(tab.id); setError(null); }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all',
                  inputMode === tab.id
                    ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload Mode */}
          {inputMode === 'upload' && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer transition-all',
                  uploadedFile
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                )}
              >
                {uploadedFile ? (
                  <>
                    <CheckCircle2 size={28} className="text-violet-600" />
                    <div className="text-center">
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                        {uploadedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    >
                      <X size={11} /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon size={20} className="text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Drop image or click to browse
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG supported</p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {/* AI Toggle */}
              <div className="flex items-center gap-2 mt-3 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={useAI}
                  onClick={() => setUseAI((v) => !v)}
                  className={cn(
                    'w-9 h-5 rounded-full relative transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-violet-400',
                    useAI ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                    style={{ left: useAI ? '18px' : '2px' }}
                  />
                </button>
                <span
                  className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                  onClick={() => setUseAI((v) => !v)}
                >
                  Use AI Detection
                </span>
                <span className={cn(
                  'ml-auto text-[9px] px-1.5 py-0.5 rounded font-semibold',
                  useAI
                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                )}>
                  {useAI ? 'AI' : 'Mock'}
                </span>
              </div>
            </div>
          )}

          {/* Figma Mode */}
          {inputMode === 'figma' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Figma File URL
                </label>
                <input
                  type="url"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Info size={12} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-600 dark:text-blue-300">
                  Figma URL parsing uses a mock implementation. For full Figma API
                  access, export node JSON from the Figma developer panel and paste it.
                </p>
              </div>
            </div>
          )}

          {/* Describe Mode */}
          {inputMode === 'describe' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Describe your UI
                </label>
                <textarea
                  value={describeText}
                  onChange={(e) => setDescribeText(e.target.value)}
                  placeholder="e.g. A login form with email, password fields and a submit button..."
                  rows={5}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  'Login form',
                  'Registration screen',
                  'Contact form',
                  'Dashboard overview',
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDescribeText(ex)}
                    className="px-2 py-1 text-[10px] rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-4 mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Pipeline Progress — inside scroll area so it's always readable */}
          {step !== 'idle' && (
            <div className="px-4 mt-3">
              <PipelineProgress step={step} isMock={isMockResult} />
            </div>
          )}

          {/* Sample Quick-Start */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
              Try a sample
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'login',        label: 'Login' },
                  { id: 'form',         label: 'Contact Form' },
                  { id: 'registration', label: 'Registration' },
                  { id: 'dashboard',    label: 'Dashboard' },
                ] as { id: MockScenario; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  disabled={isRunning}
                  onClick={() => handleLoadSample(s.id)}
                  className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-200 dark:border-violet-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wand2 size={9} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Transforms */}
          {savedTransforms.length > 0 && (
            <div className="px-4 pb-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                onClick={() => setShowSaved((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left mb-2"
              >
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex-1">
                  Saved Transforms
                </p>
                <span className="text-[9px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-bold">
                  {savedTransforms.length}
                </span>
                <ChevronRight size={10} className={cn('text-slate-400 transition-transform', showSaved && 'rotate-90')} />
              </button>
              {showSaved && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                  {savedTransforms.map((t) => (
                    <div
                      key={t.id}
                      className="group/item flex items-start gap-2 px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer"
                      onClick={() => handleLoadTransform(t)}
                    >
                      <div className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Bookmark size={9} className="text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {renamingId === t.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => handleRenameTransform(t.id, renameValue || t.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameTransform(t.id, renameValue || t.name);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-[10px] font-semibold bg-white dark:bg-slate-700 border border-violet-300 dark:border-violet-600 rounded px-1 py-0.5 mb-0.5"
                          />
                        ) : (
                          <p
                            className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate"
                            title="Double-click to rename"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(t.id);
                              setRenameValue(t.name);
                            }}
                          >
                            {t.name}
                          </p>
                        )}
                        <p className="text-[9px] text-slate-400 truncate">
                          {t.parsedDesign.components.length} components
                          {' · '}{new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTransform(t.id); }}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:text-red-500 text-slate-400 transition-all shrink-0 mt-0.5"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>{/* end scrollable body */}

        {/* Fixed footer — always visible, never scrolls away */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
          <button
            onClick={handleRunPipeline}
            disabled={!isRunnable || isRunning}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              isRunnable && !isRunning
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-md'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {step === 'detecting' ? 'Detecting…' : 'Generating…'}
              </>
            ) : (
              <><ScanLine size={14} /> Run Detection Pipeline</>
            )}
          </button>
          {(step === 'done' || step === 'error') && (
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </aside>

      {/* ── Center Panel: Preview + Detection Overlay ─────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
        <div className="h-10 flex items-center px-4 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <Layers size={14} className="text-violet-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {parsedDesign ? parsedDesign.title : 'Detection Canvas'}
          </span>
          {parsedDesign && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {parsedDesign.components.length} components
            </span>
          )}
          {parsedDesign && (
            <span className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-semibold',
              isMockResult
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            )}>
              {isMockResult ? 'MOCK' : 'AI'}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {parsedDesign && (
              <button
                onClick={() => setShowOverlay((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {showOverlay ? <EyeOff size={12} /> : <Eye size={12} />}
                {showOverlay ? 'Hide' : 'Show'} Overlays
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start gap-4">
          {/* Loading skeleton during detection */}
          {isRunning && (
            <DetectionLoadingState step={step} />
          )}

          {!isRunning && (
            <>
              {/* Real image canvas */}
              {imagePreviewUrl && inputMode === 'upload' && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded design"
                    className="max-w-full max-h-[calc(100vh-200px)] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 block"
                    style={{ objectFit: 'contain' }}
                  />
                  {showOverlay && parsedDesign && (
                    <DetectionOverlay
                      components={parsedDesign.components.map((c) =>
                        overrides[c.id] ? { ...c, ...overrides[c.id] } : c
                      )}
                      selectedId={selectedCompId}
                      onSelect={setSelectedCompId}
                      onUpdate={handleComponentOverride}
                    />
                  )}
                </div>
              )}

              {/* Mock wireframe canvas — shown for samples & Figma (no real image) */}
              {parsedDesign && !imagePreviewUrl && inputMode !== 'describe' && (
                <MockDesignCanvas
                  design={parsedDesign}
                  effectiveComponents={parsedDesign.components.map((c) =>
                    overrides[c.id] ? { ...c, ...overrides[c.id] } : c
                  )}
                  showOverlay={showOverlay}
                  selectedId={selectedCompId}
                  onSelect={setSelectedCompId}
                  onUpdate={handleComponentOverride}
                />
              )}

              {/* Describe mode panel */}
              {inputMode === 'describe' && (
                <DescribePreview text={describeText} metadata={pegaMetadata} step={step} />
              )}

              {/* True empty state */}
              {!parsedDesign && !imagePreviewUrl && inputMode !== 'describe' && (
                <EmptyState />
              )}
            </>
          )}
        </div>

        {/* OCR Lines */}
        {parsedDesign && parsedDesign.ocrLines.length > 0 && (
          <div className="px-4 pb-3">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  OCR Extracted Text
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsedDesign.ocrLines.map((line, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {line}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Right Panel: Generated Pega JSON ─────────────────────────────── */}
      <aside className="w-[360px] min-w-[300px] flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
            <FileCode2 size={11} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">
            Pega Constellation JSON
          </h2>
          {pegaMetadata && (
            <>
              <button
                onClick={handleCopyJSON}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {copied ? <CheckCircle2 size={11} className="text-green-500" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </>
          )}
        </div>

        {/* Component List (overview) */}
        {parsedDesign && (
          <ComponentListPanel
            components={parsedDesign.components.map((c) =>
              overrides[c.id] ? { ...c, ...overrides[c.id] } : c
            )}
            selectedId={selectedCompId}
            onSelect={setSelectedCompId}
            onUpdate={handleComponentOverride}
          />
        )}

        {/* JSON Output */}
        <div className="flex-1 overflow-auto">
          {pegaMetadata ? (
            <JSONViewer json={pegaMetadata} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Sparkles size={28} className="mb-3 opacity-20 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Pega JSON</p>
              <p className="text-[10px] mt-1 text-slate-400">Appears here after detection runs</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {pegaMetadata && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {isMockResult && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle size={11} className="text-amber-600 shrink-0" />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Mock result — add <code className="font-mono text-[9px]">NEXT_PUBLIC_AI_API_KEY</code> for real detection
                </p>
              </div>
            )}
            <button
              onClick={handleSaveTransform}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all border',
                savedFlash
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                  : 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40'
              )}
            >
              {savedFlash
                ? <><BookmarkCheck size={12} /> Saved!</>
                : <><Bookmark size={12} /> Save Transform</>}
            </button>
            <button
              onClick={handleSendToTransform}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 shadow-md hover:shadow-orange-200 dark:hover:shadow-orange-900/40 transition-all"
            >
              <ArrowRight size={14} />
              Transform to Target Schema
            </button>
            {parsedDesign && (
              <button
                onClick={() => {
                  const updated = generatePegaMetadata(
                    { ...parsedDesign, components: parsedDesign.components.map((c) => overrides[c.id] ? { ...c, ...overrides[c.id] } : c) }
                  );
                  setPegaMetadata(updated);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw size={12} />
                Regenerate from Overrides
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Detection loading skeleton ───────────────────────────────────────────────

function DetectionLoadingState({ step }: { step: PipelineStep }) {
  return (
    <div className="flex flex-col items-center gap-5 py-10">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <ScanLine size={24} className="text-violet-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow">
          <Loader2 size={12} className="animate-spin text-violet-600" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {step === 'detecting' ? 'Detecting UI components…' : 'Generating Pega metadata…'}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {step === 'detecting'
            ? 'Analysing layout, components & extracting text'
            : 'Mapping detections to Pega Constellation schema'}
        </p>
      </div>
      <div className="w-56 space-y-2">
        {[0.9, 0.65, 0.8, 0.5, 0.75].map((w, i) => (
          <div
            key={i}
            className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"
            style={{ width: `${w * 100}%`, animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Mock Design Canvas ───────────────────────────────────────────────────────
// Renders a screen-shaped wireframe with bounding box overlays for sample results
// (no real image available). Allows full selection + editing like the image canvas.

function MockDesignCanvas({
  design,
  effectiveComponents,
  showOverlay,
  selectedId,
  onSelect,
  onUpdate,
}: {
  design: ParsedDesign;
  effectiveComponents: DetectedComponent[];
  showOverlay: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DetectedComponent>) => void;
}) {
  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-2">
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
        style={{ paddingBottom: '130%' }}
        onClick={() => onSelect(null)}
      >
        {/* Browser chrome strip */}
        <div className="absolute top-0 inset-x-0 h-7 bg-slate-100 dark:bg-slate-700 rounded-t-2xl flex items-center px-3 gap-1.5 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="flex-1 mx-3 h-3 rounded bg-slate-200 dark:bg-slate-600 text-[8px] text-slate-400 flex items-center px-2">
            {design.title}
          </span>
        </div>

        {/* Content area */}
        <div className="absolute inset-0 top-7 rounded-b-2xl overflow-hidden">
          {/* Background grid */}
          <div className="absolute inset-0 bg-slate-50 dark:bg-slate-850"
            style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          {showOverlay ? (
            <DetectionOverlay
              components={effectiveComponents}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdate={onUpdate}
            />
          ) : (
            <div className="absolute inset-0 p-3 flex flex-col gap-1.5 overflow-hidden">
              {effectiveComponents.slice(0, 14).map((comp) => (
                <div
                  key={comp.id}
                  className={cn(
                    'rounded px-2 py-1 text-[9px] font-medium truncate cursor-pointer shrink-0',
                    typeColor(comp.type)
                  )}
                  onClick={(e) => { e.stopPropagation(); onSelect(comp.id === selectedId ? null : comp.id); }}
                >
                  {comp.label || comp.type}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Wireframe canvas — bounding boxes use normalised estimates
      </p>
    </div>
  );
}

// ─── JSON viewer with basic syntax colouring ──────────────────────────────────

function JSONViewer({ json }: { json: unknown }) {
  const lines = JSON.stringify(json, null, 2).split('\n');
  return (
    <div className="p-3 font-mono text-[10px] leading-relaxed select-text">
      {lines.map((rawLine, i) => {
        const trimmed = rawLine.trimStart();
        const indent = rawLine.length - trimmed.length;
        let cls = 'text-slate-700 dark:text-slate-300';
        if (trimmed.match(/^"[^"]+"\s*:/)) {
          cls = 'text-blue-700 dark:text-blue-400'; // keys
        } else if (trimmed.match(/^"/) && !trimmed.includes(':')) {
          cls = 'text-green-700 dark:text-green-400'; // string values
        } else if (trimmed.match(/^-?\d/) || trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
          cls = 'text-orange-600 dark:text-orange-400'; // numbers/booleans
        } else if (/^[{}\[\]]/.test(trimmed)) {
          cls = 'text-slate-400 dark:text-slate-500'; // brackets
        }
        return (
          <div key={i} className={cls} style={{ paddingLeft: indent * 5 }}>
            {trimmed}
          </div>
        );
      })}
    </div>
  );
}

function PipelineProgress({
  step,
  isMock,
}: {
  step: PipelineStep;
  isMock: boolean;
}) {
  const steps: { id: PipelineStep; label: string }[] = [
    { id: 'detecting', label: 'Layout & Component Detection' },
    { id: 'generating', label: 'Pega Metadata Generation' },
    { id: 'done', label: 'Complete' },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="mx-4 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5">
        Pipeline
      </p>
      <div className="space-y-1.5">
        {steps.map((s, idx) => {
          const done = step === 'done' || (currentIndex > idx && step !== 'error');
          const active = s.id === step;
          const isError = step === 'error' && active;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold',
                  isError
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40'
                    : done
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/40'
                    : active
                    ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                )}
              >
                {done ? '✓' : idx + 1}
              </div>
              <span
                className={cn(
                  'text-[10px]',
                  done
                    ? 'text-green-600 dark:text-green-400 font-medium'
                    : active
                    ? 'text-violet-700 dark:text-violet-300 font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {step === 'done' && isMock && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            ⚠ Mock mode — results are simulated
          </p>
        </div>
      )}
    </div>
  );
}

function ComponentListPanel({
  components,
  selectedId,
  onSelect,
  onUpdate,
}: {
  components: DetectedComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DetectedComponent>) => void;
}) {
  const COMPONENT_TYPES: DetectedComponent['type'][] = [
    'input', 'password', 'button', 'dropdown', 'checkbox', 'radio',
    'label', 'heading', 'text', 'image', 'container', 'section', 'card', 'table', 'link', 'unknown',
  ];

  if (components.length === 0) return null;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 max-h-52 overflow-y-auto">
      <div className="px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <Sliders size={11} className="text-slate-400" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Detected Components ({components.length})
          </span>
        </div>
        <div className="space-y-1">
          {components.map((comp) => (
            <div
              key={comp.id}
              onClick={() => onSelect(selectedId === comp.id ? null : comp.id)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs',
                selectedId === comp.id
                  ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
              )}
            >
              <span className="w-16 shrink-0">
                <span
                  className={cn(
                    'inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold',
                    typeColor(comp.type)
                  )}
                >
                  {comp.type}
                </span>
              </span>
              <span className="flex-1 truncate">{comp.label || '(no label)'}</span>
              <span className="text-[9px] text-slate-400">
                {Math.round(comp.confidence * 100)}%
              </span>

              {/* Inline type correction */}
              {selectedId === comp.id && (
                <select
                  value={comp.type}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdate(comp.id, { type: e.target.value as DetectedComponent['type'] });
                  }}
                  className="ml-1 text-[9px] border border-violet-300 dark:border-violet-700 rounded px-1 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  {COMPONENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    input:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    password:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    button:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    dropdown:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    checkbox:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    heading:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    label:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    text:      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    card:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    section:   'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    table:     'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return map[type] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center py-16 px-8">
      <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
        <ImageIcon size={28} className="text-violet-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          No design loaded
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Upload a UI screenshot to visualise detected components with bounding box overlays
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-2">
        {['Layout Detection', 'Component Classification', 'OCR Text Extraction', 'Pega JSON Output'].map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <ChevronRight size={10} className="text-violet-500" />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

function DescribePreview({
  text,
  metadata,
  step,
}: {
  text: string;
  metadata: PegaConstellationMetadata | null;
  step: PipelineStep;
}) {
  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 size={32} className="animate-spin text-violet-500" />
        <p className="text-sm text-slate-500">Generating Pega schema…</p>
      </div>
    );
  }

  if (!text && !metadata) return <EmptyState />;

  return (
    <div className="max-w-sm w-full p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <Wand2 size={16} className="text-violet-600" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          AI Schema Description
        </h3>
      </div>
      {text && (
        <p className="text-xs text-slate-600 dark:text-slate-300 italic mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          &ldquo;{text}&rdquo;
        </p>
      )}
      {metadata ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">View Type</span>
            <span className="text-xs font-mono text-violet-700 dark:text-violet-300">{metadata.view.type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Regions</span>
            <span className="text-xs font-mono">{metadata.view.regions.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            <span className="text-xs font-mono">{metadata.view.actions.length}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[10px] text-slate-400">
              {metadata.view.regions.reduce((t, r) => t + r.fields.length, 0)} fields across {metadata.view.regions.length} region(s)
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Click &ldquo;Run Detection Pipeline&rdquo; to generate</p>
      )}
    </div>
  );
}

function FigmaPlaceholder({
  url,
  step,
  parsedDesign,
}: {
  url: string;
  step: PipelineStep;
  parsedDesign: ParsedDesign | null;
}) {
  if (step === 'detecting') {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 size={32} className="animate-spin text-violet-500" />
        <p className="text-sm text-slate-500">Parsing Figma design…</p>
      </div>
    );
  }

  if (parsedDesign) {
    return (
      <div className="max-w-md w-full p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Figma size={16} className="text-violet-600" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {parsedDesign.title}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {parsedDesign.components.length} components detected from Figma structure
        </p>
        <div className="space-y-1.5">
          {parsedDesign.components.slice(0, 8).map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-mono', typeColor(c.type))}>
                {c.type}
              </span>
              <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
            </div>
          ))}
          {parsedDesign.components.length > 8 && (
            <p className="text-[10px] text-slate-400">
              +{parsedDesign.components.length - 8} more…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
        <Figma size={22} className="text-violet-600" />
      </div>
      {url ? (
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Figma URL ready</p>
          <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs break-all">{url}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Enter a Figma URL to begin</p>
      )}
    </div>
  );
}
