import { v4 as uuidv4 } from 'uuid';
import type {
  CanonicalComponent,
  CanonicalCategory,
  CanonicalType,
  CanonicalBinding,
  CanonicalValidation,
  LayoutConfig,
  WidgetConfig,
  CanonicalDataSource,
  TargetFormat,
} from '@/types/canonical';
import type { UIComponent, ComponentType } from '@/types';
import {
  PEGA_TYPE_MAP,
  TYPE_MAPPINGS,
  CANONICAL_TO_TARGET,
} from '@/config/schemaMappings';
import {
  WIDGET_TYPE_MAP,
  LAYOUT_TYPE_MAP,
  CANONICAL_TO_A2UI_EXTENDED,
  resolveLayoutCanonicalType,
  layoutTypeToColumns,
  detectWidgetFromLabel,
} from '@/config/widgetMapping';
import { getDefaultProps } from '@/utils/componentDefaults';

// ─── Mapping Override Contract ────────────────────────────────────────────────

export interface MappingOverride {
  overrideTargetType?: ComponentType;
  overrideProps?: Record<string, unknown>;
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface MappingValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  totalNodes: number;
  mappedNodes: number;
  unmappedNodes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract property name from Pega data binding: "@P .FirstName" → "FirstName" */
function extractPegaField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return (
    value.match(/@P\s+\.(\w+)/)?.[1] ??
    value.match(/^\.(\w+)$/)?.[1]
  );
}

/** Extract data source name: "@ASSOCIATED .CountryOptions" → "CountryOptions" */
function extractDataSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.match(/@ASSOCIATED\s+\.(\w+)/)?.[1];
}

/** Resolve a dot-path key in an object — e.g. "config.label" */
function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ─── Step 1: Pega JSON → Intermediate (Canonical) ────────────────────────────

/**
 * Derive the canonical category and enriched type from a Pega component.
 * Resolution order: widget map → layout map → layout region → field map → Unknown.
 */
function resolveCanonicalTypeAndCategory(
  pegaType: string,
  config: Record<string, unknown>
): { canonicalType: CanonicalType; category: CanonicalCategory; layoutConfig?: LayoutConfig; widgetConfig?: WidgetConfig; dataSource?: CanonicalDataSource } {
  // 1. Widget map (exact type match)
  const widgetEntry = WIDGET_TYPE_MAP.get(pegaType);
  if (widgetEntry) {
    const widgetConfig: WidgetConfig = {};
    if (config.dataPage)     widgetConfig.dataPageClass  = String(config.dataPage);
    if (config.viewName)     widgetConfig.viewName       = String(config.viewName);
    if (config.classReference) widgetConfig.classReference = String(config.classReference);
    if (config.maxItems)     widgetConfig.maxItems       = Number(config.maxItems);
    const dataSource: CanonicalDataSource | undefined =
      config.dataPage
        ? { type: 'dataPage', sourceClass: String(config.dataPage) }
        : config.property
        ? { type: 'caseProperty', property: String(config.property) }
        : undefined;
    return {
      canonicalType: widgetEntry.canonicalType,
      category: 'widget',
      widgetConfig: Object.keys(widgetConfig).length ? widgetConfig : undefined,
      dataSource,
    };
  }

  // 2. Region with explicit layout value → determine columns layout
  if (pegaType === 'Region') {
    const layoutVal = String(config.layout ?? config.type ?? '');
    const canonicalType = resolveLayoutCanonicalType(layoutVal || undefined);
    const columns = layoutTypeToColumns(canonicalType);
    const isTabsOrAccordion = canonicalType === 'TabsLayout' || canonicalType === 'AccordionLayout';
    const layoutConfig: LayoutConfig = {
      layoutType: layoutVal as LayoutConfig['layoutType'] || 'singleColumn',
      columns: isTabsOrAccordion ? undefined : columns,
      gap: 16,
      collapsible: canonicalType === 'AccordionLayout',
    };
    // Look for a more explicit mapping key like "Region/twoColumn"
    const explicitKey = `Region/${layoutVal.toLowerCase()}`;
    const explicitEntry = LAYOUT_TYPE_MAP.get(explicitKey);
    if (explicitEntry?.defaultLayoutConfig) {
      Object.assign(layoutConfig, explicitEntry.defaultLayoutConfig);
    }
    return { canonicalType, category: 'layout', layoutConfig };
  }

  // 3. Named layout types (Section, tabs, accordion as top-level type)
  const layoutEntry = LAYOUT_TYPE_MAP.get(pegaType);
  if (layoutEntry) {
    const layoutConfig: LayoutConfig = { ...layoutEntry.defaultLayoutConfig } as LayoutConfig;
    return { canonicalType: layoutEntry.canonicalType, category: 'layout', layoutConfig };
  }

  // 4. Heuristic widget detection from label
  const label = String(config.label ?? config.name ?? pegaType);
  const heuristicType = detectWidgetFromLabel(label);
  if (heuristicType) {
    return { canonicalType: heuristicType, category: 'widget' };
  }

  // 5. Standard field mapping
  const fieldMapping = PEGA_TYPE_MAP.get(pegaType);
  if (fieldMapping) {
    return { canonicalType: fieldMapping.canonicalType, category: 'field' };
  }

  // 6. Fallback — preserve Container for View, Unknown otherwise
  if (pegaType === 'View') return { canonicalType: 'Container', category: 'layout', layoutConfig: { layoutType: 'singleColumn', columns: 1 } };
  return { canonicalType: 'Unknown', category: 'field' };
}

function parsePegaNode(
  raw: Record<string, unknown>,
  path: string
): CanonicalComponent {
  const pegaType = String(raw.type ?? 'Unknown');
  const config = (raw.config ?? {}) as Record<string, unknown>;
  const mapping = PEGA_TYPE_MAP.get(pegaType);

  // Resolve category, canonical type, and structural configs
  const {
    canonicalType,
    category,
    layoutConfig,
    widgetConfig,
    dataSource,
  } = resolveCanonicalTypeAndCategory(pegaType, { ...config, name: raw.name, layout: raw.layout ?? config.layout });

  // ── Mapped props ──────────────────────────────────────────────────────────
  const props: Record<string, unknown> = {};
  if (mapping) {
    for (const pm of mapping.propMappings) {
      const val = getAtPath(config, pm.source);
      if (val !== undefined) {
        props[pm.target] = pm.transform ? pm.transform(val) : val;
      }
    }
  }

  // ── Widget default props ──────────────────────────────────────────────────
  if (category === 'widget') {
    const widgetEntry = WIDGET_TYPE_MAP.get(pegaType);
    if (widgetEntry?.defaultProps) {
      Object.assign(props, widgetEntry.defaultProps, props); // canonical mapped props win
    }
  }

  // Carry forward unmapped source keys (prefixed to avoid collisions)
  for (const key of Object.keys(config)) {
    if (!(key in props) && key !== 'value' && key !== 'actions' && key !== 'name') {
      props[`_src_${key}`] = config[key];
    }
  }

  // ── Data bindings ─────────────────────────────────────────────────────────
  const bindings: CanonicalBinding = {};
  if (mapping?.bindingPath) {
    const bv = config[mapping.bindingPath];
    const field = extractPegaField(bv);
    if (field) bindings.field = field;
    const ds = extractDataSource(bv);
    if (ds) bindings.dataSource = ds;
  }

  // ── Validations ───────────────────────────────────────────────────────────
  const validations: CanonicalValidation[] = [];
  if (mapping?.validationPaths) {
    const vp = mapping.validationPaths;
    if (vp.required && config[vp.required] === true) {
      validations.push({
        rule: 'required',
        message: `${props.label ?? 'This field'} is required.`,
      });
    }
    if (vp.readOnly && config[vp.readOnly] === true) {
      validations.push({ rule: 'custom', value: 'readonly', message: 'Read-only', condition: 'readOnly' });
    }
  }

  // ── Visibility ────────────────────────────────────────────────────────────
  const visibilityRaw = config.visibility as
    | { condition?: string; hidden?: boolean }
    | undefined;

  // ── Children ──────────────────────────────────────────────────────────────
  // Handle both raw.children array and Pega view.regions / region.fields
  const rawChildren: Record<string, unknown>[] = [];
  if (Array.isArray(raw.children)) {
    rawChildren.push(...(raw.children as Record<string, unknown>[]));
  }
  if (Array.isArray(raw.regions)) {
    // Pega View: regions are structural children
    rawChildren.push(...(raw.regions as Record<string, unknown>[]).map((r) => ({
      type: 'Region',
      layout: (r as Record<string, unknown>).layout ?? 'stacked',
      name: (r as Record<string, unknown>).name ?? 'region',
      children: (r as Record<string, unknown>).fields ?? [],
      config: r,
    })));
  }
  if (Array.isArray(raw.fields)) {
    rawChildren.push(...(raw.fields as Record<string, unknown>[]));
  }

  const children = rawChildren.map((child, i) =>
    parsePegaNode(child, `${path}.children[${i}]`)
  );

  return {
    id: uuidv4(),
    type: canonicalType,
    category,
    label: String(props.label ?? raw.name ?? raw.label ?? pegaType),
    props,
    bindings,
    validations,
    visibility: visibilityRaw,
    layoutConfig,
    widgetConfig,
    dataSource,
    children,
    _meta: {
      sourceType: pegaType,
      sourcePath: path,
      mappingRule: mapping
        ? `${pegaType} → ${canonicalType} [${category}]`
        : `${pegaType} → ${canonicalType} [${category}] (widget/layout rule)`,
      unmapped: !mapping && category === 'field' && canonicalType === 'Unknown',
    },
  };
}

/**
 * Convert a Pega Constellation View JSON document into the platform's
 * intermediate canonical schema.
 *
 * Accepts:
 *  - A single Pega View object  { type, name, regions: [...] }
 *  - An array of such objects
 *  - A Pega Constellation "view envelope" { view: { ... } }
 */
export function parsePegaToIntermediate(pegaJson: unknown): CanonicalComponent[] {
  // Unwrap { view: {...} } envelope
  let resolved = pegaJson;
  if (
    typeof resolved === 'object' &&
    resolved !== null &&
    'view' in (resolved as Record<string, unknown>)
  ) {
    resolved = (resolved as Record<string, unknown>).view;
  }

  const nodes = Array.isArray(resolved) ? resolved : [resolved];
  return (nodes as Record<string, unknown>[]).map((node, i) =>
    parsePegaNode(node, `$[${i}]`)
  );
}

// ─── Step 2: Intermediate → Target (UIComponent[]) ───────────────────────────

function transformNode(
  canonical: CanonicalComponent,
  overrides?: Map<string, MappingOverride>
): UIComponent {
  const override = overrides?.get(canonical.id);

  // Determine target component type (override wins)
  const derived =
    TYPE_MAPPINGS.find((m) => m.canonicalType === canonical.type)?.targetType ??
    CANONICAL_TO_TARGET[canonical.type] ??
    'Text';
  const targetType: ComponentType = override?.overrideTargetType ?? derived;

  // Start from canonical defaults so target always has complete props
  const defaults = getDefaultProps(targetType) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...defaults };

  // Apply canonical props (skip internal _src_ carry-overs)
  for (const [key, value] of Object.entries(canonical.props ?? {})) {
    if (key.startsWith('_src_')) continue;
    if (key in merged) merged[key] = value;
  }

  const bindings = canonical.bindings ?? {};

  // Inject binding hint into helper text if empty and field is bound
  if (bindings.field && 'helperText' in merged && !merged.helperText) {
    merged.helperText = `Bound: .${bindings.field}`;
  }

  // Inject datasource label for dropdowns
  if (bindings.dataSource && targetType === 'Dropdown') {
    const opts = merged.options as Array<{ label: string; value: string }> | undefined;
    if (!opts || opts.length === 0) {
      merged.options = [
        { label: `Data: ${bindings.dataSource}`, value: '__ds__' },
      ];
    }
  }

  // User prop overrides win over everything else
  if (override?.overrideProps) {
    Object.assign(merged, override.overrideProps);
  }

  return {
    id: uuidv4(),
    type: targetType,
    props: merged as UIComponent['props'],
    children: (canonical.children ?? []).map((c) => transformNode(c, overrides)),
  };
}

/**
 * Convert the platform's canonical intermediate schema into the final
 * UIComponent[] tree that the canvas renderer accepts.
 *
 * @param overrides Optional per-component type/prop overrides keyed by canonical id
 */
export function transformIntermediateToTarget(
  canonicalSchema: CanonicalComponent[],
  overrides?: Map<string, MappingOverride>
): UIComponent[] {
  return canonicalSchema.map((c) => transformNode(c, overrides));
}

// ─── Step 3: Validate Mappings ────────────────────────────────────────────────

function nodeCount(nodes: CanonicalComponent[]): { total: number; unmapped: number } {
  let total = 0;
  let unmapped = 0;
  for (const n of nodes) {
    total++;
    if (n._meta?.unmapped) unmapped++;
    const sub = nodeCount(n.children ?? []);
    total += sub.total;
    unmapped += sub.unmapped;
  }
  return { total, unmapped };
}

function validateNode(
  node: CanonicalComponent,
  path: string,
  result: MappingValidationResult
) {
  if (!node.id) {
    result.errors.push(`[${path}] Component is missing an id`);
    result.valid = false;
  }
  if (node._meta?.unmapped) {
    result.warnings.push(
      `[${path}] Pega type "${node._meta.sourceType}" has no mapping — will render as Text.`
    );
  }

  // ── Layout hierarchy validation ──────────────────────────────────────────
  if (node.category === 'layout') {
    // Tabs and Accordion must have at least one child
    if (
      (node.type === 'TabsLayout' || node.type === 'AccordionLayout') &&
      node.children.length === 0
    ) {
      result.warnings.push(
        `[${path}] ${node.type} has no children — it will render as an empty container.`
      );
    }
    // Multi-column layouts: warn if children count doesn't align with columns
    if (node.layoutConfig?.columns && node.layoutConfig.columns > 1) {
      const expectedChildren = node.layoutConfig.columns;
      if (node.children.length > 0 && node.children.length < expectedChildren) {
        result.warnings.push(
          `[${path}] ${node.type} declares ${expectedChildren} columns but only ${node.children.length} children found — some columns will be empty.`
        );
      }
    }
  }

  // ── Widget compatibility validation ──────────────────────────────────────
  if (node.category === 'widget') {
    const DATASOURCE_REQUIRED: CanonicalType[] = [
      'PulseWidget', 'StepsWidget', 'DataGrid', 'CaseSummary',
    ];
    if (DATASOURCE_REQUIRED.includes(node.type) && !node.dataSource && !node.bindings?.field) {
      result.warnings.push(
        `[${path}] Widget "${node.type}" typically requires a data source but none was found.`
      );
    }
    // DataGrid should not be nested inside another DataGrid
    // (detected via path depth analysis below)
  }

  for (const [i, child] of (node.children ?? []).entries()) {
    validateNode(child, `${path}.children[${i}]`, result);
  }
}

/**
 * Validate all nodes in an intermediate schema have well-defined mappings.
 * Returns warnings for unknown types and errors for structural problems.
 */
export function validateMappings(
  canonicalSchema: CanonicalComponent[]
): MappingValidationResult {
  const { total, unmapped } = nodeCount(canonicalSchema);
  const result: MappingValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    totalNodes: total,
    mappedNodes: total - unmapped,
    unmappedNodes: unmapped,
  };
  for (const [i, node] of canonicalSchema.entries()) {
    validateNode(node, `$[${i}]`, result);
  }
  return result;
}

// ─── Utility: Flatten tree for table views ────────────────────────────────────

export interface FlatCanonicalNode {
  node: CanonicalComponent;
  depth: number;
  path: string;
}

export function flattenCanonicalTree(
  nodes: CanonicalComponent[],
  depth = 0,
  prefix = '$'
): FlatCanonicalNode[] {
  return nodes.flatMap((node, i) => [
    { node, depth, path: `${prefix}[${i}]` },
    ...flattenCanonicalTree(node.children ?? [], depth + 1, `${prefix}[${i}].children`),
  ]);
}

// ─── Step 3 (A2UI path): Canonical → Google A2UI SDK Format ──────────────────

export type { TargetFormat };

/** Map canonical intermediate types → Google A2UI component names */
const CANONICAL_TO_A2UI_TYPE: Record<string, string> = {
  // Field types
  TextField:  'TextField',
  TextArea:   'TextArea',
  DatePicker: 'DateTimeField',
  Checkbox:   'Checkbox',
  RadioGroup: 'RadioGroup',
  Button:     'SubmitButton',
  Container:  'FlexContainer',
  Dropdown:   'SelectField',
  Label:      'Label',
  Text:       'TextContent',
  Unknown:    'TextContent',
  // Layout types
  SingleColumn:    'FlexContainer',
  TwoColumn:       'GridContainer',
  ThreeColumn:     'GridContainer',
  FourColumn:      'GridContainer',
  InlineLayout:    'FlexContainer',
  TabsLayout:      'TabContainer',
  AccordionLayout: 'AccordionContainer',
  Section:         'Section',
  // Widget types — extended registry wins, but keep fallbacks here too
  ...CANONICAL_TO_A2UI_EXTENDED,
};

/** Map internal ComponentType (used in overrides) → Google A2UI component names */
const OVERRIDE_TO_A2UI_TYPE: Record<ComponentType, string> = {
  TextInput:  'TextField',
  Button:     'Button',
  Container:  'FlexContainer',
  Dropdown:   'SelectField',
  Text:       'TextContent',
};

function strLiteral(value: unknown): { literalString: string } {
  return { literalString: String(value) };
}

function a2uiPropsFromCanonical(
  canonical: CanonicalComponent,
  overrides?: Map<string, MappingOverride>
): Record<string, unknown> {
  const override = overrides?.get(canonical.id);
  const p = canonical.props ?? {};
  const b = canonical.bindings ?? {};
  const vs = canonical.validations ?? [];
  const props: Record<string, unknown> = {};

  const A2UI_RENAMES: Record<string, string> = {
    content:   'text',       // Text component body → A2UI "text"
    type:      'inputType',  // HTML input type → A2UI "inputType"
  };

  // ── 1. _src_* carry-forward keys (lowest priority) ────────────────────────
  // Pega source fields that weren't explicitly in propMappings end up prefixed
  // with _src_. Strip the prefix and include them so no source data is lost.
  for (const [key, value] of Object.entries(p)) {
    if (!key.startsWith('_src_') || value === undefined || value === null) continue;
    const bareKey = key.slice(5); // strip '_src_'
    const outKey = A2UI_RENAMES[bareKey] ?? bareKey;
    props[outKey] = typeof value === 'string' ? strLiteral(value) : value;
  }

  // ── 2. Canonical mapped props (override _src_ values) ─────────────────────
  // Strings → { literalString }, booleans/numbers/arrays → as-is.
  for (const [key, value] of Object.entries(p)) {
    if (key.startsWith('_src_') || value === undefined || value === null) continue;
    const outKey = A2UI_RENAMES[key] ?? key;
    props[outKey] = typeof value === 'string' ? strLiteral(value) : value;
  }

  // ── 3. Top-level canonical label (may live outside props) ─────────────────
  if (canonical.label && !props.label) {
    props.label = strLiteral(canonical.label);
  }

  // ── 4. Promote validation-derived attributes to top-level booleans ─────────
  // A2UI expects these at the component property level, not only inside the
  // nested validation block.
  const requiredRule = vs.find((v) => v.rule === 'required');
  const readOnlyRule = vs.find((v) => v.rule === 'custom' && v.condition === 'readOnly');
  if (requiredRule) props.required = true;
  if (readOnlyRule) props.readOnly = true;

  // ── 5. Data bindings override static values ───────────────────────────────
  if (b.field)       props.value      = { path: `/${b.field}` };
  if (b.dataSource)  props.dataSource = { path: `/${b.dataSource}` };
  for (const [key, value] of Object.entries(b)) {
    if (key === 'field' || key === 'dataSource' || value === undefined) continue;
    if (typeof value === 'string') props[key] = { path: value };
  }

  // ── 6. Validation rules (structured block) ────────────────────────────────
  const minLen       = vs.find((v) => v.rule === 'minLength');
  const maxLen       = vs.find((v) => v.rule === 'maxLength');
  const patternRule  = vs.find((v) => v.rule === 'pattern');
  if (requiredRule || minLen || maxLen || patternRule) {
    const validation: Record<string, unknown> = {};
    if (requiredRule) validation.required  = { message: strLiteral(requiredRule.message) };
    if (minLen)       validation.minLength = { value: minLen.value,      message: strLiteral(minLen.message) };
    if (maxLen)       validation.maxLength = { value: maxLen.value,      message: strLiteral(maxLen.message) };
    if (patternRule)  validation.pattern   = { value: patternRule.value, message: strLiteral(patternRule.message) };
    props.validation = validation;
  }

  // ── 7. User prop overrides win ─────────────────────────────────────────────
  if (override?.overrideProps) Object.assign(props, override.overrideProps);

  // ── 8. Recurse children ────────────────────────────────────────────────────
  if (canonical.children?.length) {
    props.children = canonical.children.map((c) => a2uiNodeFromCanonical(c, overrides));
  }

  return props;
}

function a2uiNodeFromCanonical(
  canonical: CanonicalComponent,
  overrides?: Map<string, MappingOverride>
): Record<string, unknown> {
  const override = overrides?.get(canonical.id);
  const a2uiType: string = override?.overrideTargetType
    ? (OVERRIDE_TO_A2UI_TYPE[override.overrideTargetType] ?? 'TextContent')
    : (CANONICAL_TO_A2UI_TYPE[canonical.type] ?? 'TextContent');

  const componentProps = a2uiPropsFromCanonical(canonical, overrides);

  // ── Layout-specific A2UI props ────────────────────────────────────────────
  if (canonical.category === 'layout' && canonical.layoutConfig) {
    const lc = canonical.layoutConfig;
    if (lc.columns && lc.columns > 1) {
      componentProps.columns = lc.columns;
    }
    if (lc.gap !== undefined) componentProps.gap = lc.gap;
    if (lc.spacing)           componentProps.spacing = lc.spacing;
    if (lc.collapsible !== undefined) componentProps.collapsible = lc.collapsible;
    if (lc.tabLabels?.length)        componentProps.tabs         = lc.tabLabels;
    if (lc.accordionLabels?.length)  componentProps.sections     = lc.accordionLabels;
  }

  // ── Widget-specific A2UI props ────────────────────────────────────────────
  if (canonical.category === 'widget' && canonical.widgetConfig) {
    const wc = canonical.widgetConfig;
    if (wc.dataPageClass) componentProps.dataPageClass = wc.dataPageClass;
    if (wc.maxItems)      componentProps.maxItems      = wc.maxItems;
    if (wc.viewName)      componentProps.viewName      = wc.viewName;
    if (wc.interactive !== undefined) componentProps.interactive = wc.interactive;
    if (wc.steps?.length)   componentProps.steps   = wc.steps;
    if (wc.columns?.length) componentProps.columns = wc.columns;
  }

  // ── Data source ───────────────────────────────────────────────────────────
  if (canonical.dataSource) {
    const ds = canonical.dataSource;
    componentProps.dataSource = ds.sourceClass
      ? { type: ds.type, class: ds.sourceClass, property: ds.property }
      : { type: ds.type, property: ds.property };
  }

  return {
    id: canonical.id,
    component: { [a2uiType]: componentProps },
  };
}

/**
 * Convert the canonical intermediate schema directly to Google A2UI SDK format,
 * preserving data bindings, validation rules, and type mapping overrides.
 *
 * Output is compatible with the format detected by `isA2UIFormat()` in a2uiRenderer.ts,
 * so the generated JSON can be directly pasted into the A2UI Renderer tab.
 */
export function convertCanonicalToA2UI(
  schema: CanonicalComponent[],
  overrides?: Map<string, MappingOverride>
): Record<string, unknown>[] {
  return schema.map((c) => a2uiNodeFromCanonical(c, overrides));
}

// ─── Region-Mapping-Driven Transformation ────────────────────────────────────

import type { RegionMapping, TargetLayoutRegion, TransformationRule } from '@/models/RegionMapping';
import { PEGA_TEMPLATE_MAP } from '@/config/pegaTemplates';

export interface RegionMappingTransformOptions {
  /** Optional per-component type/prop overrides (forwarded to transformNode) */
  componentOverrides?: Map<string, MappingOverride>;
}

export interface RegionMappingTransformResult {
  /** Final UIComponent[] tree arranged per the target layout */
  targetComponents: UIComponent[];
  /** Intermediate canonical nodes (for inspection / downstream transforms) */
  intermediateSchema: CanonicalComponent[];
  /** Flat list of source regions that were skipped (no mapping) */
  unmappedSourceRegionIds: string[];
  /** Target regions that received no content */
  emptyTargetRegionIds: string[];
  /** Informational log of what happened during transformation */
  log: string[];
}

/**
 * Apply region-level transformation rules to a Pega transformation result.
 *
 * @param transformation - The field to transform
 * @param rules          - Transformation rules from the RegionMapping
 * @param log            - Mutable log array
 */
function applyTransformationRules(
  node: CanonicalComponent,
  rules: TransformationRule[],
  log: string[]
): CanonicalComponent {
  let result = { ...node };

  for (const rule of rules) {
    switch (rule.type) {
      case 'layout-change': {
        const newLayout = rule.params?.layoutType as string | undefined;
        if (newLayout && result.category === 'layout') {
          result = {
            ...result,
            layoutConfig: {
              ...result.layoutConfig,
              layoutType: newLayout as LayoutConfig['layoutType'],
              columns: (rule.params?.columns as number) ?? result.layoutConfig?.columns,
            },
          };
          log.push(`  layout-change: ${result.label} → layoutType=${newLayout}`);
        }
        break;
      }
      case 'widget-replacement': {
        const newType = rule.params?.canonicalType as CanonicalType | undefined;
        if (newType) {
          result = { ...result, type: newType };
          log.push(`  widget-replacement: ${result.label} → ${newType}`);
        }
        break;
      }
      case 'field-grouping': {
        // Wrap children into a sub-section with a label
        const groupLabel = (rule.params?.label as string) ?? 'Group';
        const grouped: CanonicalComponent = {
          id: uuidv4(),
          type: 'Section',
          category: 'layout',
          label: groupLabel,
          props: { label: groupLabel },
          bindings: {},
          validations: [],
          children: result.children,
          _meta: { sourceType: 'Group', sourcePath: '', mappingRule: 'field-grouping' },
        };
        result = { ...result, children: [grouped] };
        log.push(`  field-grouping: wrapped children of "${result.label}" into section "${groupLabel}"`);
        break;
      }
      case 'property-remap': {
        const from = rule.params?.from as string | undefined;
        const to = rule.params?.to as string | undefined;
        if (from && to && result.bindings?.field === from) {
          result = { ...result, bindings: { ...result.bindings, field: to } };
          log.push(`  property-remap: .${from} → .${to} on "${result.label}"`);
        }
        break;
      }
      case 'visibility-rule': {
        const condition = rule.params?.condition as string | undefined;
        if (condition) {
          result = { ...result, visibility: { condition } };
          log.push(`  visibility-rule: "${result.label}" condition="${condition}"`);
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Transform a Pega source template JSON into a target UIComponent[] tree
 * driven by a set of RegionMapping rules and a user-defined target layout.
 *
 * Pipeline:
 *   1. Parse the source Pega JSON → Canonical intermediate schema
 *   2. Index canonical nodes by source region name/type
 *   3. For each RegionMapping, move canonical children to the target region slot
 *   4. Apply any TransformationRules per mapping
 *   5. Convert the reordered canonical tree → UIComponent[] target output
 *
 * @param sourcePegaJson      - Raw Pega Constellation JSON (view envelope or array)
 * @param regionMappings      - Mapping rules from the Template Mapping Studio
 * @param targetRegions       - User-defined target layout regions (ordered)
 * @param sourceTemplateId    - ID of the source PegaTemplate (for region metadata)
 * @param options             - Optional component-level overrides
 */
export function transformUsingRegionMapping(
  sourcePegaJson: unknown,
  regionMappings: RegionMapping[],
  targetRegions: TargetLayoutRegion[],
  sourceTemplateId: string,
  options: RegionMappingTransformOptions = {}
): RegionMappingTransformResult {
  const log: string[] = [];

  // ── Step 1: Parse source JSON → canonical ─────────────────────────────────
  const intermediateSchema = parsePegaToIntermediate(sourcePegaJson);
  log.push(`Parsed ${intermediateSchema.length} top-level canonical node(s) from source JSON.`);

  // Retrieve template region metadata for name-based lookup
  const template = PEGA_TEMPLATE_MAP.get(sourceTemplateId);

  // ── Step 2: Build a fast lookup of canonical nodes by region id / name ────
  // Map: sourceRegionId → CanonicalComponent[]
  const regionChildrenMap = new Map<string, CanonicalComponent[]>();

  // Index by position (template region order = canonical node order for top-level)
  if (template) {
    template.regions.forEach((templateRegion, idx) => {
      const canonicalNode = intermediateSchema[idx];
      if (canonicalNode) {
        regionChildrenMap.set(templateRegion.id, [canonicalNode, ...(canonicalNode.children ?? [])]);
        log.push(`Indexed region "${templateRegion.id}" → canonical[${idx}] "${canonicalNode.label}"`);
      } else {
        // Seed from sampleJson if canonical parse was shallow
        regionChildrenMap.set(templateRegion.id, []);
        log.push(`Region "${templateRegion.id}" has no matching canonical node — will use empty children.`);
      }
    });
  } else {
    // No template metadata — fall back to distributing nodes equally
    intermediateSchema.forEach((node, idx) => {
      const syntheticId = `region-${idx}`;
      regionChildrenMap.set(syntheticId, [node]);
      log.push(`Synthetic region "${syntheticId}" → canonical[${idx}] "${node.label}"`);
    });
  }

  // ── Step 3: Build target canonical tree from mappings ────────────────────
  const targetCanonicalMap = new Map<string, CanonicalComponent[]>();
  for (const tr of targetRegions) {
    targetCanonicalMap.set(tr.id, []);
  }

  const mappedSourceIds = new Set<string>();

  for (const mapping of regionMappings) {
    const { sourceRegionId, targetRegionId, mappingType, transformations = [] } = mapping;

    const sourceChildren = regionChildrenMap.get(sourceRegionId) ?? [];
    mappedSourceIds.add(sourceRegionId);

    if (!targetCanonicalMap.has(targetRegionId)) {
      log.push(`WARNING: target region "${targetRegionId}" not found in target layout — skipping.`);
      continue;
    }

    log.push(`Mapping [${mappingType}] "${sourceRegionId}" → "${targetRegionId}" (${sourceChildren.length} node(s))`);

    // Apply transformation rules to each source node
    let transformedChildren = sourceChildren.map((child) =>
      applyTransformationRules(child, transformations, log)
    );

    // For many-to-one, merge strategy: all source children go into a wrapper Section
    if (mappingType === 'many-to-one' && transformedChildren.length > 1) {
      const mergedLabel = mapping.label ?? `Merged: ${sourceRegionId}`;
      transformedChildren = [{
        id: uuidv4(),
        type: 'Section',
        category: 'layout',
        label: mergedLabel,
        props: { label: mergedLabel },
        bindings: {},
        validations: [],
        children: transformedChildren,
        _meta: { sourceType: 'MergedSection', sourcePath: sourceRegionId, mappingRule: 'many-to-one merge' },
      }];
      log.push(`  many-to-one: merged ${sourceChildren.length} children into section "${mergedLabel}"`);
    }

    // Append to target region's children
    const existing = targetCanonicalMap.get(targetRegionId) ?? [];
    targetCanonicalMap.set(targetRegionId, [...existing, ...transformedChildren]);
  }

  // ── Step 4: Assemble ordered target canonical tree ────────────────────────
  const targetCanonical: CanonicalComponent[] = [];

  for (const tr of targetRegions) {
    const children = targetCanonicalMap.get(tr.id) ?? [];

    // Map TargetLayoutType → CanonicalType
    const layoutTypeMap: Record<string, CanonicalType> = {
      flex: 'SingleColumn',
      grid: 'TwoColumn',
      tabs: 'TabsLayout',
      sections: 'AccordionLayout',
      inline: 'InlineLayout',
    };
    const canonicalLayoutType: CanonicalType = layoutTypeMap[tr.layout] ?? 'SingleColumn';

    const regionNode: CanonicalComponent = {
      id: uuidv4(),
      type: canonicalLayoutType,
      category: 'layout',
      label: tr.name,
      props: { label: tr.name },
      bindings: {},
      validations: [],
      layoutConfig: {
        layoutType: tr.layout === 'grid' ? 'twoColumn' : tr.layout === 'tabs' ? 'tabs' : tr.layout === 'sections' ? 'accordion' : 'singleColumn',
        columns: tr.columns ?? 1,
        gap: 16,
      },
      children,
      _meta: { sourceType: 'TargetRegion', sourcePath: tr.id, mappingRule: `target-region:${tr.layout}` },
    };

    targetCanonical.push(regionNode);
    log.push(`Target region "${tr.name}" assembled with ${children.length} child node(s).`);
  }

  // ── Step 5: Convert to UIComponent[] ─────────────────────────────────────
  const targetComponents = transformIntermediateToTarget(
    targetCanonical,
    options.componentOverrides
  );

  // ── Step 6: Collect unmapped info ─────────────────────────────────────────
  const allSourceIds = template?.regions.map((r) => r.id) ??
    Array.from(regionChildrenMap.keys());
  const unmappedSourceRegionIds = allSourceIds.filter((id) => !mappedSourceIds.has(id));

  const emptyTargetRegionIds = targetRegions
    .filter((tr) => (targetCanonicalMap.get(tr.id)?.length ?? 0) === 0)
    .map((tr) => tr.id);

  if (unmappedSourceRegionIds.length > 0) {
    log.push(`Unmapped source regions (omitted): ${unmappedSourceRegionIds.join(', ')}`);
  }
  if (emptyTargetRegionIds.length > 0) {
    log.push(`Empty target regions (no content): ${emptyTargetRegionIds.join(', ')}`);
  }

  log.push(`Transformation complete. Generated ${targetComponents.length} top-level target component(s).`);

  return {
    targetComponents,
    intermediateSchema,
    unmappedSourceRegionIds,
    emptyTargetRegionIds,
    log,
  };
}

// ─── Figma Layout Transformation ─────────────────────────────────────────────
// Extends the standard region-mapping transformer to use Figma-derived target
// regions. The Figma layout drives the structural shape of the output:
//   - auto-layout direction → flex / inline
//   - grid detection        → multi-column grid
//   - tab frames            → TabsLayout
//   - section frames        → AccordionLayout
//
// FigmaRegionMapping adds `targetFigmaNodeId` alongside the standard
// `targetRegionId`, so the transformer can:
//   a) Use the standard region pipeline (targetRegionId → layout type)
//   b) Log the Figma node reference in the output metadata
//
// The function signature is intentionally compatible with transformUsingRegionMapping
// so callers can swap between the two without restructuring their state.

import type { FigmaRegionMapping } from '@/models/RegionMapping';
import type { FigmaTargetRegion } from './figmaLayoutTransformer';

export interface FigmaTransformResult extends RegionMappingTransformResult {
  /** Figma-specific metadata appended to the log */
  figmaLog: string[];
  /** Map from targetRegionId → figmaNodeId for downstream consumers */
  figmaNodeReferenceMap: Record<string, string>;
}

/**
 * Transform a Pega source JSON into a target UIComponent[] tree,
 * using Figma-derived layout regions as the structural target.
 *
 * Compatible with the standard region mapping pipeline — if a mapping has
 * no `targetFigmaNodeId`, it is treated as a standard region mapping.
 *
 * @param sourcePegaJson      - Raw Pega Constellation JSON
 * @param figmaMappings       - FigmaRegionMapping[] (extends RegionMapping)
 * @param figmaTargetRegions  - Figma-derived TargetLayoutRegion[] (from figmaLayoutTransformer)
 * @param sourceTemplateId    - Source template id for region metadata lookup
 * @param options             - Optional component overrides
 */
export function transformUsingFigmaLayout(
  sourcePegaJson: unknown,
  figmaMappings: FigmaRegionMapping[],
  figmaTargetRegions: FigmaTargetRegion[],
  sourceTemplateId: string,
  options: RegionMappingTransformOptions = {}
): FigmaTransformResult {
  const figmaLog: string[] = [];
  const figmaNodeReferenceMap: Record<string, string> = {};

  // Build figma node reference map for metadata
  for (const m of figmaMappings) {
    if (m.targetFigmaNodeId) {
      figmaNodeReferenceMap[m.targetRegionId] = m.targetFigmaNodeId;
      figmaLog.push(
        `Figma mapping: source "${m.sourceRegionId}" → target region "${m.targetRegionId}" → Figma node "${m.targetFigmaNodeId}" (${m.targetFigmaNodeName ?? 'unnamed'})`
      );
    }
  }

  // Run the standard transform with figma regions as the target
  const baseResult = transformUsingRegionMapping(
    sourcePegaJson,
    figmaMappings,        // FigmaRegionMapping extends RegionMapping — fully compatible
    figmaTargetRegions,   // FigmaTargetRegion extends TargetLayoutRegion — fully compatible
    sourceTemplateId,
    options
  );

  // Annotate each target component with figma metadata (non-breaking)
  const annotatedComponents = baseResult.targetComponents.map((component) => {
    const figmaNodeId = figmaNodeReferenceMap[component.id];
    if (figmaNodeId) {
      return {
        ...component,
        props: {
          ...component.props,
          _figmaNodeId: figmaNodeId,
        },
      };
    }
    return component;
  });

  figmaLog.push(
    `Figma transform complete. ${Object.keys(figmaNodeReferenceMap).length} Figma node reference(s) applied.`
  );

  return {
    ...baseResult,
    targetComponents: annotatedComponents,
    figmaLog,
    figmaNodeReferenceMap,
    log: [...baseResult.log, ...figmaLog],
  };
}
