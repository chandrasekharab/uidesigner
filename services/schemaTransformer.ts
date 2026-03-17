import { v4 as uuidv4 } from 'uuid';
import type {
  CanonicalComponent,
  CanonicalType,
  CanonicalBinding,
  CanonicalValidation,
  TargetFormat,
} from '@/types/canonical';
import type { UIComponent, ComponentType } from '@/types';
import {
  PEGA_TYPE_MAP,
  TYPE_MAPPINGS,
  CANONICAL_TO_TARGET,
} from '@/config/schemaMappings';
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

function parsePegaNode(
  raw: Record<string, unknown>,
  path: string
): CanonicalComponent {
  const pegaType = String(raw.type ?? 'Unknown');
  const config = (raw.config ?? {}) as Record<string, unknown>;
  const mapping = PEGA_TYPE_MAP.get(pegaType);

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
  const rawChildren = Array.isArray(raw.children)
    ? (raw.children as Record<string, unknown>[])
    : [];
  const children = rawChildren.map((child, i) =>
    parsePegaNode(child, `${path}.children[${i}]`)
  );

  return {
    id: uuidv4(),
    type: (mapping?.canonicalType ?? 'Unknown') as CanonicalType,
    label: String(props.label ?? raw.name ?? pegaType),
    props,
    bindings,
    validations,
    visibility: visibilityRaw,
    children,
    _meta: {
      sourceType: pegaType,
      sourcePath: path,
      mappingRule: mapping
        ? `${pegaType} → ${mapping.canonicalType} → ${mapping.targetType}`
        : `${pegaType} → Unknown (no mapping)`,
      unmapped: !mapping,
    },
  };
}

/**
 * Convert a Pega Constellation View JSON document into the platform's
 * intermediate canonical schema.
 *
 * Accepts a single Pega View object or an array of them.
 */
export function parsePegaToIntermediate(pegaJson: unknown): CanonicalComponent[] {
  const nodes = Array.isArray(pegaJson) ? pegaJson : [pegaJson];
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

  // ── 1. Passthrough ALL canonical props ────────────────────────────────────
  // Skip internal carry-overs (_src_*). Wrap strings in A2UI literalString;
  // numbers, booleans, arrays and objects are forwarded as-is.
  const A2UI_RENAMES: Record<string, string> = {
    content:   'text',       // Text component body
    type:      'inputType',  // HTML input type (text/email/password/number)
  };
  for (const [key, value] of Object.entries(p)) {
    if (key.startsWith('_src_') || value === undefined || value === null) continue;
    const outKey = A2UI_RENAMES[key] ?? key;
    if (typeof value === 'string') {
      props[outKey] = strLiteral(value);
    } else {
      props[outKey] = value;
    }
  }

  // ── 2. Top-level canonical label (may live outside props) ─────────────────
  if (canonical.label && !props.label) {
    props.label = strLiteral(canonical.label);
  }

  // ── 3. Data bindings override static values ───────────────────────────────
  if (b.field)       props.value      = { path: `/${b.field}` };
  if (b.dataSource)  props.dataSource = { path: `/${b.dataSource}` };
  // Forward any extra binding keys
  for (const [key, value] of Object.entries(b)) {
    if (key === 'field' || key === 'dataSource' || value === undefined) continue;
    if (typeof value === 'string') props[key] = { path: value };
  }

  // ── 4. Validation rules ────────────────────────────────────────────────────
  const requiredRule = vs.find((v) => v.rule === 'required');
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

  // ── 5. User prop overrides win ─────────────────────────────────────────────
  if (override?.overrideProps) Object.assign(props, override.overrideProps);

  // ── 6. Recurse children ────────────────────────────────────────────────────
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

  return {
    id: canonical.id,
    component: { [a2uiType]: a2uiPropsFromCanonical(canonical, overrides) },
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
