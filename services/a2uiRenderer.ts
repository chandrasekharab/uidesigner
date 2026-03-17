/**
 * A2UI Renderer Service
 *
 * Integration layer between the platform and the A2UI SDK.
 * Handles schema preparation, validation, and lifecycle concerns
 * so UI components remain thin.
 *
 * Supports two input formats:
 *   1. Internal UIComponent[] format  { id, type, props, children }
 *   2. Google A2UI SDK format         { id, component: { TextField: { ... } } }
 */

import { v4 as uuidv4 } from 'uuid';
import type { UIComponent, ComponentType } from '@/types';
import { getDefaultProps } from '@/utils/componentDefaults';
import { MockA2UIClient, type A2UIValidationResult } from './mockA2UI';
import { getRenderer, type RendererType } from './rendererFactory';

// ─── Google A2UI SDK Format Converter ────────────────────────────────────────

/**
 * Map Google A2UI SDK component names to internal component types.
 * https://developers.google.com/assistant/df-asdk/a2ui
 */
const A2UI_COMPONENT_MAP: Record<string, ComponentType> = {
  TextField: 'TextInput',
  TextInput: 'TextInput',
  PasswordField: 'TextInput',
  DateTimeField: 'TextInput',
  NumberField: 'TextInput',
  EmailField: 'TextInput',
  TextArea: 'TextInput',
  Button: 'Button',
  SubmitButton: 'Button',
  LinkButton: 'Button',
  FlexContainer: 'Container',
  Container: 'Container',
  FormContainer: 'Container',
  Card: 'Container',
  Section: 'Container',
  SelectField: 'Dropdown',
  DropdownField: 'Dropdown',
  ComboBox: 'Dropdown',
  TextContent: 'Text',
  Label: 'Text',
  Header: 'Text',
  Paragraph: 'Text',
  Heading: 'Text',
};

/**
 * Resolve a Google A2UI string value.
 *   { literalString: "Hello" } → "Hello"
 *   { path: "/user/name" }     → "/user/name"
 *   "plain string"             → "plain string"
 */
function resolveString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'object') return String(val);
  const v = val as Record<string, unknown>;
  if ('literalString' in v) return String(v.literalString ?? '');
  if ('path' in v) return String(v.path ?? '');
  if ('i18nKey' in v) return String(v.i18nKey ?? '');
  return '';
}

/**
 * Convert a single Google A2UI SDK node into a UIComponent.
 */
function convertA2UINode(raw: Record<string, unknown>): UIComponent {
  const id = String(raw.id ?? uuidv4());
  const componentDef = raw.component as Record<string, unknown> | undefined;

  // No component definition — wrap as empty container
  if (!componentDef || typeof componentDef !== 'object') {
    return {
      id,
      type: 'Container',
      props: getDefaultProps('Container'),
      children: [],
    };
  }

  // The A2UI format uses { "component": { "TypeName": { ...props } } }
  const entries = Object.entries(componentDef);
  const [a2uiTypeName = 'TextContent', rawProps = {}] = entries[0] ?? [];
  const p = (rawProps ?? {}) as Record<string, unknown>;

  const internalType: ComponentType = A2UI_COMPONENT_MAP[a2uiTypeName] ?? 'Text';
  const defaults = { ...getDefaultProps(internalType) } as Record<string, unknown>;

  switch (internalType) {
    case 'TextInput': {
      if (p.label !== undefined) defaults.label = resolveString(p.label);
      if (p.placeholder !== undefined) defaults.placeholder = resolveString(p.placeholder);
      if (p.helperText !== undefined) defaults.helperText = resolveString(p.helperText);
      // Bind display value to path for context
      const path = resolveString(p.text ?? p.value ?? p.path ?? '');
      if (path) defaults.placeholder = defaults.placeholder || `e.g. ${path}`;
      if (typeof p.required === 'boolean') defaults.required = p.required;
      if (typeof p.disabled === 'boolean') defaults.disabled = p.disabled;
      // Map A2UI field types to HTML input types
      const typeMap: Record<string, string> = {
        shortText: 'text', longText: 'text', email: 'email',
        number: 'number', password: 'password', date: 'text',
        PasswordField: 'password', EmailField: 'email', NumberField: 'number',
      };
      const fieldType = p.type ? typeMap[String(p.type)] ?? 'text' : 'text';
      if (a2uiTypeName === 'PasswordField') defaults.type = 'password';
      else if (a2uiTypeName === 'EmailField') defaults.type = 'email';
      else if (a2uiTypeName === 'NumberField') defaults.type = 'number';
      else defaults.type = fieldType;
      break;
    }
    case 'Button': {
      defaults.label = resolveString(p.label ?? p.text ?? p.title ?? 'Submit');
      if (p.variant) defaults.variant = String(p.variant);
      if (typeof p.disabled === 'boolean') defaults.disabled = p.disabled;
      if (typeof p.fullWidth === 'boolean') defaults.fullWidth = p.fullWidth;
      if (a2uiTypeName === 'SubmitButton') defaults.variant = 'primary';
      if (a2uiTypeName === 'LinkButton') defaults.variant = 'ghost';
      break;
    }
    case 'Container': {
      const isRow =
        p.direction === 'horizontal' ||
        p.layout === 'horizontal' ||
        p.flexDirection === 'row';
      defaults.layout = isRow ? 'horizontal' : 'vertical';
      if (typeof p.gap === 'number') defaults.gap = p.gap;
      if (typeof p.padding === 'number') defaults.padding = p.padding;
      break;
    }
    case 'Dropdown': {
      if (p.label !== undefined) defaults.label = resolveString(p.label);
      if (p.placeholder !== undefined) defaults.placeholder = resolveString(p.placeholder);
      if (typeof p.required === 'boolean') defaults.required = p.required;
      if (typeof p.disabled === 'boolean') defaults.disabled = p.disabled;
      if (Array.isArray(p.options)) {
        defaults.options = p.options.map((o: unknown) => {
          if (typeof o === 'object' && o !== null) {
            const opt = o as Record<string, unknown>;
            return {
              label: resolveString(opt.label ?? opt.text ?? opt.value ?? ''),
              value: String(opt.value ?? opt.id ?? ''),
            };
          }
          return { label: String(o), value: String(o) };
        });
      }
      break;
    }
    case 'Text': {
      defaults.content = resolveString(p.text ?? p.content ?? p.label ?? p.value ?? '');
      const variantMap: Record<string, string> = {
        h1: 'h1', h2: 'h2', h3: 'h3', heading: 'h2',
        body: 'body', caption: 'caption', label: 'label',
      };
      if (p.variant) defaults.variant = variantMap[String(p.variant)] ?? 'body';
      if (a2uiTypeName === 'Header' || a2uiTypeName === 'Heading') defaults.variant = 'h2';
      if (a2uiTypeName === 'Label') defaults.variant = 'label';
      if (typeof p.bold === 'boolean') defaults.bold = p.bold;
      if (typeof p.italic === 'boolean') defaults.italic = p.italic;
      break;
    }
  }

  // Children can be nested in different ways depending on the A2UI version
  const childSources = [p.components, p.children, p.items, raw.children];
  const rawChildren = childSources.find(Array.isArray) ?? [];

  return {
    id,
    type: internalType,
    props: defaults as UIComponent['props'],
    children: (rawChildren as Record<string, unknown>[]).map(convertA2UINode),
  };
}

/**
 * Detect whether a parsed JSON array is in Google A2UI SDK format.
 * Heuristic: first item has a "component" key whose value is an object.
 */
export function isA2UIFormat(schema: unknown[]): boolean {
  if (schema.length === 0) return false;
  const first = schema[0] as Record<string, unknown>;
  return (
    typeof first === 'object' &&
    first !== null &&
    'component' in first &&
    typeof first.component === 'object' &&
    first.component !== null
  );
}

/**
 * Convert a Google A2UI SDK schema array into internal UIComponent[].
 */
export function convertA2UISchema(schema: unknown[]): UIComponent[] {
  return (schema as Record<string, unknown>[]).map(convertA2UINode);
}

// ─── Schema Preparation ───────────────────────────────────────────────────────

/**
 * Parse a raw JSON string and return a UIComponent array.
 * Auto-detects Google A2UI SDK format and converts it transparently.
 * Throws on malformed JSON.
 */
export function prepareSchema(raw: string): UIComponent[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Schema root must be a JSON array.');
  }
  if (isA2UIFormat(parsed)) {
    return convertA2UISchema(parsed);
  }
  return parsed as UIComponent[];
}

/**
 * Validate a UIComponent array against A2UI rendering requirements.
 */
export function validateSchemaForA2UI(schema: unknown): A2UIValidationResult {
  return MockA2UIClient.validate(schema);
}

/**
 * Validate a raw JSON string — parses first, auto-converts A2UI format,
 * then validates against internal schema requirements.
 */
export function validateRawJSON(raw: string): A2UIValidationResult {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { valid: false, errors: ['Root must be a JSON array.'], warnings: [] };
    }
    if (isA2UIFormat(parsed)) {
      const converted = convertA2UISchema(parsed);
      const result = MockA2UIClient.validate(converted);
      return {
        ...result,
        warnings: [
          'Google A2UI SDK format detected — auto-converting to internal schema.',
          ...result.warnings,
        ],
      };
    }
    return MockA2UIClient.validate(parsed);
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON parse error: ${(e as Error).message}`],
      warnings: [],
    };
  }
}

// ─── SDK Info ─────────────────────────────────────────────────────────────────

export interface SDKInfo {
  name: string;
  version: string;
  mock: boolean;
  capabilities: string[];
}

export function getSDKInfo(type: RendererType = 'a2ui'): SDKInfo {
  const adapter = getRenderer(type);
  return {
    name: adapter.sdkName,
    version: adapter.sdkVersion,
    mock: adapter.sdkVersion.includes('mock'),
    capabilities: [
      'JSON schema rendering',
      'Google A2UI SDK format (auto-detected)',
      'Light / dark theming',
      'Interactive form elements',
      'Event emission',
      'Debug overlay',
      'Schema validation',
    ],
  };
}

// ─── Schema Hints ─────────────────────────────────────────────────────────────

/**
 * Auto-repair common schema issues before rendering.
 * Returns the repaired schema and a list of changes applied.
 */
export function autoRepairSchema(
  schema: UIComponent[]
): { schema: UIComponent[]; repairs: string[] } {
  const repairs: string[] = [];

  function repairNode(node: UIComponent): UIComponent {
    const fixed = { ...node };

    if (!fixed.props || typeof fixed.props !== 'object') {
      fixed.props = {} as UIComponent['props'];
      repairs.push(`[${node.id}] Added missing props object`);
    }

    if (!Array.isArray(fixed.children)) {
      fixed.children = [];
      repairs.push(`[${node.id}] Added missing children array`);
    } else {
      fixed.children = fixed.children.map(repairNode);
    }

    if (fixed.type === 'Button') {
      const p = fixed.props as Record<string, unknown>;
      if (!p.label) {
        (fixed.props as Record<string, unknown>).label = 'Button';
        repairs.push(`[${node.id}] Added default label for Button`);
      }
    }

    if (fixed.type === 'Text') {
      const p = fixed.props as Record<string, unknown>;
      if (!p.content) {
        (fixed.props as Record<string, unknown>).content = '';
        repairs.push(`[${node.id}] Added empty content for Text`);
      }
    }

    return fixed;
  }

  return { schema: schema.map(repairNode), repairs };
}

