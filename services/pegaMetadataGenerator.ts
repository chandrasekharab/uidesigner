// ─── Pega Metadata Generator ─────────────────────────────────────────────────
// Converts a ParsedDesign (output of designParser.ts) into valid
// Pega Constellation View metadata JSON.
//
// The output schema follows the Constellation View format used throughout
// the Transform pipeline in this platform, so it can be fed directly into
// the Transformation Studio as a source document.

import type { ParsedDesign, DetectedComponent, LayoutSection } from '@/services/designParser';

// ─── Pega Constellation Types ─────────────────────────────────────────────────

export interface PegaField {
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'tel' | 'textarea';
  label: string;
  /** Pega property reference: e.g. ".EmailAddress" */
  property?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** For future A2UI mapping */
  pegaType?: string;
}

export interface PegaDropdown {
  type: 'dropdown';
  label: string;
  property?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ key: string; value: string }>;
  dataSource?: string;
}

export interface PegaCheckbox {
  type: 'checkbox';
  label: string;
  property?: string;
  required?: boolean;
}

export interface PegaRadioGroup {
  type: 'radioGroup';
  label: string;
  property?: string;
  options?: Array<{ key: string; value: string }>;
  dataSource?: string;
}

export interface PegaAction {
  type: 'button';
  label: string;
  /** Pega action type: e.g. "Submit", "Cancel", "Navigate" */
  actionType?: 'Submit' | 'Cancel' | 'Navigate' | 'Custom';
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  disabled?: boolean;
}

export interface PegaLink {
  type: 'link';
  label: string;
  url?: string;
}

export interface PegaText {
  type: 'text' | 'heading' | 'label';
  content: string;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
}

export interface PegaCardMetric {
  type: 'metric';
  label: string;
  value?: string;
  trend?: string;
}

export type PegaFieldDef =
  | PegaField
  | PegaDropdown
  | PegaCheckbox
  | PegaRadioGroup
  | PegaAction
  | PegaLink
  | PegaText
  | PegaCardMetric;

export interface PegaRegion {
  /** Logical region name: "header", "body", "footer", etc. */
  name: string;
  layout?: 'stacked' | 'inline' | 'grid';
  fields: PegaFieldDef[];
}

export interface PegaView {
  /** Pega View type: "form", "list", "detail", "dashboard", "modal" */
  type: 'form' | 'list' | 'detail' | 'dashboard' | 'modal' | 'view';
  /** Human-readable name matching the detected screen title */
  name: string;
  classReference?: string;
  regions: PegaRegion[];
  actions: PegaAction[];
  /** Extra metadata injected by the generator */
  _meta?: {
    generatedBy: 'design-parser';
    parseId: string;
    mock: boolean;
    componentCount: number;
    confidence: number;
  };
}

export interface PegaConstellationMetadata {
  view: PegaView;
}

// ─── Generation Options ───────────────────────────────────────────────────────

export interface GenerationOptions {
  /** Include _meta block in output (default: true) */
  includeMeta?: boolean;
  /** Auto-derive Pega property names from labels (default: true) */
  derivePropertyNames?: boolean;
  /** Infer required fields from OCR patterns like "*" (default: true) */
  inferRequired?: boolean;
  /** Separate last row of buttons into footer actions (default: true) */
  extractFooterActions?: boolean;
}

const DEFAULT_OPTIONS: Required<GenerationOptions> = {
  includeMeta: true,
  derivePropertyNames: true,
  inferRequired: true,
  extractFooterActions: true,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Primary entry point. Converts a ParsedDesign into Pega Constellation JSON.
 */
export function generatePegaMetadata(
  design: ParsedDesign,
  options: GenerationOptions = {}
): PegaConstellationMetadata {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Separate presentational elements from interactive fields and actions
  const { fields, actions, textBlocks } = categoriseComponents(
    design.components,
    opts
  );

  // Build regions from the layout sections
  const regions = buildRegions(design.layout, design.components, fields, textBlocks, opts);

  const avgConfidence =
    design.components.length > 0
      ? design.components.reduce((sum, c) => sum + c.confidence, 0) /
        design.components.length
      : 0;

  const view: PegaView = {
    type: mapScreenType(design.screenType),
    name: design.title || 'Generated View',
    classReference: deriveClassReference(design.title),
    regions,
    actions,
    ...(opts.includeMeta
      ? {
          _meta: {
            generatedBy: 'design-parser',
            parseId: design.parseId,
            mock: design.mock,
            componentCount: design.components.length,
            confidence: Math.round(avgConfidence * 100) / 100,
          },
        }
      : {}),
  };

  return { view };
}

/**
 * Shorthand that converts a flat array of detected components into Pega JSON.
 * Useful when no full ParsedDesign is available.
 */
export function convertComponentsToPegaSchema(
  components: DetectedComponent[],
  title = 'Generated Form'
): PegaConstellationMetadata {
  const design: ParsedDesign = {
    parseId: `gen-${Date.now()}`,
    screenType: 'form',
    title,
    components,
    layout: [],
    ocrLines: [],
    mock: true,
  };
  return generatePegaMetadata(design);
}

// ─── Categorisation ───────────────────────────────────────────────────────────

interface Categorised {
  fields: Map<string, PegaFieldDef>;
  actions: PegaAction[];
  textBlocks: PegaText[];
}

function categoriseComponents(
  components: DetectedComponent[],
  opts: Required<GenerationOptions>
): Categorised {
  const fields = new Map<string, PegaFieldDef>();
  const actions: PegaAction[] = [];
  const textBlocks: PegaText[] = [];

  for (const comp of components) {
    switch (comp.type) {
      case 'input':
      case 'password': {
        const inputType = resolveInputType(comp);
        if (comp.attributes.multiline) {
          fields.set(comp.id, {
            type: 'textarea',
            label: comp.label,
            property: opts.derivePropertyNames ? toPegaProperty(comp.label) : undefined,
            placeholder: comp.placeholder,
            required: opts.inferRequired ? inferRequired(comp.label) : false,
          } satisfies PegaField);
        } else {
          fields.set(comp.id, {
            type: inputType,
            label: comp.label,
            property: opts.derivePropertyNames ? toPegaProperty(comp.label) : undefined,
            placeholder: comp.placeholder,
            required: opts.inferRequired ? inferRequired(comp.label) : false,
            pegaType: mapToPegaFieldType(inputType),
          } satisfies PegaField);
        }
        break;
      }

      case 'dropdown': {
        fields.set(comp.id, {
          type: 'dropdown',
          label: comp.label,
          property: opts.derivePropertyNames ? toPegaProperty(comp.label) : undefined,
          placeholder: comp.placeholder,
          dataSource: deriveDataSource(comp.label),
        } satisfies PegaDropdown);
        break;
      }

      case 'checkbox': {
        fields.set(comp.id, {
          type: 'checkbox',
          label: comp.label,
          property: opts.derivePropertyNames ? toPegaProperty(comp.label) : undefined,
        } satisfies PegaCheckbox);
        break;
      }

      case 'radio': {
        fields.set(comp.id, {
          type: 'radioGroup',
          label: comp.label,
          property: opts.derivePropertyNames ? toPegaProperty(comp.label) : undefined,
        } satisfies PegaRadioGroup);
        break;
      }

      case 'button': {
        actions.push({
          type: 'button',
          label: comp.label,
          actionType: inferActionType(comp.label),
          variant: inferButtonVariant(comp),
        });
        break;
      }

      case 'link': {
        // Links are tracked as text blocks rather than actions
        textBlocks.push({ type: 'label', content: comp.label });
        break;
      }

      case 'heading': {
        textBlocks.push({
          type: 'heading',
          content: comp.label,
          variant: 'h2',
        });
        break;
      }

      case 'label': {
        // Labels are attached to fields rather than added as standalone elements
        break;
      }

      case 'text': {
        textBlocks.push({ type: 'text', content: comp.label, variant: 'body' });
        break;
      }

      case 'card': {
        fields.set(comp.id, {
          type: 'metric',
          label: comp.label,
          value: comp.attributes.value as string | undefined,
          trend: comp.attributes.trend as string | undefined,
        } satisfies PegaCardMetric);
        break;
      }

      default:
        break;
    }
  }

  return { fields, actions, textBlocks };
}

// ─── Region Building ─────────────────────────────────────────────────────────

function buildRegions(
  layout: LayoutSection[],
  allComponents: DetectedComponent[],
  fields: Map<string, PegaFieldDef>,
  textBlocks: PegaText[],
  opts: Required<GenerationOptions>
): PegaRegion[] {
  const regions: PegaRegion[] = [];

  // If we have layout sections, use them to group fields
  if (layout.length > 0) {
    const usedIds = new Set<string>();

    for (const section of layout) {
      const sectionFields: PegaFieldDef[] = [];

      for (const id of section.componentIds) {
        const field = fields.get(id);
        if (field) {
          sectionFields.push(field);
          usedIds.add(id);
        }
      }

      // Add text blocks that belong to this section's row
      const sectionComps = allComponents.filter((c) =>
        section.componentIds.includes(c.id)
      );
      const firstY = sectionComps[0]?.boundingBox.y ?? 0;
      const textInRow = textBlocks.filter((_, i) => {
        // naive: heading at index 0 goes in row 0
        if (section.row === 0 && i === 0) return true;
        return false;
      });

      if (sectionFields.length > 0 || textInRow.length > 0) {
        regions.push({
          name: section.label,
          layout: inferRegionLayout(sectionComps),
          fields: [...textInRow, ...sectionFields],
        });
      }
    }

    // Remaining fields not captured by any section go into a "body" region
    const remaining: PegaFieldDef[] = [];
    for (const [id, field] of fields.entries()) {
      if (!usedIds.has(id)) remaining.push(field);
    }
    if (remaining.length > 0) {
      regions.push({ name: 'body', layout: 'stacked', fields: remaining });
    }
  } else {
    // Fallback: one region with all fields
    regions.push({
      name: 'body',
      layout: 'stacked',
      fields: [...fields.values()],
    });
  }

  return regions.filter((r) => r.fields.length > 0);
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function mapScreenType(
  st: ParsedDesign['screenType']
): PegaView['type'] {
  const map: Record<ParsedDesign['screenType'], PegaView['type']> = {
    form: 'form',
    dashboard: 'dashboard',
    list: 'list',
    detail: 'detail',
    modal: 'modal',
    unknown: 'view',
  };
  return map[st] ?? 'view';
}

/** Convert a human label to a Pega-style property reference */
function toPegaProperty(label: string): string {
  if (!label) return '.UnknownField';
  const cleaned = label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return `.${cleaned}`;
}

/** Derive a Pega class reference from the screen title */
function deriveClassReference(title: string): string {
  if (!title) return 'Work-Object';
  const cleaned = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  return `Work-${cleaned.replace(/\s+/g, '-')}`;
}

function resolveInputType(
  comp: DetectedComponent
): PegaField['type'] {
  const it = comp.attributes.inputType as string | undefined;
  if (it === 'password' || comp.type === 'password') return 'password';
  if (it === 'email' || comp.label.toLowerCase().includes('email')) return 'email';
  if (it === 'date' || comp.label.toLowerCase().includes('date')) return 'date';
  if (it === 'tel' || comp.label.toLowerCase().includes('phone')) return 'tel';
  if (it === 'number' || comp.label.toLowerCase().includes('amount')) return 'number';
  return 'text';
}

function mapToPegaFieldType(inputType: PegaField['type']): string {
  const map: Record<PegaField['type'], string> = {
    text: 'Text',
    email: 'Email',
    password: 'Text',
    number: 'Decimal',
    date: 'Date',
    tel: 'Text',
    textarea: 'Text',
  };
  return map[inputType] ?? 'Text';
}

function inferRequired(label: string): boolean {
  return label.includes('*') || label.toLowerCase().includes('required');
}

function inferActionType(label: string): PegaAction['actionType'] {
  const l = label.toLowerCase();
  if (l.includes('submit') || l.includes('send') || l.includes('save') || l.includes('register') || l === 'login') return 'Submit';
  if (l.includes('cancel') || l.includes('back') || l.includes('close')) return 'Cancel';
  if (l.includes('navigate') || l.includes('next') || l.includes('go to')) return 'Navigate';
  return 'Custom';
}

function inferButtonVariant(comp: DetectedComponent): PegaAction['variant'] {
  const v = comp.attributes.variant as string | undefined;
  if (v === 'primary') return 'primary';
  if (v === 'secondary') return 'secondary';
  if (v === 'danger') return 'danger';
  if (v === 'link') return 'link';

  const l = comp.label.toLowerCase();
  if (l.includes('cancel') || l.includes('back') || l.includes('close')) return 'secondary';
  if (l.includes('delete') || l.includes('remove')) return 'danger';
  return 'primary';
}

function deriveDataSource(label: string): string | undefined {
  const l = label.toLowerCase();
  if (l.includes('country')) return 'D_CountryList';
  if (l.includes('state') || l.includes('province')) return 'D_StateList';
  if (l.includes('status')) return 'D_StatusOptions';
  if (l.includes('priority')) return 'D_PriorityOptions';
  return undefined;
}

function inferRegionLayout(
  comps: DetectedComponent[]
): PegaRegion['layout'] {
  if (comps.length === 0) return 'stacked';
  const xs = comps.map((c) => c.boundingBox.x);
  const spread = Math.max(...xs) - Math.min(...xs);
  return spread > 0.3 ? 'inline' : 'stacked';
}
