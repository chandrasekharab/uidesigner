'use client';

// ─── Schema-Aware Design-to-Pega Generator ───────────────────────────────────
// A 3-panel experience where users provide BOTH a design input (image/Figma/
// describe) AND a schema context (upload JSON, paste, or pick a template).
// The pipeline uses the schema to ground every detected component, producing
// a Pega Constellation View JSON that is aligned to real schema definitions.
//
// Panel layout:
//  LEFT  : Design input + Schema input + pipeline controls
//  CENTER: Detection canvas with schema-mapping overlays
//  RIGHT : Generated JSON + schema validation results + mapping explanations

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload,
  ImageIcon,
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
  FileJson,
  ShieldCheck,
  BookOpen,
  Info,
  Sparkles,
  FileCode2,
  ChevronDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  ArrowUpRight,
  Bookmark,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { parseDesignInput } from '@/services/designParser';
import { generatePegaMetadata } from '@/services/pegaMetadataGenerator';
import { generateSchemaAwareMetadata } from '@/services/pegaMetadataGenerator';
import type { SchemaAwareMetadata } from '@/services/pegaMetadataGenerator';
import {
  parseSchemaJSON,
  buildMappingTable,
  validateAgainstSchema,
  mergeSchemaContexts,
} from '@/services/schemaContextService';
import type {
  SchemaContext,
  SchemaValidationResult,
  SchemaMapping,
} from '@/services/schemaContextService';
import {
  detectUIFromImage,
  mapDesignToSchema,
  suggestBestComponentMatch,
} from '@/services/aiService';
import { useBuilderStore } from '@/store/builderStore';
import type { ParsedDesign, DetectedComponent } from '@/services/designParser';
import type { PegaConstellationMetadata } from '@/services/pegaMetadataGenerator';
import { DetectionOverlay } from '@/components/design/DetectionOverlay';
import { MOCK_DETECTION_SCENARIOS } from '@/data/mockDesignSamples';
import type { MockScenario } from '@/data/mockDesignSamples';
import { SAMPLE_SCHEMAS } from '@/data/sampleSchemas';
import type { SampleSchema } from '@/data/sampleSchemas';

// ─── Local types ──────────────────────────────────────────────────────────────

type InputMode = 'upload' | 'figma' | 'describe';
type SchemaInputMode = 'template' | 'upload' | 'paste';
type PipelineStep =
  | 'idle'
  | 'loading-schema'
  | 'detecting'
  | 'aligning'
  | 'generating'
  | 'validating'
  | 'done'
  | 'error';
type RightTab = 'json' | 'validation' | 'mappings';

interface OverrideMap {
  [componentId: string]: Partial<DetectedComponent>;
}

interface MappingOverride {
  [componentId: string]: { schemaType: string; schemaLabel: string; confidence?: number };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const SchemaAwareExperience = memo(function SchemaAwareExperience() {
  // ── Design input state ────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [describeText, setDescribeText] = useState('');
  const [useAI, setUseAI] = useState(false);

  // ── Schema input state ────────────────────────────────────────────────────
  const [schemaInputMode, setSchemaInputMode] = useState<SchemaInputMode>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<SampleSchema | null>(SAMPLE_SCHEMAS[0]);
  const [schemaFile, setSchemaFile] = useState<File | null>(null);
  const [schemaPaste, setSchemaPaste] = useState('');
  const [schemaContext, setSchemaContext] = useState<SchemaContext | null>(
    // Pre-load first template
    () => parseSchemaJSON(SAMPLE_SCHEMAS[0].json, SAMPLE_SCHEMAS[0].label)
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // ── Pipeline state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<PipelineStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parsedDesign, setParsedDesign] = useState<ParsedDesign | null>(null);
  const [pegaMetadata, setPegaMetadata] = useState<PegaConstellationMetadata | null>(null);
  const [mappingTable, setMappingTable] = useState<Map<string, SchemaMapping>>(new Map());
  const [validationResult, setValidationResult] = useState<SchemaValidationResult | null>(null);
  const [isMockResult, setIsMockResult] = useState(false);
  const [schemaAwareEnabled, setSchemaAwareEnabled] = useState(true);

  // ── Overlay / selection state ─────────────────────────────────────────────
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [componentOverrides, setComponentOverrides] = useState<OverrideMap>({});
  const [mappingOverrides, setMappingOverrides] = useState<MappingOverride>({});

  // ── Right panel state ─────────────────────────────────────────────────────
  const [rightTab, setRightTab] = useState<RightTab>('json');
  const [copied, setCopied] = useState(false);

  const designFileInputRef = useRef<HTMLInputElement>(null);
  const schemaFileInputRef = useRef<HTMLInputElement>(null);

  const setAppMode = useBuilderStore((s) => s.setAppMode);
  const setPendingTransformJSON = useBuilderStore((s) => s.setPendingTransformJSON);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  // ── Schema loading ────────────────────────────────────────────────────────

  const loadSchemaFromTemplate = useCallback((template: SampleSchema) => {
    try {
      setSelectedTemplate(template);
      const ctx = parseSchemaJSON(template.json, template.label);
      setSchemaContext(ctx);
      setSchemaError(null);
    } catch (e) {
      setSchemaError(`Failed to parse template: ${(e as Error).message}`);
    }
  }, []);

  const loadSchemaFromFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const ctx = parseSchemaJSON(json, file.name.replace(/\.json$/i, ''));
      setSchemaContext(ctx);
      setSchemaFile(file);
      setSchemaError(null);
    } catch (e) {
      setSchemaError(`Invalid JSON file: ${(e as Error).message}`);
    }
  }, []);

  const loadSchemaFromPaste = useCallback((raw: string) => {
    setSchemaPaste(raw);
    if (!raw.trim()) {
      setSchemaContext(null);
      return;
    }
    try {
      const json = JSON.parse(raw);
      const ctx = parseSchemaJSON(json, 'Pasted Schema');
      setSchemaContext(ctx);
      setSchemaError(null);
    } catch (e) {
      setSchemaError(`JSON parse error: ${(e as Error).message}`);
    }
  }, []);

  // ── Design input handlers ─────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a PNG or JPG image file.');
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setUploadedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError(null);
    setParsedDesign(null);
    setPegaMetadata(null);
    setMappingTable(new Map());
    setValidationResult(null);
    setSelectedCompId(null);
    setStep('idle');
  }, [imagePreviewUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleReset = useCallback(() => {
    setUploadedFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setFigmaUrl('');
    setDescribeText('');
    setParsedDesign(null);
    setPegaMetadata(null);
    setMappingTable(new Map());
    setValidationResult(null);
    setComponentOverrides({});
    setMappingOverrides({});
    setError(null);
    setStep('idle');
    setIsMockResult(false);
    setSelectedCompId(null);
  }, [imagePreviewUrl]);

  // ── Pipeline runner ───────────────────────────────────────────────────────

  const runPipeline = useCallback(
    async (design?: ParsedDesign) => {
      setError(null);
      setComponentOverrides({});
      setMappingOverrides({});

      try {
        let resolvedDesign = design;

        if (!resolvedDesign) {
          // Step 1: Parse design
          setStep('detecting');
          if (inputMode === 'upload' && uploadedFile) {
            if (useAI) {
              const r = await detectUIFromImage(uploadedFile);
              resolvedDesign = r.design;
              setIsMockResult(r.mock);
            } else {
              resolvedDesign = await parseDesignInput(uploadedFile);
              setIsMockResult(resolvedDesign.mock);
            }
          } else if (inputMode === 'figma') {
            resolvedDesign = await parseDesignInput({ fileUrl: figmaUrl });
            setIsMockResult(resolvedDesign.mock);
          } else {
            setError('Please provide a design input.');
            setStep('error');
            return;
          }
          setParsedDesign(resolvedDesign);
        }

        // Step 2: Schema alignment
        let alignedDesign = resolvedDesign;
        let newMappingTable = new Map<string, SchemaMapping>();

        if (schemaAwareEnabled && schemaContext) {
          setStep('aligning');
          await new Promise((r) => setTimeout(r, 300)); // UX delay
          const alignResult = await mapDesignToSchema(resolvedDesign, schemaContext, useAI);
          alignedDesign = alignResult.refinedDesign;
          newMappingTable = alignResult.mappings;
        } else if (schemaContext) {
          newMappingTable = buildMappingTable(resolvedDesign.components, schemaContext);
        }

        setMappingTable(newMappingTable);

        // Step 3: Generate Pega metadata
        setStep('generating');
        await new Promise((r) => setTimeout(r, 200)); // UX delay

        let metadata: PegaConstellationMetadata;
        if (schemaAwareEnabled && schemaContext) {
          metadata = generateSchemaAwareMetadata(alignedDesign, schemaContext, { useSchemaLayout: true });
        } else {
          metadata = generatePegaMetadata(alignedDesign);
        }
        setPegaMetadata(metadata);

        // Step 4: Validate
        if (schemaContext) {
          setStep('validating');
          await new Promise((r) => setTimeout(r, 200));
          const validation = validateAgainstSchema(metadata, schemaContext);
          setValidationResult(validation);
        }

        setStep('done');
      } catch (err) {
        setError((err as Error).message ?? 'Pipeline failed');
        setStep('error');
      }
    },
    [inputMode, uploadedFile, figmaUrl, useAI, schemaAwareEnabled, schemaContext]
  );

  const handleLoadSample = useCallback(
    async (scenarioId: MockScenario) => {
      setError(null);
      setUploadedFile(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      setParsedDesign(null);
      setPegaMetadata(null);
      setMappingTable(new Map());
      setValidationResult(null);
      setSelectedCompId(null);
      setStep('detecting');

      await new Promise((r) => setTimeout(r, 400));

      const s = MOCK_DETECTION_SCENARIOS[scenarioId];
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

      await runPipeline(design);
    },
    [imagePreviewUrl, runPipeline]
  );

  const handleComponentMappingOverride = useCallback(
    async (compId: string) => {
      if (!parsedDesign || !schemaContext) return;
      const comp = parsedDesign.components.find((c) => c.id === compId);
      if (!comp) return;
      const result = await suggestBestComponentMatch(comp, schemaContext);
      setMappingOverrides((prev) => ({
        ...prev,
        [compId]: { schemaType: result.schemaType, schemaLabel: result.schemaLabel },
      }));
    },
    [parsedDesign, schemaContext]
  );

  const handleCopyJSON = useCallback(async () => {
    if (!pegaMetadata) return;
    const { _mappings, _schemaName, ...clean } = pegaMetadata as SchemaAwareMetadata & { _mappings?: unknown; _schemaName?: unknown };
    void _mappings; void _schemaName; // suppress unused var warning
    await navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pegaMetadata]);

  const handleSendToTransform = useCallback(() => {
    if (!pegaMetadata) return;
    const { _mappings, _schemaName, ...clean } =
      (pegaMetadata as unknown as Record<string, unknown>);
    void _mappings; void _schemaName;
    setPendingTransformJSON(JSON.stringify(clean, null, 2));
    setAppMode('transform');
  }, [pegaMetadata, setPendingTransformJSON, setAppMode]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isRunnable =
    (inputMode === 'upload' && uploadedFile !== null) ||
    (inputMode === 'figma' && figmaUrl.trim().length > 0);

  const isRunning = ['detecting', 'aligning', 'generating', 'validating', 'loading-schema'].includes(step);

  const effectiveComponents = parsedDesign?.components.map((c) =>
    componentOverrides[c.id] ? { ...c, ...componentOverrides[c.id] } : c
  ) ?? [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
      <aside className="w-80 min-w-[272px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={12} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Schema-Aware Generator
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-8">
            Design + Schema → Grounded Pega JSON
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── SECTION A: Design Input ───────────────────────────────── */}
          <div className="px-4 pt-3 pb-1">
            <SectionLabel icon={<ImageIcon size={10} />} label="Design Input" />

            {/* Input mode tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 mb-3 mt-2">
              {(
                [
                  { id: 'upload', label: 'Image', icon: <Upload size={10} /> },
                  { id: 'figma',  label: 'Figma',  icon: <Figma size={10} /> },
                ] as { id: InputMode; label: string; icon: React.ReactNode }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setInputMode(tab.id); setError(null); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition-all',
                    inputMode === tab.id
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  )}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {inputMode === 'upload' && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => designFileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer transition-all',
                  uploadedFile
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                )}
              >
                {uploadedFile ? (
                  <>
                    <CheckCircle2 size={24} className="text-emerald-600" />
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 text-center truncate max-w-full">{uploadedFile.name}</p>
                    <button className="text-[10px] text-slate-500 hover:text-red-500 flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                    ><X size={9} /> Remove</button>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon size={16} className="text-slate-400" />
                    </div>
                    <p className="text-[10px] text-center text-slate-600 dark:text-slate-300 font-medium">
                      Drop image or click
                    </p>
                    <p className="text-[9px] text-slate-400">PNG, JPG</p>
                  </>
                )}
              </div>
            )}

            {inputMode === 'figma' && (
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/file/..."
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            )}

            <input ref={designFileInputRef} type="file" accept="image/png,image/jpeg" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

            {/* AI toggle */}
            <div className="flex items-center gap-2 mt-2 select-none">
              <button
                type="button" role="switch" aria-checked={useAI}
                onClick={() => setUseAI((v) => !v)}
                className={cn(
                  'w-8 h-4 rounded-full relative transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-400',
                  useAI ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all"
                  style={{ left: useAI ? '17px' : '2px' }} />
              </button>
              <span className="text-[10px] text-slate-600 dark:text-slate-300 cursor-pointer" onClick={() => setUseAI((v) => !v)}>
                Use AI Detection
              </span>
              <span className={cn('ml-auto text-[9px] px-1.5 py-0.5 rounded font-semibold',
                useAI ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400')}>
                {useAI ? 'AI' : 'Mock'}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-slate-100 dark:border-slate-800" />

          {/* ── SECTION B: Schema Input ───────────────────────────────── */}
          <div className="px-4 pb-1">
            <div className="flex items-center justify-between mb-2">
              <SectionLabel icon={<FileJson size={10} />} label="Schema Context" />
              {/* Schema-aware toggle */}
              <div className="flex items-center gap-1.5 select-none">
                <button
                  type="button" role="switch" aria-checked={schemaAwareEnabled}
                  onClick={() => setSchemaAwareEnabled((v) => !v)}
                  className={cn(
                    'w-7 h-3.5 rounded-full relative transition-colors shrink-0',
                    schemaAwareEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                >
                  <span className="absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all"
                    style={{ left: schemaAwareEnabled ? '14px' : '2px' }} />
                </button>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">Schema-guided</span>
              </div>
            </div>

            {/* Schema input mode tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 mb-2">
              {(
                [
                  { id: 'template', label: 'Template' },
                  { id: 'upload',   label: 'Upload' },
                  { id: 'paste',    label: 'Paste' },
                ] as { id: SchemaInputMode; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSchemaInputMode(tab.id)}
                  className={cn(
                    'flex-1 py-1 rounded-md text-[9px] font-semibold transition-all',
                    schemaInputMode === tab.id
                      ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Template picker */}
            {schemaInputMode === 'template' && (
              <div className="space-y-1">
                {SAMPLE_SCHEMAS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSchemaFromTemplate(s)}
                    className={cn(
                      'w-full flex items-start gap-2 px-2 py-2 rounded-lg text-left transition-colors border text-[10px]',
                      selectedTemplate?.id === s.id
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center',
                      selectedTemplate?.id === s.id ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                    )}>
                      {selectedTemplate?.id === s.id
                        ? <CheckCircle2 size={9} className="text-white" />
                        : <BookOpen size={9} className="text-slate-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight truncate">{s.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-tight line-clamp-1">{s.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* File upload */}
            {schemaInputMode === 'upload' && (
              <div
                onClick={() => schemaFileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all',
                  schemaFile
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                )}
              >
                {schemaFile ? (
                  <>
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 truncate max-w-full">{schemaFile.name}</p>
                    <p className="text-[9px] text-slate-400">
                      {schemaContext?.fieldDefs.size ?? 0} field defs · {schemaContext?.componentTypes.length ?? 0} types
                    </p>
                  </>
                ) : (
                  <>
                    <FileJson size={20} className="text-slate-400" />
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Upload schema JSON</p>
                  </>
                )}
                <input ref={schemaFileInputRef} type="file" accept=".json,application/json" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) loadSchemaFromFile(f); }} />
              </div>
            )}

            {/* Paste */}
            {schemaInputMode === 'paste' && (
              <textarea
                value={schemaPaste}
                onChange={(e) => loadSchemaFromPaste(e.target.value)}
                placeholder={'{\n  "view": {\n    "type": "form",\n    "name": "MyView",\n    "regions": [...]\n  }\n}'}
                rows={7}
                className="w-full px-2 py-2 text-[10px] font-mono border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
            )}

            {/* Schema status badge */}
            {schemaContext && !schemaError && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck size={10} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">{schemaContext.name}</p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400">
                    {schemaContext.componentTypes.length} types · {schemaContext.fieldDefs.size} fields
                    {schemaContext.version ? ` · v${schemaContext.version}` : ''}
                  </p>
                </div>
              </div>
            )}

            {schemaError && (
              <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle size={10} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[9px] text-red-600 dark:text-red-400">{schemaError}</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-slate-100 dark:border-slate-800" />

          {/* Pipeline Progress */}
          {step !== 'idle' && (
            <div className="px-4 mb-1">
              <SchemaPipelineProgress step={step} isMock={isMockResult} />
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mx-4 mb-2 flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle size={11} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Sample Quick-Start */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
              Quick start with sample
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'login', label: 'Login' },
                  { id: 'form',  label: 'Contact Form' },
                  { id: 'registration', label: 'Registration' },
                  { id: 'dashboard', label: 'Dashboard' },
                ] as { id: MockScenario; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  disabled={isRunning}
                  onClick={() => handleLoadSample(s.id)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Wand2 size={9} />{s.label}
                </button>
              ))}
            </div>
          </div>

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
          <button
            onClick={() => runPipeline()}
            disabled={!isRunnable || isRunning}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              isRunnable && !isRunning
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            )}
          >
            {isRunning ? (
              <><Loader2 size={14} className="animate-spin" />{stepLabel(step)}</>
            ) : (
              <><ShieldCheck size={14} /> Run Schema Pipeline</>
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

      {/* ── CENTER PANEL: Detection Canvas ──────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">

        {/* Canvas header */}
        <div className="h-10 flex items-center px-4 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <Layers size={13} className="text-emerald-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {parsedDesign ? parsedDesign.title : 'Detection Canvas'}
          </span>
          {parsedDesign && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {parsedDesign.components.length} components
            </span>
          )}
          {schemaContext && parsedDesign && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">
              {schemaContext.name}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {parsedDesign && (
              <button
                onClick={() => setShowOverlay((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {showOverlay ? <EyeOff size={11} /> : <Eye size={11} />}
                Overlays
              </button>
            )}
          </div>
        </div>

        {/* Canvas body */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-start gap-4">
          {isRunning && <SchemaDetectionLoader step={step} />}

          {!isRunning && (
            <>
              {imagePreviewUrl && inputMode === 'upload' && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl} alt="Uploaded design"
                    className="max-w-full max-h-[calc(100vh-200px)] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 block"
                    style={{ objectFit: 'contain' }}
                  />
                  {showOverlay && parsedDesign && (
                    <DetectionOverlay
                      components={effectiveComponents}
                      selectedId={selectedCompId}
                      onSelect={setSelectedCompId}
                      onUpdate={(id, upd) =>
                        setComponentOverrides((p) => ({ ...p, [id]: { ...p[id], ...upd } }))}
                    />
                  )}
                </div>
              )}

              {parsedDesign && !imagePreviewUrl && (
                <SchemaMockCanvas
                  design={parsedDesign}
                  effectiveComponents={effectiveComponents}
                  mappingTable={mappingTable}
                  showOverlay={showOverlay}
                  selectedId={selectedCompId}
                  onSelect={setSelectedCompId}
                  onUpdate={(id, upd) =>
                    setComponentOverrides((p) => ({ ...p, [id]: { ...p[id], ...upd } }))}
                  onRemap={handleComponentMappingOverride}
                />
              )}

              {!parsedDesign && !imagePreviewUrl && <SchemaEmptyState />}
            </>
          )}
        </div>

        {/* Selected component mapping detail */}
        {selectedCompId && parsedDesign && (
          <MappingDetailStrip
            component={effectiveComponents.find((c) => c.id === selectedCompId) ?? null}
            mapping={mappingTable.get(selectedCompId) ?? null}
            schemaContext={schemaContext}
            override={mappingOverrides[selectedCompId]}
            onRemap={() => handleComponentMappingOverride(selectedCompId)}
          />
        )}
      </main>

      {/* ── RIGHT PANEL: Output ──────────────────────────────────────────── */}
      <aside className="w-[380px] min-w-[300px] flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

        {/* Right panel header */}
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <FileCode2 size={10} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">
            Schema-Aligned Output
          </h2>
          {pegaMetadata && (
            <button
              onClick={handleCopyJSON}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? <CheckCircle2 size={11} className="text-green-500" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
          {(
            [
              { id: 'json', label: 'JSON', icon: <FileCode2 size={10} /> },
              { id: 'validation', label: 'Validation', icon: <ShieldCheck size={10} /> },
              { id: 'mappings', label: 'Mappings', icon: <ArrowUpRight size={10} /> },
            ] as { id: RightTab; label: string; icon: React.ReactNode }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold transition-colors border-b-2',
                rightTab === tab.id
                  ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {tab.icon}{tab.label}
              {tab.id === 'validation' && validationResult && (
                <span className={cn(
                  'ml-0.5 text-[8px] px-1 rounded-full font-bold',
                  validationResult.errors.length > 0
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                    : validationResult.warnings.length > 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                )}>
                  {validationResult.errors.length > 0
                    ? validationResult.errors.length
                    : validationResult.warnings.length > 0
                    ? validationResult.warnings.length
                    : '✓'}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto">
          {rightTab === 'json' && (
            pegaMetadata ? (
              <SyntaxJSON json={pegaMetadata} />
            ) : (
              <EmptyTabState icon={<FileCode2 size={24} />} label="Pega JSON" hint="Run the pipeline to generate schema-aligned JSON" />
            )
          )}

          {rightTab === 'validation' && (
            validationResult ? (
              <ValidationPanel result={validationResult} />
            ) : (
              <EmptyTabState icon={<ShieldCheck size={24} />} label="Validation" hint="Run the pipeline to validate against schema" />
            )
          )}

          {rightTab === 'mappings' && (
            mappingTable.size > 0 && parsedDesign ? (
              <MappingsPanel
                components={effectiveComponents}
                mappingTable={mappingTable}
                selectedId={selectedCompId}
                onSelect={setSelectedCompId}
                onRemap={handleComponentMappingOverride}
              />
            ) : (
              <EmptyTabState icon={<ArrowUpRight size={24} />} label="Mappings" hint="Run the pipeline to see how each UI element maps to schema" />
            )
          )}
        </div>

        {/* Action footer */}
        {pegaMetadata && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {validationResult && (
              <SchemaScoreBadge score={validationResult.score} schemaName={schemaContext?.name ?? ''} />
            )}
            <button
              onClick={handleSendToTransform}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all"
            >
              <ArrowRight size={14} /> Transform to Target Schema
            </button>
          </div>
        )}
      </aside>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function stepLabel(step: PipelineStep): string {
  const labels: Record<PipelineStep, string> = {
    idle: '',
    'loading-schema': 'Loading…',
    detecting: 'Detecting…',
    aligning: 'Aligning…',
    generating: 'Generating…',
    validating: 'Validating…',
    done: 'Done',
    error: 'Error',
  };
  return labels[step] ?? step;
}

// ─── Schema Detection Loader ─────────────────────────────────────────────────

const STEP_DESCS: Partial<Record<PipelineStep, { title: string; subtitle: string }>> = {
  'loading-schema': { title: 'Loading schema context…', subtitle: 'Parsing field definitions and component types' },
  detecting: { title: 'Detecting UI components…', subtitle: 'Analysing layout, zones & text via OCR' },
  aligning: { title: 'Aligning with schema…', subtitle: 'Matching detections to schema definitions' },
  generating: { title: 'Generating Pega JSON…', subtitle: 'Building schema-grounded Constellation metadata' },
  validating: { title: 'Validating output…', subtitle: 'Checking alignment against schema rules' },
};

function SchemaDetectionLoader({ step }: { step: PipelineStep }) {
  const desc = STEP_DESCS[step] ?? { title: 'Processing…', subtitle: '' };
  return (
    <div className="flex flex-col items-center gap-5 py-10">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <ShieldCheck size={24} className="text-emerald-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow">
          <Loader2 size={11} className="animate-spin text-emerald-600" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{desc.title}</p>
        <p className="text-xs text-slate-400 mt-1">{desc.subtitle}</p>
      </div>
      <div className="w-56 space-y-2">
        {[0.9, 0.65, 0.8, 0.5, 0.75].map((w, i) => (
          <div key={i} className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"
            style={{ width: `${w * 100}%`, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Schema Mock Canvas ───────────────────────────────────────────────────────

function SchemaMockCanvas({
  design, effectiveComponents, mappingTable, showOverlay,
  selectedId, onSelect, onUpdate, onRemap,
}: {
  design: ParsedDesign;
  effectiveComponents: DetectedComponent[];
  mappingTable: Map<string, SchemaMapping>;
  showOverlay: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, upd: Partial<DetectedComponent>) => void;
  onRemap: (id: string) => void;
}) {
  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-2">
      <div
        className="relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
        style={{ paddingBottom: '130%' }}
        onClick={() => onSelect(null)}
      >
        {/* Chrome strip */}
        <div className="absolute top-0 inset-x-0 h-7 bg-slate-100 dark:bg-slate-700 rounded-t-2xl flex items-center px-3 gap-1.5 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="flex-1 mx-2 h-3 rounded bg-slate-200 dark:bg-slate-600 text-[8px] text-slate-400 flex items-center px-2">
            {design.title}
          </span>
        </div>

        {/* Content area */}
        <div className="absolute inset-0 top-7 rounded-b-2xl overflow-hidden">
          <div className="absolute inset-0 bg-slate-50 dark:bg-slate-850"
            style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          {showOverlay ? (
            <DetectionOverlay
              components={effectiveComponents}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdate={onUpdate}
            />
          ) : (
            <div className="absolute inset-0 p-3 flex flex-col gap-1.5 overflow-hidden">
              {effectiveComponents.slice(0, 14).map((comp) => {
                const mapping = mappingTable.get(comp.id);
                return (
                  <div
                    key={comp.id}
                    onClick={(e) => { e.stopPropagation(); onSelect(comp.id === selectedId ? null : comp.id); }}
                    className={cn(
                      'flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-medium truncate cursor-pointer shrink-0',
                      comp.id === selectedId
                        ? 'ring-1 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : schemaBadgeColor(comp.type)
                    )}
                  >
                    <span className="flex-1 truncate">{comp.label || comp.type}</span>
                    {mapping && (
                      <span className="text-[8px] opacity-70 shrink-0">→ {mapping.schemaType}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400">Click a component to inspect its schema mapping</p>
    </div>
  );
}

// ─── Mapping detail strip ─────────────────────────────────────────────────────

function MappingDetailStrip({
  component, mapping, schemaContext, override, onRemap,
}: {
  component: DetectedComponent | null;
  mapping: SchemaMapping | null;
  schemaContext: SchemaContext | null;
  override?: { schemaType: string; schemaLabel: string; confidence?: number };
  onRemap: () => void;
}) {
  if (!component) return null;
  const activeMapping = override ?? mapping;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold', schemaBadgeColor(component.type))}>
              {component.type}
            </span>
            <ChevronRight size={10} className="text-slate-400" />
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              {activeMapping?.schemaType ?? 'unmatched'}
            </span>
            {activeMapping && (
              <span className={cn(
                'text-[8px] px-1 py-0.5 rounded font-semibold',
                (activeMapping.confidence ?? 0) >= 0.8
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : (activeMapping.confidence ?? 0) >= 0.6
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'
              )}>
                {Math.round((activeMapping.confidence ?? 0) * 100)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            {mapping?.explanation ?? 'No explanation available'}
          </p>
        </div>
        <div className="ml-auto flex flex-col gap-1">
          {schemaContext && (
            <button
              onClick={onRemap}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <RefreshCw size={8} /> Re-map
            </button>
          )}
        </div>
      </div>
      {mapping?.alternatives && mapping.alternatives.length > 0 && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[9px] text-slate-400">Alternatives:</span>
          {mapping.alternatives.map((alt) => (
            <span key={alt.schemaType}
              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              {alt.schemaType} ({Math.round(alt.confidence * 100)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Schema Pipeline Progress ─────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{ id: PipelineStep; label: string }> = [
  { id: 'loading-schema', label: 'Load Schema' },
  { id: 'detecting', label: 'Detect Components' },
  { id: 'aligning', label: 'Schema Alignment' },
  { id: 'generating', label: 'Generate JSON' },
  { id: 'validating', label: 'Validate' },
  { id: 'done', label: 'Complete' },
];

function SchemaPipelineProgress({ step, isMock }: { step: PipelineStep; isMock: boolean }) {
  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Pipeline</p>
      <div className="space-y-1">
        {PIPELINE_STEPS.map((s, idx) => {
          const done = step === 'done' || (currentIdx > idx && step !== 'error');
          const active = s.id === step;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                'w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[7px] font-bold',
                done ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40'
                     : active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 animate-pulse'
                     : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
              )}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={cn(
                'text-[9px]',
                done ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                     : active ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                     : 'text-slate-400'
              )}>{s.label}</span>
            </div>
          );
        })}
      </div>
      {step === 'done' && isMock && (
        <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-700">
          ⚠ Mock mode
        </p>
      )}
    </div>
  );
}

// ─── Validation Panel ─────────────────────────────────────────────────────────

function ValidationPanel({ result }: { result: SchemaValidationResult }) {
  const [expandSection, setExpandSection] = useState<'errors' | 'warnings' | 'suggestions' | null>(
    result.errors.length > 0 ? 'errors' : result.warnings.length > 0 ? 'warnings' : 'suggestions'
  );

  return (
    <div className="p-3 space-y-2">
      {/* Score bar */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Schema Alignment Score</span>
          <span className={cn(
            'text-sm font-bold',
            result.score >= 80 ? 'text-emerald-600' : result.score >= 50 ? 'text-amber-600' : 'text-red-600'
          )}>
            {result.score}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              result.score >= 80 ? 'bg-emerald-500' : result.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <CollapsibleIssueGroup
          icon={<XCircle size={11} className="text-red-500" />}
          label={`${result.errors.length} Error${result.errors.length > 1 ? 's' : ''}`}
          color="text-red-600 dark:text-red-400"
          open={expandSection === 'errors'}
          onToggle={() => setExpandSection(expandSection === 'errors' ? null : 'errors')}
          issues={result.errors}
        />
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <CollapsibleIssueGroup
          icon={<AlertTriangle size={11} className="text-amber-500" />}
          label={`${result.warnings.length} Warning${result.warnings.length > 1 ? 's' : ''}`}
          color="text-amber-600 dark:text-amber-400"
          open={expandSection === 'warnings'}
          onToggle={() => setExpandSection(expandSection === 'warnings' ? null : 'warnings')}
          issues={result.warnings}
        />
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <CollapsibleIssueGroup
          icon={<Lightbulb size={11} className="text-blue-500" />}
          label={`${result.suggestions.length} Suggestion${result.suggestions.length > 1 ? 's' : ''}`}
          color="text-blue-600 dark:text-blue-400"
          open={expandSection === 'suggestions'}
          onToggle={() => setExpandSection(expandSection === 'suggestions' ? null : 'suggestions')}
          issues={result.suggestions}
        />
      )}

      {result.errors.length === 0 && result.warnings.length === 0 && result.suggestions.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle size={14} className="text-emerald-600" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Output fully aligned with schema</p>
        </div>
      )}
    </div>
  );
}

function CollapsibleIssueGroup({
  icon, label, color, open, onToggle, issues,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  open: boolean;
  onToggle: () => void;
  issues: Array<{ path: string; message: string; schemaRef?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        {icon}
        <span className={cn('text-[10px] font-semibold flex-1 text-left', color)}>{label}</span>
        <ChevronDown size={10} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {issues.map((issue, i) => (
            <div key={i} className="px-3 py-2">
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">{issue.path}</p>
              <p className="text-[10px] text-slate-700 dark:text-slate-200">{issue.message}</p>
              {issue.schemaRef && (
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Schema: {issue.schemaRef}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mappings Panel ───────────────────────────────────────────────────────────

function MappingsPanel({
  components, mappingTable, selectedId, onSelect, onRemap,
}: {
  components: DetectedComponent[];
  mappingTable: Map<string, SchemaMapping>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemap: (id: string) => void;
}) {
  return (
    <div className="p-3 space-y-1.5">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
        How each detected component maps to the schema. Click a row to inspect.
      </p>
      {components.map((comp) => {
        const mapping = mappingTable.get(comp.id);
        const isSelected = comp.id === selectedId;
        return (
          <div
            key={comp.id}
            onClick={() => onSelect(isSelected ? null : comp.id)}
            className={cn(
              'flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer border transition-colors',
              isSelected
                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold', schemaBadgeColor(comp.type))}>
                  {comp.type}
                </span>
                <ChevronRight size={8} className="text-slate-400 shrink-0" />
                <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {mapping?.schemaType ?? '—'}
                </span>
                {mapping && (
                  <span className={cn(
                    'text-[8px] px-1 rounded font-semibold ml-auto',
                    mapping.confidence >= 0.8 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                    : mapping.confidence >= 0.6 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
                    : 'text-red-600 bg-red-50 dark:bg-red-900/30'
                  )}>
                    {Math.round(mapping.confidence * 100)}%
                  </span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {comp.label || '(no label)'} → {mapping?.explanation?.slice(0, 80) ?? ''}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemap(comp.id); }}
              className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-600 transition-colors shrink-0 mt-0.5"
              title="Re-map component"
            >
              <RefreshCw size={9} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Syntax-colored JSON viewer ───────────────────────────────────────────────

function SyntaxJSON({ json }: { json: unknown }) {
  // Strip internal metadata before display
  const { _mappings, _schemaName, ...displayJson } =
    (json as Record<string, unknown>);
  void _mappings; void _schemaName;
  const lines = JSON.stringify(displayJson, null, 2).split('\n');
  return (
    <div className="p-3 font-mono text-[10px] leading-relaxed select-text">
      {lines.map((rawLine, i) => {
        const trimmed = rawLine.trimStart();
        const indent = rawLine.length - trimmed.length;
        let cls = 'text-slate-700 dark:text-slate-300';
        if (trimmed.match(/^"[^"]+"\s*:/)) cls = 'text-blue-700 dark:text-blue-400';
        else if (trimmed.match(/^"/) && !trimmed.includes(':')) cls = 'text-green-700 dark:text-green-400';
        else if (trimmed.match(/^-?\d/) || ['true','false','null'].includes(trimmed.replace(/,$/, '')))
          cls = 'text-orange-600 dark:text-orange-400';
        else if (/^[{}\[\]]/.test(trimmed)) cls = 'text-slate-400 dark:text-slate-500';
        return (
          <div key={i} className={cls} style={{ paddingLeft: indent * 5 }}>{trimmed}</div>
        );
      })}
    </div>
  );
}

// ─── Schema score badge ───────────────────────────────────────────────────────

function SchemaScoreBadge({ score, schemaName }: { score: number; schemaName: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px]',
      score >= 80 ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800'
      : score >= 50 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
      : 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
    )}>
      <ShieldCheck size={12} className={score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'} />
      <span className="flex-1 text-slate-600 dark:text-slate-300 font-medium truncate">
        {schemaName}
      </span>
      <span className={cn(
        'font-bold shrink-0',
        score >= 80 ? 'text-emerald-700 dark:text-emerald-300'
        : score >= 50 ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-700 dark:text-red-400'
      )}>
        {score}% aligned
      </span>
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function SchemaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center py-16 px-8">
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
        <ShieldCheck size={28} className="text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Schema-Aware Generator</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Upload a design + select a schema, then run the pipeline to generate schema-grounded Pega Constellation JSON
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
        {['Schema Loading', 'Component Matching', 'Schema Validation', 'Mapping Explanations'].map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <ChevronRight size={9} className="text-emerald-500" />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyTabState({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6">
      <div className="opacity-20 text-slate-400 mb-3">{icon}</div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-[10px] mt-1 text-slate-400">{hint}</p>
    </div>
  );
}

// ─── Colour helper ────────────────────────────────────────────────────────────

function schemaBadgeColor(type: string): string {
  const map: Record<string, string> = {
    input:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    password: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    button:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    dropdown: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    checkbox: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    heading:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    text:     'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    card:     'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    table:    'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return map[type] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
}
