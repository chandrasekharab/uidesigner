// ─── Widget & Layout Mapping Configuration ────────────────────────────────────
// Maps Pega Constellation widget/layout types to intermediate canonical types
// and then to target output types (native UIComponent + Google A2UI).
//
// EXTENSIBILITY: To support a new widget, add an entry to WIDGET_MAPPINGS or
// LAYOUT_MAPPINGS. No code changes are required outside this file.

import type { CanonicalCategory, CanonicalType, LayoutConfig } from '@/types/canonical';

// ─── Widget Mapping Entry ─────────────────────────────────────────────────────

export interface WidgetMappingEntry {
  /** Pega Constellation component/region type string (may be a regex pattern) */
  pegaType: string;
  /** Regex to match Pega types — used when pegaType is not a simple string */
  pegaTypePattern?: RegExp;
  /** Intermediate canonical type this maps to */
  canonicalType: CanonicalType;
  /** Category for UI rendering and validation */
  category: CanonicalCategory;
  /** Native target ComponentType (for canvas preview) */
  nativeTargetType: string;
  /** Google A2UI SDK type string */
  a2uiType: string;
  /** Lucide icon name shown in mapping panel */
  icon: string;
  /** Short human-readable description */
  description: string;
  /** Default props emitted in the target output */
  defaultProps?: Record<string, unknown>;
  /** Default layout configuration (layout category only) */
  defaultLayoutConfig?: Partial<LayoutConfig>;
  /** Whether this widget requires a data source to function */
  requiresDataSource?: boolean;
  /** Pega class prefixes that this widget is typically used with */
  classHints?: string[];
}

// ─── Layout Mappings ──────────────────────────────────────────────────────────
// Ordered: more specific patterns must appear before broader ones.

export const LAYOUT_MAPPINGS: WidgetMappingEntry[] = [
  // ── Column layouts ─────────────────────────────────────────────────────────
  {
    pegaType: 'Region/twoColumn',
    canonicalType: 'TwoColumn',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'GridContainer',
    icon: 'Columns2',
    description: 'Two-column grid layout',
    defaultLayoutConfig: { layoutType: 'twoColumn', columns: 2, gap: 16 },
  },
  {
    pegaType: 'Region/threeColumn',
    canonicalType: 'ThreeColumn',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'GridContainer',
    icon: 'Columns3',
    description: 'Three-column grid layout',
    defaultLayoutConfig: { layoutType: 'threeColumn', columns: 3, gap: 16 },
  },
  {
    pegaType: 'Region/fourColumn',
    canonicalType: 'FourColumn',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'GridContainer',
    icon: 'LayoutGrid',
    description: 'Four-column grid layout',
    defaultLayoutConfig: { layoutType: 'fourColumn', columns: 4, gap: 12 },
  },
  {
    pegaType: 'Region/inline',
    canonicalType: 'InlineLayout',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'FlexContainer',
    icon: 'AlignHorizontalSpaceAround',
    description: 'Inline horizontal row layout',
    defaultLayoutConfig: { layoutType: 'inline', columns: 1, gap: 8 },
  },
  {
    pegaType: 'Region/stacked',
    canonicalType: 'SingleColumn',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'FlexContainer',
    icon: 'Rows3',
    description: 'Single-column stacked layout',
    defaultLayoutConfig: { layoutType: 'singleColumn', columns: 1, gap: 16 },
  },
  // ── Composite layouts ──────────────────────────────────────────────────────
  {
    pegaType: 'Region/tabs',
    canonicalType: 'TabsLayout',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'TabContainer',
    icon: 'PanelTop',
    description: 'Tabbed navigation layout',
    defaultLayoutConfig: { layoutType: 'tabs', collapsible: false },
    defaultProps: { variant: 'tabs' },
  },
  {
    pegaType: 'Region/accordion',
    canonicalType: 'AccordionLayout',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'AccordionContainer',
    icon: 'ChevronDownSquare',
    description: 'Collapsible accordion layout',
    defaultLayoutConfig: { layoutType: 'accordion', collapsible: true },
    defaultProps: { variant: 'accordion' },
  },
  {
    pegaType: 'Section',
    canonicalType: 'Section',
    category: 'layout',
    nativeTargetType: 'Container',
    a2uiType: 'Section',
    icon: 'SquareDashedBottom',
    description: 'Named section / field group',
    defaultLayoutConfig: { layoutType: 'section' },
  },
];

// ─── Widget Mappings ──────────────────────────────────────────────────────────

export const WIDGET_MAPPINGS: WidgetMappingEntry[] = [
  // ── Social / Collaboration ─────────────────────────────────────────────────
  {
    pegaType: 'pxPulse',
    canonicalType: 'PulseWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'Pulse',
    icon: 'MessageCircle',
    description: 'Pega Pulse — activity & discussion feed',
    requiresDataSource: true,
    classHints: ['Work-', 'Assign-'],
    defaultProps: { widgetType: 'pulse', label: 'Pulse' },
  },
  // ── Attachments ────────────────────────────────────────────────────────────
  {
    pegaType: 'pxAttachContent',
    canonicalType: 'AttachmentsWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'Attachments',
    icon: 'Paperclip',
    description: 'File attachment area',
    requiresDataSource: false,
    classHints: ['Work-'],
    defaultProps: { widgetType: 'attachments', label: 'Attachments', allowMultiple: true },
  },
  {
    pegaType: 'Attachments',
    canonicalType: 'AttachmentsWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'Attachments',
    icon: 'Paperclip',
    description: 'File attachment area',
    defaultProps: { widgetType: 'attachments', label: 'Attachments', allowMultiple: true },
  },
  // ── Process / Steps ────────────────────────────────────────────────────────
  {
    pegaType: 'pxProcessSteps',
    canonicalType: 'StepsWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'ProgressStepper',
    icon: 'ListChecks',
    description: 'Case stage / process stepper',
    requiresDataSource: true,
    defaultProps: { widgetType: 'steps', label: 'Steps', orientation: 'horizontal' },
  },
  {
    pegaType: 'Step',
    canonicalType: 'StepsWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'ProgressStepper',
    icon: 'ListChecks',
    description: 'Case stage / process stepper',
    defaultProps: { widgetType: 'steps', label: 'Steps', orientation: 'horizontal' },
  },
  // ── Data / Grid ────────────────────────────────────────────────────────────
  {
    pegaType: 'DataGrid',
    canonicalType: 'DataGrid',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'DataGrid',
    icon: 'Table',
    description: 'Tabular data grid / list view',
    requiresDataSource: true,
    defaultProps: { widgetType: 'datagrid', label: 'Data Grid', paginate: true },
  },
  {
    pegaType: 'pxDynGridView',
    canonicalType: 'DataGrid',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'DataGrid',
    icon: 'Table',
    description: 'Dynamic grid view',
    requiresDataSource: true,
    defaultProps: { widgetType: 'datagrid', label: 'Data Grid', paginate: true },
  },
  {
    pegaType: 'SimpleTable',
    canonicalType: 'DataGrid',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'DataGrid',
    icon: 'Table',
    description: 'Simple tabular data',
    defaultProps: { widgetType: 'datagrid', label: 'Table', paginate: false },
  },
  // ── Case Summary ───────────────────────────────────────────────────────────
  {
    pegaType: 'pxCaseSummary',
    canonicalType: 'CaseSummary',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'CaseSummary',
    icon: 'ClipboardList',
    description: 'Case summary header panel',
    requiresDataSource: true,
    classHints: ['Work-'],
    defaultProps: { widgetType: 'caseSummary', label: 'Case Summary' },
  },
  {
    pegaType: 'CaseSummary',
    canonicalType: 'CaseSummary',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'CaseSummary',
    icon: 'ClipboardList',
    description: 'Case summary header panel',
    defaultProps: { widgetType: 'caseSummary', label: 'Case Summary' },
  },
  // ── Rich Text ──────────────────────────────────────────────────────────────
  {
    pegaType: 'RichText',
    canonicalType: 'RichTextWidget',
    category: 'widget',
    nativeTargetType: 'Text',
    a2uiType: 'RichText',
    icon: 'FileText',
    description: 'Rich text / formatted HTML content',
    defaultProps: { widgetType: 'richtext', label: 'Rich Text', content: '' },
  },
  // ── Embedded View ──────────────────────────────────────────────────────────
  {
    pegaType: 'EmbeddedView',
    canonicalType: 'EmbeddedView',
    category: 'widget',
    nativeTargetType: 'Container',
    a2uiType: 'EmbeddedView',
    icon: 'FrameIcon',
    description: 'Embedded sub-view / harness',
    defaultProps: { widgetType: 'embeddedView', label: 'Embedded View' },
  },
];

// ─── Composite Lookup Maps ────────────────────────────────────────────────────

/** O(1) lookup: Pega type string → widget mapping */
export const WIDGET_TYPE_MAP = new Map<string, WidgetMappingEntry>(
  WIDGET_MAPPINGS.map((m) => [m.pegaType, m])
);

/** O(1) lookup: Pega type string → layout mapping */
export const LAYOUT_TYPE_MAP = new Map<string, WidgetMappingEntry>(
  LAYOUT_MAPPINGS.map((m) => [m.pegaType, m])
);

/** All registered Pega types handled by this config (widget + layout) */
export const ALL_EXTENDED_PEGA_TYPES = new Set<string>([
  ...WIDGET_MAPPINGS.map((m) => m.pegaType),
  ...LAYOUT_MAPPINGS.map((m) => m.pegaType),
]);

// ─── Layout-type → CanonicalType resolver ─────────────────────────────────────

/** Resolve a Pega Region's layout string value → canonical layout type */
export function resolveLayoutCanonicalType(
  layoutValue: string | undefined
): CanonicalType {
  if (!layoutValue) return 'SingleColumn';
  const norm = layoutValue.toLowerCase().trim();
  if (norm === 'twocolumn' || norm === 'two-column') return 'TwoColumn';
  if (norm === 'threecolumn' || norm === 'three-column') return 'ThreeColumn';
  if (norm === 'fourcolumn' || norm === 'four-column') return 'FourColumn';
  if (norm === 'inline' || norm === 'horizontal') return 'InlineLayout';
  if (norm === 'tabs') return 'TabsLayout';
  if (norm === 'accordion') return 'AccordionLayout';
  if (norm === 'stacked' || norm === 'singlecolumn' || norm === 'single-column') return 'SingleColumn';
  return 'SingleColumn';   // safe default
}

/** Resolve a canonical layout type → column count */
export function layoutTypeToColumns(type: CanonicalType): number {
  switch (type) {
    case 'TwoColumn':   return 2;
    case 'ThreeColumn': return 3;
    case 'FourColumn':  return 4;
    default:            return 1;
  }
}

// ─── Widget Detection Heuristics ──────────────────────────────────────────────
// Used by the design parser and schema detection when Pega type is not explicit.

export interface WidgetHint {
  /** Keywords in a region/section title that suggest this widget type */
  labelKeywords: string[];
  /** Child component types that indicate this widget */
  childTypePatterns: string[];
  /** Canonical type to suggest */
  canonicalType: CanonicalType;
  confidence: number;
}

export const WIDGET_DETECTION_HINTS: WidgetHint[] = [
  {
    labelKeywords: ['pulse', 'discussion', 'activity', 'comment', 'feed'],
    childTypePatterns: [],
    canonicalType: 'PulseWidget',
    confidence: 0.85,
  },
  {
    labelKeywords: ['attachment', 'document', 'file', 'upload'],
    childTypePatterns: ['file', 'attachment', 'upload'],
    canonicalType: 'AttachmentsWidget',
    confidence: 0.80,
  },
  {
    labelKeywords: ['step', 'stage', 'progress', 'process', 'stepper', 'wizard'],
    childTypePatterns: ['step', 'stage'],
    canonicalType: 'StepsWidget',
    confidence: 0.80,
  },
  {
    labelKeywords: ['grid', 'table', 'list', 'data', 'records'],
    childTypePatterns: ['row', 'column', 'cell', 'header'],
    canonicalType: 'DataGrid',
    confidence: 0.75,
  },
  {
    labelKeywords: ['summary', 'case', 'details', 'header'],
    childTypePatterns: [],
    canonicalType: 'CaseSummary',
    confidence: 0.70,
  },
  {
    labelKeywords: ['rich text', 'html', 'content', 'formatted'],
    childTypePatterns: [],
    canonicalType: 'RichTextWidget',
    confidence: 0.75,
  },
];

/** Detect likely widget type from label text using heuristics */
export function detectWidgetFromLabel(label: string): CanonicalType | null {
  const lower = label.toLowerCase();
  let best: { type: CanonicalType; confidence: number } | null = null;
  for (const hint of WIDGET_DETECTION_HINTS) {
    if (hint.labelKeywords.some((kw) => lower.includes(kw))) {
      if (!best || hint.confidence > best.confidence) {
        best = { type: hint.canonicalType, confidence: hint.confidence };
      }
    }
  }
  return best?.type ?? null;
}

// ─── A2UI Type Map (extended) ─────────────────────────────────────────────────

/** Full lookup: canonical type → A2UI component type */
export const CANONICAL_TO_A2UI_EXTENDED: Record<string, string> = {
  // Layouts
  SingleColumn:    'FlexContainer',
  TwoColumn:       'GridContainer',
  ThreeColumn:     'GridContainer',
  FourColumn:      'GridContainer',
  InlineLayout:    'FlexContainer',
  TabsLayout:      'TabContainer',
  AccordionLayout: 'AccordionContainer',
  Section:         'Section',
  // Widgets
  PulseWidget:       'Pulse',
  AttachmentsWidget: 'Attachments',
  StepsWidget:       'ProgressStepper',
  DataGrid:          'DataGrid',
  CaseSummary:       'CaseSummary',
  RichTextWidget:    'RichText',
  EmbeddedView:      'EmbeddedView',
};
