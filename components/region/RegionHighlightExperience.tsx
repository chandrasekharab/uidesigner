'use client';

// ─── RegionHighlightExperience ────────────────────────────────────────────────
// Full-screen mode for the "Highlight & Map Regions" pipeline.
//
// Pipeline steps:
//   1. Upload Image   — PNG / JPG / SVG
//   2. Draw Regions   — RegionCanvas + RegionList + RegionEditor
//   3. Analyse        — AI batch analysis per region
//   4. Map & Export   — RegionMappingPanel + JSON export
//
// Respects the existing colour theming and toolbar layout conventions.

import React, {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Upload,
  ImageIcon,
  Wand2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  ChevronRight,
  ChevronLeft,
  Play,
  RotateCcw,
  Sparkles,
  MapPin,
  FileJson,
  Info,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Region, RegionBoundingBox, RegionMappedSchema, RegionAnalysisResult } from '@/types/region';
import { useResizePanel } from '@/utils/resizePanel';
import { ResizeHandle } from '@/components/ResizeHandle';
import { RegionCanvas }          from '@/components/region/RegionCanvas';
import { RegionList }            from '@/components/region/RegionList';
import { RegionEditor }          from '@/components/region/RegionEditor';
import { RegionMappingPanel }    from '@/components/region/RegionMappingPanel';
import { WidgetExtractionPanel } from '@/components/region/WidgetExtractionPanel';
import { analyseRegions }        from '@/services/aiService';
import {
  detectRedBorderedWidgets,
  type DetectedWidget,
} from '@/utils/redBorderDetector';
import {
  SAMPLE_REGIONS,
  REGION_COLORS,
  getMockDesignDataUrl,
  buildPegaMetadataFromRegions,
} from '@/data/mockRegionSamples';

// ─── Steps ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3;

const STEPS = [
  { label: 'Upload Image',   icon: <Upload   size={13} /> },
  { label: 'Draw Regions',   icon: <MapPin   size={13} /> },
  { label: 'Analyse',        icon: <Wand2    size={13} /> },
  { label: 'Map & Export',   icon: <FileJson size={13} /> },
] as const;

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';
type Toast = { type: ToastType; msg: string } | null;

function useToast() {
  const [toast, setToast] = useState<Toast>(null);
  const show = useCallback((type: ToastType, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const ToastEl = toast ? (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium',
      toast.type === 'success' ? 'bg-green-600  text-white' :
      toast.type === 'error'   ? 'bg-red-600    text-white' :
                                 'bg-indigo-600 text-white'
    )}>
      {toast.type === 'success' ? <CheckCircle2 size={14} /> : <Info size={14} />}
      {toast.msg}
    </div>
  ) : null;

  return { show, ToastEl };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function regionColor(idx: number) {
  return REGION_COLORS[idx % REGION_COLORS.length];
}

// ─── Step 0 – Upload ─────────────────────────────────────────────────────────

interface UploadStepProps {
  onImageReady: (url: string, fileName: string) => void;
  onUseSample: () => void;
}

const UploadStep = memo(function UploadStep({ onImageReady, onUseSample }: UploadStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a PNG, JPG, or SVG image.');
      return;
    }
    const url = URL.createObjectURL(file);
    onImageReady(url, file.name);
  }, [onImageReady]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-md w-full">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
          Upload a Design Screenshot
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Upload a UI screenshot (PNG, JPG, SVG). If you draw{' '}
          <span className="font-semibold text-red-500">red rectangles</span> around widgets,
          they will be auto-detected and extracted as JSON. Otherwise, draw regions manually.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
            dragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
              : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10'
          )}
        >
          <ImageIcon size={36} className="text-slate-300 dark:text-slate-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Drop an image here, or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG, SVG — max 20 MB</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        <button
          onClick={onUseSample}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
        >
          <Sparkles size={14} />
          Use sample design (Pega Case Management)
        </button>
      </div>
    </div>
  );
});

// ─── Step 2 – Analyse ─────────────────────────────────────────────────────────

interface AnalyseStepProps {
  regions: Region[];
  autoDetectMode: boolean;
  onToggleAutoDetect: () => void;
  onRunAnalysis: () => void;
  analysing: boolean;
  analysisResults: RegionAnalysisResult[];
  onNext: () => void;
  onBack: () => void;
}

const AnalyseStep = memo(function AnalyseStep({
  regions, autoDetectMode, onToggleAutoDetect,
  onRunAnalysis, analysing, analysisResults, onNext, onBack,
}: AnalyseStepProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
          <ChevronLeft size={13} /> Back
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Region Analysis</span>

        <label className="ml-auto flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoDetectMode}
            onChange={onToggleAutoDetect}
            className="rounded accent-indigo-600"
          />
          Auto-detect regions
        </label>

        <button
          onClick={onRunAnalysis}
          disabled={analysing || regions.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {analysing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          {analysing ? 'Analysing…' : 'Run Analysis'}
        </button>

        <button
          onClick={onNext}
          disabled={regions.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          Map & Export <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {regions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle size={28} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No regions to analyse. Go back and draw at least one region.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regions.map((r) => {
              const result = analysisResults.find((ar) => ar.regionId === r.id);
              return (
                <div key={r.id} className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                  {/* Crop preview */}
                  {r.imageSegment ? (
                    <img
                      src={r.imageSegment}
                      alt={r.name}
                      className="w-full object-cover h-24 border-b border-slate-100 dark:border-slate-800"
                    />
                  ) : (
                    <div
                      className="h-24 flex items-center justify-center border-b border-slate-100 dark:border-slate-800"
                      style={{ background: `${r.color}18` }}
                    >
                      <span className="text-xs text-slate-400">No crop</span>
                    </div>
                  )}

                  <div className="p-2 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                    </div>

                    {analysing && !result && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Loader2 size={10} className="animate-spin" /> Analysing…
                      </div>
                    )}

                    {result && (
                      <>
                        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                          {result.detectedType}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 leading-snug line-clamp-2">{result.reason}</p>
                        {result.suggestedMapping && (
                          <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                            → {result.suggestedMapping.canonicalType}
                          </p>
                        )}
                      </>
                    )}

                    {!analysing && !result && (
                      <span className="text-[10px] text-slate-400">Not yet analysed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Step 3 – Map & Export ────────────────────────────────────────────────────

interface MapExportStepProps {
  regions: Region[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string) => void;
  onUpdateMapping: (id: string, schema: RegionMappedSchema) => void;
  onBack: () => void;
}

const MapExportStep = memo(function MapExportStep({
  regions, selectedRegionId, onSelectRegion, onUpdateMapping, onBack,
}: MapExportStepProps) {
  const [activeTab, setActiveTab] = useState<'mapping' | 'json'>('mapping');
  const [copied, setCopied] = useState(false);
  const { width: mappingListW, handleProps: mappingListH } = useResizePanel({ initial: 224, direction: 'right', min: 150, max: 360 });

  const pegaJson = buildPegaMetadataFromRegions(regions);
  const jsonStr  = JSON.stringify(pegaJson, null, 2);

  const copyJson = () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadJson = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'region-mapping.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId) ?? null;
  const mappedCount    = regions.filter((r) => r.mappedSchema).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
          <ChevronLeft size={13} /> Back
        </button>
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setActiveTab('mapping')}
            className={cn('px-3 py-1 rounded-md text-xs font-semibold transition-all',
              activeTab === 'mapping' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400')}
          >
            Mapping
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={cn('px-3 py-1 rounded-md text-xs font-semibold transition-all',
              activeTab === 'json' ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-slate-500 dark:text-slate-400')}
          >
            JSON Output
          </button>
        </div>

        <span className="text-xs text-slate-400 ml-2">
          {mappedCount}/{regions.length} mapped
        </span>

        <div className="flex-1" />

        {activeTab === 'json' && (
          <>
            <button
              onClick={copyJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download size={12} /> Download
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {activeTab === 'mapping' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Region list */}
          <div style={{ width: mappingListW }} className="relative shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-hidden">
            <ResizeHandle handleProps={mappingListH} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10" />
            <div className="h-full overflow-y-auto">
              {regions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectRegion(r.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-slate-100 dark:border-slate-800',
                    r.id === selectedRegionId
                      ? 'bg-indigo-50 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{r.name}</span>
                  {r.mappedSchema
                    ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                    : <AlertCircle  size={11} className="text-amber-400 shrink-0" />
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Mapping panel */}
          <div className="flex-1 overflow-hidden">
            <RegionMappingPanel
              region={selectedRegion}
              onUpdateMapping={onUpdateMapping}
            />
          </div>
        </div>
      ) : (
        /* JSON output */
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Pega Constellation view JSON derived from {mappedCount} mapped region{mappedCount !== 1 ? 's' : ''}.
            {mappedCount < regions.length && (
              <span className="text-amber-500 ml-1">
                ({regions.length - mappedCount} region{regions.length - mappedCount !== 1 ? 's' : ''} not yet mapped — not included)
              </span>
            )}
          </p>
          <pre className="flex-1 overflow-auto text-[11px] font-mono bg-slate-900 text-green-300 p-3 rounded-lg leading-relaxed">
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  );
});

// ─── RegionHighlightExperience ────────────────────────────────────────────────

export const RegionHighlightExperience = memo(function RegionHighlightExperience() {
  const { show: showToast, ToastEl } = useToast();

  // ── Resizable panels ────────────────────────────────────────────────────────
  const { width: drawListW,     handleProps: drawListH     } = useResizePanel({ initial: 224, direction: 'right', min: 150, max: 360 });
  const { width: drawEditorW,   handleProps: drawEditorH   } = useResizePanel({ initial: 224, direction: 'left',  min: 150, max: 360 });

  const [step,             setStep]             = useState<Step>(0);
  const [imageUrl,         setImageUrl]         = useState<string>('');
  const [imageFileName,    setImageFileName]    = useState<string>('');
  const [regions,          setRegions]          = useState<Region[]>([]);
  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [analysing,        setAnalysing]        = useState(false);
  const [analysisResults,  setAnalysisResults]  = useState<RegionAnalysisResult[]>([]);
  const [autoDetect,       setAutoDetect]       = useState(false);

  // ── Red-border extraction ────────────────────────────────────────────────
  type Step1View = 'detecting' | 'extraction' | 'draw';
  const [step1View,        setStep1View]        = useState<Step1View>('draw');
  const [extractedWidgets, setExtractedWidgets] = useState<DetectedWidget[]>([]);
  const [extractedMeta,    setExtractedMeta]    = useState<{ width: number; height: number } | null>(null);

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageReady = useCallback(async (url: string, name: string) => {
    setImageUrl(url);
    setImageFileName(name);
    setRegions([]);
    setSelectedId(null);
    setAnalysisResults([]);
    setExtractedWidgets([]);
    setExtractedMeta(null);
    setStep(1);
    setStep1View('detecting');

    try {
      const result = await detectRedBorderedWidgets(url);
      setExtractedWidgets(result.widgets);
      setExtractedMeta({ width: result.imageWidth, height: result.imageHeight });

      if (result.widgets.length > 0) {
        // Pre-populate regions from detected widget bounding boxes
        const newRegions: Region[] = result.widgets.map((w, i) => ({
          id:           w.id,
          name:         w.name,
          boundingBox:  w.normalizedBounds,
          imageSegment: w.imageSegment,
          color:        regionColor(i),
          detectedType: undefined,
          mappedSchema: undefined,
        }));
        setRegions(newRegions);
        setSelectedId(newRegions[0]?.id ?? null);
        setStep1View('extraction');
        showToast('success', `Detected ${result.widgets.length} widget${result.widgets.length !== 1 ? 's' : ''} from red borders`);
      } else {
        setStep1View('draw');
        showToast('info', 'No red borders found — draw regions manually');
      }
    } catch {
      setStep1View('draw');
      showToast('info', `Loaded: ${name}`);
    }
  }, [showToast]);

  const handleUseSample = useCallback(() => {
    const url = getMockDesignDataUrl();
    setImageUrl(url);
    setImageFileName('pega-case-management-sample.svg');
    const populated: Region[] = SAMPLE_REGIONS.map((r, i) => ({
      ...r,
      imageSegment: '',
      color: r.color ?? REGION_COLORS[i % REGION_COLORS.length],
    }));
    setRegions(populated);
    setSelectedId(populated[0]?.id ?? null);
    setAnalysisResults([]);
    setExtractedWidgets([]);
    setExtractedMeta(null);
    setStep1View('draw');
    setStep(1);
    showToast('info', 'Sample design loaded with pre-defined regions.');
  }, [showToast]);

  // ── Region CRUD ─────────────────────────────────────────────────────────────
  const handleRegionCreate = useCallback((bbox: RegionBoundingBox, imageSegment: string) => {
    const id    = uuidv4();
    const color = regionColor(regions.length);
    const region: Region = {
      id,
      name:         `Region ${regions.length + 1}`,
      boundingBox:  bbox,
      imageSegment,
      color,
      detectedType: undefined,
      mappedSchema: undefined,
    };
    setRegions((prev) => [...prev, region]);
    setSelectedId(id);
    showToast('success', `Region ${regions.length + 1} created`);
  }, [regions.length, showToast]);

  const handleRegionUpdate = useCallback((id: string, updates: Partial<Region>) => {
    setRegions((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const handleRegionDelete = useCallback((id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm('Clear all regions? This cannot be undone.')) {
      setRegions([]);
      setSelectedId(null);
      setAnalysisResults([]);
    }
  }, []);

  const handleUpdateMapping = useCallback((regionId: string, schema: RegionMappedSchema) => {
    setRegions((prev) => prev.map((r) => r.id === regionId ? { ...r, mappedSchema: schema } : r));
    showToast('success', 'Mapping saved');
  }, [showToast]);

  // ── Analysis ────────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (regions.length === 0) return;
    setAnalysing(true);
    setAnalysisResults([]);
    try {
      const results = await analyseRegions(
        regions.map((r) => ({ id: r.id, name: r.name, detectedType: r.detectedType, imageSegment: r.imageSegment }))
      );
      setAnalysisResults(results);
      // Auto-apply suggested mappings
      setRegions((prev) => prev.map((r) => {
        const result = results.find((ar) => ar.regionId === r.id);
        if (result && !r.mappedSchema) {
          return { ...r, detectedType: result.detectedType, mappedSchema: result.suggestedMapping };
        }
        return r;
      }));
      showToast('success', `Analysed ${results.length} region${results.length !== 1 ? 's' : ''}`);
    } catch {
      showToast('error', 'Analysis failed — check console for details');
    } finally {
      setAnalysing(false);
    }
  }, [regions, showToast]);

  // ── Auto-detect: when toggled on, run suggestRegions ───────────────────────
  const handleToggleAutoDetect = useCallback(() => {
    setAutoDetect((v) => !v);
  }, []);

  useEffect(() => {
    if (!autoDetect || step !== 2 || regions.length > 0) return;
    import('@/services/aiService').then(({ suggestRegions }) =>
      suggestRegions(imageUrl).then((result) => {
        const newRegions: Region[] = result.suggestions.map((s, i) => ({
          id:           uuidv4(),
          name:         s.name,
          boundingBox:  s.boundingBox,
          imageSegment: '',
          color:        regionColor(i),
          detectedType: s.detectedType,
        }));
        setRegions(newRegions);
        if (newRegions.length > 0) {
          setSelectedId(newRegions[0].id);
          showToast('success', `Auto-detected ${newRegions.length} regions`);
        }
      })
    );
  }, [autoDetect, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep(0);
    setImageUrl('');
    setImageFileName('');
    setRegions([]);
    setSelectedId(null);
    setAnalysisResults([]);
    setExtractedWidgets([]);
    setExtractedMeta(null);
    setStep1View('draw');
  }, []);

  const selectedRegion = regions.find((r) => r.id === selectedId) ?? null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Step bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {STEPS.map((s, i) => {
          const isActive    = step === i;
          const isCompleted = step > i;
          return (
            <React.Fragment key={i}>
              <button
                onClick={() => {
                  if (i === 0 || imageUrl) setStep(i as Step);
                }}
                disabled={i > 0 && !imageUrl}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : isCompleted
                    ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {isCompleted ? <CheckCircle2 size={12} /> : s.icon}
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 mx-0.5 shrink-0" />
              )}
            </React.Fragment>
          );
        })}

        <div className="flex-1" />

        {imageFileName && (
          <span className="text-xs text-slate-400 font-mono truncate max-w-40">{imageFileName}</span>
        )}

        {/* Show "view extractions" button when we have results but are in draw mode */}
        {step === 1 && step1View === 'draw' && extractedWidgets.length > 0 && (
          <button
            onClick={() => setStep1View('extraction')}
            className="ml-1 flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 transition-colors"
          >
            <CheckCircle2 size={11} /> View {extractedWidgets.length} extracted widget{extractedWidgets.length !== 1 ? 's' : ''}
          </button>
        )}

        {imageUrl && (
          <button
            onClick={handleReset}
            className="ml-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <RotateCcw size={11} /> Start over
          </button>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* Step 0 — Upload */}
        {step === 0 && (
          <UploadStep onImageReady={handleImageReady} onUseSample={handleUseSample} />
        )}

        {/* Step 1 — Red-border detection → extraction results → manual draw */}
        {step === 1 && imageUrl && (
          <>

          {/* 1a — Detecting */}
          {step1View === 'detecting' && (
            <div className="flex flex-col items-center justify-center h-full gap-3 bg-white dark:bg-slate-900">
              <Loader2 size={30} className="animate-spin text-indigo-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Scanning for red-bordered widgets…
              </p>
              <p className="text-xs text-slate-400">Analysing pixel data — this takes a moment for large images.</p>
            </div>
          )}

          {/* 1b — Extraction results */}
          {step1View === 'extraction' && extractedMeta && (
            <WidgetExtractionPanel
              widgets={extractedWidgets}
              imageWidth={extractedMeta.width}
              imageHeight={extractedMeta.height}
              fileName={imageFileName}
              onContinue={() => setStep1View('draw')}
            />
          )}

          {/* 1c — Manual draw interface */}
          {step1View === 'draw' && (
          <div className="flex h-full overflow-hidden">
            {/* Region list (left panel) */}
            <div style={{ width: drawListW }} className="relative shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
              <ResizeHandle handleProps={drawListH} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10" />
              <RegionList
                regions={regions}
                selectedRegionId={selectedId}
                onSelect={setSelectedId}
                onRename={(id, name) => handleRegionUpdate(id, { name })}
                onDelete={handleRegionDelete}
                onClearAll={handleClearAll}
              />
            </div>

            {/* Canvas (center — takes remaining space) */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Step action bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoDetect}
                    onChange={handleToggleAutoDetect}
                    className="rounded accent-indigo-600"
                  />
                  <Sparkles size={11} className="text-indigo-400" />
                  Auto-detect regions
                </label>
                <div className="flex-1" />
                <button
                  onClick={() => { if (regions.length === 0 && !confirm('No regions drawn yet. Continue anyway?')) return; setStep(2); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Analyse <ChevronRight size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RegionCanvas
                  imageUrl={imageUrl}
                  regions={regions}
                  selectedRegionId={selectedId}
                  onRegionCreate={handleRegionCreate}
                  onRegionUpdate={handleRegionUpdate}
                  onRegionSelect={setSelectedId}
                />
              </div>
            </div>

            {/* Region editor (right panel) */}
            <div style={{ width: drawEditorW }} className="relative shrink-0 border-l border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
              <ResizeHandle handleProps={drawEditorH} className="absolute top-0 left-0 h-full w-1.5 cursor-col-resize z-10" />
              {selectedRegion ? (
                <>
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Edit Region</p>
                  </div>
                  <div className="overflow-y-auto h-full pb-8">
                    <RegionEditor
                      region={selectedRegion}
                      onUpdate={handleRegionUpdate}
                      onDelete={handleRegionDelete}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <MapPin size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">Select a region to edit its properties.</p>
                </div>
              )}
            </div>
          </div>
          )}
          </>
        )}

        {/* Step 2 — Analyse */}
        {step === 2 && (
          <AnalyseStep
            regions={regions}
            autoDetectMode={autoDetect}
            onToggleAutoDetect={handleToggleAutoDetect}
            onRunAnalysis={runAnalysis}
            analysing={analysing}
            analysisResults={analysisResults}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {/* Step 3 — Map & Export */}
        {step === 3 && (
          <MapExportStep
            regions={regions}
            selectedRegionId={selectedId}
            onSelectRegion={setSelectedId}
            onUpdateMapping={handleUpdateMapping}
            onBack={() => setStep(2)}
          />
        )}
      </div>

      {ToastEl}
    </div>
  );
});
