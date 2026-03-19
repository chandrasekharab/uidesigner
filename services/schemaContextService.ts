/**
 * Schema Context Service
 *
 * Parses user-provided JSON schema files (Pega Constellation View format or
 * custom component definitions) and provides lookup + validation APIs used
 * by the schema-aware generation pipeline.
 *
 * Responsibilities:
 *  • Parse raw schema JSON into a structured SchemaContext
 *  • Extract allowed component types, field definitions, validation rules,
 *    layout patterns, and property references
 *  • Provide similarity-based component matching
 *  • Validate generated Pega JSON against the loaded context
 *  • Merge multiple schema contexts (for multi-schema workflows)
 */

import type { DetectedComponent, DetectedComponentType } from '@/services/designParser';
import type { PegaConstellationMetadata } from '@/services/pegaMetadataGenerator';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** A resolved field definition extracted from a user schema */
export interface SchemaFieldDef {
  /** The raw type string from the schema (e.g. "TextInput", "Dropdown") */
  schemaType: string;
  /** Human-readable label */
  label: string;
  /** Whether this field is required in the schema */
  required?: boolean;
  /** Pega property reference pattern */
  property?: string;
  /** Additional validation rules */
  validations?: string[];
  /** Default value */
  defaultValue?: unknown;
  /** Allowed child types (for containers) */
  allowedChildren?: string[];
  /** Metadata: where in the source schema this was found */
  sourcePointer?: string;
}

/** A component mapping: detected type → best schema type + explanation */
export interface SchemaMapping {
  detectedType: DetectedComponentType;
  detectedLabel: string;
  schemaType: string;
  schemaLabel: string;
  confidence: number;
  explanation: string;
  /** Alternative schema types the user can pick */
  alternatives: Array<{ schemaType: string; label: string; confidence: number }>;
  /** Whether this was overridden by the user */
  userOverride?: boolean;
}

/** Validation result for a generated Pega JSON output */
export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationIssue[];
  warnings: SchemaValidationIssue[];
  suggestions: SchemaValidationIssue[];
  score: number; // 0–100 schema-alignment score
}

export interface SchemaValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'suggestion';
  schemaRef?: string;
}

/** The parsed, queryable schema context */
export interface SchemaContext {
  id: string;
  name: string;
  description?: string;
  version?: string;
  /** Indexed field definitions */
  fieldDefs: Map<string, SchemaFieldDef>;
  /** All component types present in this schema */
  componentTypes: string[];
  /** Layout patterns found in the schema */
  layoutPatterns: string[];
  /** Property references found in the schema */
  propertyRefs: string[];
  /** Raw parsed JSON for reference */
  rawSchema: unknown;
  /** Timestamp when loaded */
  loadedAt: string;
}

// Internal type for detecting schema flavour
type SchemaFlavour = 'pega-constellation' | 'pega-ui' | 'openapi' | 'jsonschema' | 'unknown';

// ─── Schema Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a raw JSON value (from file upload or paste) into a SchemaContext.
 * Handles multiple schema formats heuristically.
 */
export function parseSchemaJSON(
  raw: unknown,
  name = 'Uploaded Schema'
): SchemaContext {
  const flavour = detectSchemaFlavour(raw);
  const fieldDefs = new Map<string, SchemaFieldDef>();
  const componentTypes: string[] = [];
  const layoutPatterns: string[] = [];
  const propertyRefs: string[] = [];

  switch (flavour) {
    case 'pega-constellation':
      extractPegaConstellationDefs(raw, fieldDefs, componentTypes, layoutPatterns, propertyRefs);
      break;
    case 'pega-ui':
      extractPegaUIDefs(raw, fieldDefs, componentTypes);
      break;
    case 'jsonschema':
      extractJSONSchemaDefs(raw, fieldDefs, componentTypes);
      break;
    default:
      extractGenericDefs(raw, fieldDefs, componentTypes);
  }

  // Deduplicate
  const uniqueTypes = [...new Set(componentTypes)];
  const uniqueLayouts = [...new Set(layoutPatterns)];
  const uniqueRefs = [...new Set(propertyRefs)];

  return {
    id: `schema-${Date.now()}`,
    name,
    version: extractVersion(raw),
    description: extractDescription(raw),
    fieldDefs,
    componentTypes: uniqueTypes,
    layoutPatterns: uniqueLayouts,
    propertyRefs: uniqueRefs,
    rawSchema: raw,
    loadedAt: new Date().toISOString(),
  };
}

/** Merge multiple SchemaContexts — later entries override earlier ones for the same key */
export function mergeSchemaContexts(contexts: SchemaContext[]): SchemaContext {
  const merged = new Map<string, SchemaFieldDef>();
  const types: string[] = [];
  const layouts: string[] = [];
  const refs: string[] = [];

  for (const ctx of contexts) {
    ctx.fieldDefs.forEach((v, k) => merged.set(k, v));
    types.push(...ctx.componentTypes);
    layouts.push(...ctx.layoutPatterns);
    refs.push(...ctx.propertyRefs);
  }

  return {
    id: `merged-${Date.now()}`,
    name: contexts.map((c) => c.name).join(' + '),
    fieldDefs: merged,
    componentTypes: [...new Set(types)],
    layoutPatterns: [...new Set(layouts)],
    propertyRefs: [...new Set(refs)],
    rawSchema: contexts.map((c) => c.rawSchema),
    loadedAt: new Date().toISOString(),
  };
}

// ─── Component Matching ───────────────────────────────────────────────────────

/**
 * Given a detected component, find the best matching schema field definition.
 * Returns a SchemaMapping with alternatives.
 */
export function matchComponentToSchema(
  comp: DetectedComponent,
  context: SchemaContext
): SchemaMapping {
  const candidates = computeCandidates(comp, context);
  const best = candidates[0] ?? null;

  return {
    detectedType: comp.type,
    detectedLabel: comp.label,
    schemaType: best?.schemaType ?? comp.type,
    schemaLabel: best?.label ?? comp.label,
    confidence: best?.confidence ?? 0.5,
    explanation: best?.explanation ?? `No schema definition found for "${comp.type}" — using detected type directly`,
    alternatives: candidates.slice(1, 4).map((c) => ({
      schemaType: c.schemaType,
      label: c.label,
      confidence: c.confidence,
    })),
  };
}

/** Map all components in a ParsedDesign to schema entries */
export function buildMappingTable(
  components: DetectedComponent[],
  context: SchemaContext
): Map<string, SchemaMapping> {
  const table = new Map<string, SchemaMapping>();
  for (const comp of components) {
    table.set(comp.id, matchComponentToSchema(comp, context));
  }
  return table;
}

// ─── Schema Validation ────────────────────────────────────────────────────────

/**
 * Validate a generated PegaConstellationMetadata against a SchemaContext.
 * Returns errors, warnings, suggestions, and a 0-100 alignment score.
 */
export function validateAgainstSchema(
  metadata: PegaConstellationMetadata,
  context: SchemaContext
): SchemaValidationResult {
  const errors: SchemaValidationIssue[] = [];
  const warnings: SchemaValidationIssue[] = [];
  const suggestions: SchemaValidationIssue[] = [];

  const view = metadata.view;

  if (!view.name || view.name.trim() === '') {
    errors.push({ path: 'view.name', message: 'View name is required', severity: 'error' });
  }

  if (!view.regions || view.regions.length === 0) {
    errors.push({ path: 'view.regions', message: 'At least one region is required', severity: 'error' });
  }

  let totalFields = 0;
  let alignedFields = 0;

  for (const [ri, region] of (view.regions ?? []).entries()) {
    if (!region.name) {
      warnings.push({ path: `view.regions[${ri}].name`, message: 'Region has no name', severity: 'warning' });
    }

    for (const [fi, field] of (region.fields ?? []).entries()) {
      totalFields++;
      const path = `view.regions[${ri}].fields[${fi}]`;
      const f = field as unknown as Record<string, unknown>;

      if (!f.type) {
        errors.push({ path, message: 'Field is missing required "type" property', severity: 'error' });
        continue;
      }

      // Check if this type exists in the schema
      const schemaType = String(f.type);
      const hasMatch = context.componentTypes.some(
        (t) => t.toLowerCase() === schemaType.toLowerCase()
      );
      if (hasMatch) {
        alignedFields++;
      } else {
        suggestions.push({
          path,
          message: `Type "${schemaType}" not found in schema — consider one of: ${context.componentTypes.slice(0, 4).join(', ')}`,
          severity: 'suggestion',
          schemaRef: context.componentTypes[0],
        });
      }

      // Property reference check
      const prop = f.property as string | undefined;
      if (!prop) {
        suggestions.push({
          path: `${path}.property`,
          message: `Field "${f.label ?? f.type}" has no property reference — schema requires ".PropertyName"`,
          severity: 'suggestion',
        });
      } else if (context.propertyRefs.length > 0) {
        const propMatch = context.propertyRefs.some((r) =>
          r.toLowerCase().includes(String(prop).toLowerCase().replace(/^\./, ''))
        );
        if (!propMatch) {
          warnings.push({
            path: `${path}.property`,
            message: `Property "${prop}" not found in schema definitions`,
            severity: 'warning',
            schemaRef: context.propertyRefs[0],
          });
        }
      }
    }
  }

  // Actions validation
  for (const [ai, action] of (view.actions ?? []).entries()) {
    const path = `view.actions[${ai}]`;
    const a = action as unknown as Record<string, unknown>;
    if (!a.label) {
      warnings.push({ path, message: 'Action has no label', severity: 'warning' });
    }
  }

  const score = totalFields === 0 ? 100 : Math.round((alignedFields / totalFields) * 100);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    score,
  };
}

// ─── Schema-aware field generation helpers ────────────────────────────────────

/**
 * Given a detected component and a schema context, return the best Pega field
 * definition to use — falls back to heuristics if no schema match.
 */
export function resolveFieldFromSchema(
  comp: DetectedComponent,
  context: SchemaContext
): Record<string, unknown> {
  const mapping = matchComponentToSchema(comp, context);
  const def = context.fieldDefs.get(mapping.schemaType) ??
               context.fieldDefs.get(comp.type);

  const base: Record<string, unknown> = {
    type: mapping.schemaType || comp.type,
    label: comp.label || def?.label || comp.type,
  };

  if (def?.property) {
    base.property = def.property;
  } else if (comp.label) {
    base.property = toPegaProperty(comp.label);
  }

  if (def?.required !== undefined) base.required = def.required;
  if (comp.placeholder) base.placeholder = comp.placeholder;

  return base;
}

/** Convert a label to a Pega property reference (.CamelCase) */
function toPegaProperty(label: string): string {
  return '.' + label.replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function detectSchemaFlavour(raw: unknown): SchemaFlavour {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const r = raw as Record<string, unknown>;

  // Pega Constellation View
  if (r.view && typeof r.view === 'object') return 'pega-constellation';
  if (r.pyViewHTML || r.pxPages) return 'pega-ui';

  // JSON Schema (draft-07, draft-06, draft-2020-12, ...)
  if (r.$schema || r.definitions || r.properties) return 'jsonschema';

  // Array of field definitions (simple custom format)
  if (Array.isArray(raw) && raw.length > 0 &&
      typeof (raw[0] as Record<string, unknown>).type === 'string') {
    return 'pega-constellation';
  }

  return 'unknown';
}

function extractPegaConstellationDefs(
  raw: unknown,
  fieldDefs: Map<string, SchemaFieldDef>,
  componentTypes: string[],
  layoutPatterns: string[],
  propertyRefs: string[]
): void {
  const r = raw as Record<string, unknown>;
  const view = (r.view ?? r) as Record<string, unknown>;

  if (view.type) componentTypes.push(String(view.type));
  if (view.layout) layoutPatterns.push(String(view.layout));

  const regions = Array.isArray(view.regions) ? view.regions : [];

  for (const region of regions) {
    const reg = region as Record<string, unknown>;
    if (reg.layout) layoutPatterns.push(String(reg.layout));

    const fields = Array.isArray(reg.fields) ? reg.fields : [];
    for (const field of fields) {
      extractFieldDef(field as Record<string, unknown>, fieldDefs, componentTypes, propertyRefs);
    }
  }

  // Also scan actions
  const actions = Array.isArray(view.actions) ? view.actions : [];
  for (const action of actions) {
    const a = action as Record<string, unknown>;
    if (a.type) componentTypes.push(String(a.type));
  }
}

function extractFieldDef(
  f: Record<string, unknown>,
  fieldDefs: Map<string, SchemaFieldDef>,
  componentTypes: string[],
  propertyRefs: string[]
): void {
  const type = String(f.type ?? '');
  if (!type) return;

  componentTypes.push(type);

  const def: SchemaFieldDef = {
    schemaType: type,
    label: String(f.label ?? type),
    required: Boolean(f.required),
    property: f.property ? String(f.property) : undefined,
    defaultValue: f.defaultValue,
    validations: [],
  };

  if (f.property) propertyRefs.push(String(f.property));
  if (f.validations && Array.isArray(f.validations)) {
    def.validations = f.validations.map(String);
  }

  // Store by type (last def wins) and also by label for lookup
  fieldDefs.set(type, def);
  if (def.label !== type) fieldDefs.set(def.label.toLowerCase(), def);
}

function extractPegaUIDefs(
  raw: unknown,
  fieldDefs: Map<string, SchemaFieldDef>,
  componentTypes: string[]
): void {
  const r = raw as Record<string, unknown>;
  const pages = r.pxPages ?? r.pyViewHTML;
  if (Array.isArray(pages)) {
    for (const page of pages) {
      if (page && typeof page === 'object') {
        const p = page as Record<string, unknown>;
        if (p.type) {
          componentTypes.push(String(p.type));
          fieldDefs.set(String(p.type), {
            schemaType: String(p.type),
            label: String(p.label ?? p.type),
          });
        }
      }
    }
  }
}

function extractJSONSchemaDefs(
  raw: unknown,
  fieldDefs: Map<string, SchemaFieldDef>,
  componentTypes: string[]
): void {
  const r = raw as Record<string, unknown>;

  const processProps = (props: Record<string, unknown>, prefix = '') => {
    for (const [key, val] of Object.entries(props)) {
      if (!val || typeof val !== 'object') continue;
      const v = val as Record<string, unknown>;
      const type = String(v.type ?? 'string');
      const schemaType = mapJsonSchemaTypeToField(type, key);
      componentTypes.push(schemaType);
      fieldDefs.set(key, {
        schemaType,
        label: String(v.title ?? key),
        required: false,
        property: `.${capitalize(key)}`,
        validations: buildJsonSchemaValidations(v),
        sourcePointer: `${prefix}/${key}`,
      });
    }
  };

  if (r.properties && typeof r.properties === 'object') {
    processProps(r.properties as Record<string, unknown>, '#/properties');
  }

  if (r.definitions && typeof r.definitions === 'object') {
    for (const [defKey, defVal] of Object.entries(r.definitions as Record<string, unknown>)) {
      if (defVal && typeof defVal === 'object') {
        const dv = defVal as Record<string, unknown>;
        if (dv.properties && typeof dv.properties === 'object') {
          processProps(dv.properties as Record<string, unknown>, `#/definitions/${defKey}/properties`);
        }
      }
    }
  }
}

function extractGenericDefs(
  raw: unknown,
  fieldDefs: Map<string, SchemaFieldDef>,
  componentTypes: string[]
): void {
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      const n = node as Record<string, unknown>;
      if (typeof n.type === 'string') {
        componentTypes.push(n.type);
        fieldDefs.set(n.type, {
          schemaType: n.type,
          label: String(n.label ?? n.name ?? n.type),
          property: n.property ? String(n.property) : undefined,
          sourcePointer: path,
        });
      }
      for (const child of Object.values(n)) walk(child, path);
    }
  };
  walk(raw, '#');
}

function mapJsonSchemaTypeToField(type: string, key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes('email')) return 'email';
  if (lower.includes('password')) return 'password';
  if (lower.includes('phone') || lower.includes('tel')) return 'tel';
  if (lower.includes('date')) return 'date';
  if (lower.includes('number') || lower.includes('count')) return 'number';
  if (type === 'boolean') return 'checkbox';
  if (type === 'array') return 'dropdown';
  return 'text';
}

function buildJsonSchemaValidations(v: Record<string, unknown>): string[] {
  const rules: string[] = [];
  if (v.minLength) rules.push(`minLength: ${v.minLength}`);
  if (v.maxLength) rules.push(`maxLength: ${v.maxLength}`);
  if (v.minimum) rules.push(`minimum: ${v.minimum}`);
  if (v.maximum) rules.push(`maximum: ${v.maximum}`);
  if (v.pattern) rules.push(`pattern: ${v.pattern}`);
  if (v.enum) rules.push(`enum: ${(v.enum as unknown[]).join(', ')}`);
  return rules;
}

interface Candidate {
  schemaType: string;
  label: string;
  confidence: number;
  explanation: string;
}

function computeCandidates(comp: DetectedComponent, context: SchemaContext): Candidate[] {
  const candidates: Candidate[] = [];

  // 1. Exact type match
  const exactDef = context.fieldDefs.get(comp.type);
  if (exactDef) {
    candidates.push({
      schemaType: exactDef.schemaType,
      label: exactDef.label,
      confidence: 0.95,
      explanation: `Exact match: detected type "${comp.type}" directly maps to schema type "${exactDef.schemaType}"`,
    });
  }

  // 2. Label-based match
  if (comp.label) {
    const labelKey = comp.label.toLowerCase();
    const byLabel = context.fieldDefs.get(labelKey);
    if (byLabel && byLabel.schemaType !== exactDef?.schemaType) {
      candidates.push({
        schemaType: byLabel.schemaType,
        label: byLabel.label,
        confidence: 0.8,
        explanation: `Label match: "${comp.label}" matches schema field "${byLabel.label}"`,
      });
    }
  }

  // 3. Semantic type mapping (heuristic)
  for (const [key, def] of context.fieldDefs) {
    if (key === comp.type || key === comp.label?.toLowerCase()) continue;
    const sim = semanticSimilarity(comp.type, comp.label, def.schemaType, def.label);
    if (sim > 0.5) {
      candidates.push({
        schemaType: def.schemaType,
        label: def.label,
        confidence: sim,
        explanation: `Semantic match (${Math.round(sim * 100)}%): "${comp.type}" semantically similar to schema "${def.schemaType}"${def.property ? ` (→ ${def.property})` : ''}`,
      });
    }
  }

  // 4. Fallback: use detected type as-is
  if (candidates.length === 0) {
    candidates.push({
      schemaType: comp.type,
      label: comp.label || comp.type,
      confidence: 0.4,
      explanation: `No schema definition found — using detected type "${comp.type}" directly`,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/** Simple keyword-overlap similarity score */
function semanticSimilarity(
  detectedType: string,
  detectedLabel: string,
  schemaType: string,
  schemaLabel: string
): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);

  const SYNONYMS: Record<string, string[]> = {
    input: ['text', 'field', 'textinput', 'textbox', 'email', 'phone'],
    button: ['submit', 'action', 'btn', 'cta', 'primary', 'secondary'],
    dropdown: ['select', 'picklist', 'combobox', 'list', 'enum'],
    checkbox: ['toggle', 'bool', 'boolean', 'check'],
    heading: ['title', 'h1', 'h2', 'h3', 'header'],
    text: ['label', 'paragraph', 'body', 'caption', 'description'],
    card: ['tile', 'widget', 'metric', 'kpi', 'panel'],
    table: ['grid', 'list', 'dataview', 'records'],
  };

  const dTokens = new Set([...normalize(detectedType), ...normalize(detectedLabel)]);
  const sTokens = new Set([...normalize(schemaType), ...normalize(schemaLabel)]);

  // Add synonyms
  for (const [base, syns] of Object.entries(SYNONYMS)) {
    if (dTokens.has(base)) syns.forEach((s) => dTokens.add(s));
    if (sTokens.has(base)) syns.forEach((s) => sTokens.add(s));
  }

  const intersection = [...dTokens].filter((t) => sTokens.has(t));
  if (intersection.length === 0) return 0;
  return intersection.length / Math.max(dTokens.size, sTokens.size);
}

function extractVersion(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  return r.version ? String(r.version) : r.$schema ? String(r.$schema).split('/').pop() : undefined;
}

function extractDescription(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  return r.description ? String(r.description) : r.title ? String(r.title) : undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
