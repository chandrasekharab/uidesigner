import type { CanonicalType } from '@/types/canonical';
import type { ComponentType } from '@/types';

// ─── Prop Mapping ─────────────────────────────────────────────────────────────

export interface PropMapping {
  /** Key or dot-path in the Pega config object */
  source: string;
  /** Key in the canonical props object */
  target: string;
  /** Optional value transform */
  transform?: (value: unknown) => unknown;
}

// ─── Type Mapping ─────────────────────────────────────────────────────────────

export interface TypeMapping {
  pegaType: string;
  canonicalType: CanonicalType;
  targetType: ComponentType;
  propMappings: PropMapping[];
  /** Config key whose value contains the data binding, e.g. "@P .FirstName" */
  bindingPath?: string;
  /** Config keys from which to extract validation rules */
  validationPaths?: {
    required?: string;
    readOnly?: string;
    disabled?: string;
  };
}

// ─── Common Transforms ────────────────────────────────────────────────────────

/** Pega labels can be `{ value: "Text" }` objects or plain strings */
const labelVal = (v: unknown): string =>
  typeof v === 'object' && v !== null && 'value' in v
    ? String((v as { value: unknown }).value ?? '')
    : String(v ?? '');

// ─── Mapping Table ────────────────────────────────────────────────────────────
// Add new source types here to extend the pipeline without touching source code.

export const TYPE_MAPPINGS: TypeMapping[] = [
  // ── Input fields ──────────────────────────────────────────────────────────
  {
    pegaType: 'TextInput',
    canonicalType: 'TextField',
    targetType: 'TextInput',
    propMappings: [
      { source: 'label', target: 'label', transform: labelVal },
      { source: 'placeholder', target: 'placeholder' },
      { source: 'helperText', target: 'helperText' },
      { source: 'disabled', target: 'disabled' },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required', readOnly: 'readOnly', disabled: 'disabled' },
  },
  {
    pegaType: 'TextArea',
    canonicalType: 'TextArea',
    targetType: 'TextInput',
    propMappings: [
      { source: 'label',       target: 'label',       transform: labelVal },
      { source: 'placeholder', target: 'placeholder' },
      { source: 'helperText',  target: 'helperText'  },
      { source: 'disabled',    target: 'disabled'    },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required', readOnly: 'readOnly', disabled: 'disabled' },
  },
  {
    pegaType: 'Dropdown',
    canonicalType: 'Dropdown',
    targetType: 'Dropdown',
    propMappings: [
      { source: 'label', target: 'label', transform: labelVal },
      { source: 'placeholder', target: 'placeholder' },
      { source: 'disabled', target: 'disabled' },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required' },
  },
  {
    pegaType: 'Checkbox',
    canonicalType: 'Checkbox',
    targetType: 'TextInput',
    propMappings: [
      { source: 'label',   target: 'label',   transform: labelVal },
      { source: 'disabled', target: 'disabled' },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required', readOnly: 'readOnly', disabled: 'disabled' },
  },
  {
    pegaType: 'RadioButtons',
    canonicalType: 'RadioGroup',
    targetType: 'Dropdown',
    propMappings: [
      { source: 'label',       target: 'label',       transform: labelVal },
      { source: 'placeholder', target: 'placeholder' },
      { source: 'disabled',    target: 'disabled'    },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required', readOnly: 'readOnly', disabled: 'disabled' },
  },
  {
    pegaType: 'DateTime',
    canonicalType: 'DatePicker',
    targetType: 'TextInput',
    propMappings: [
      { source: 'label',       target: 'label',       transform: labelVal },
      { source: 'placeholder', target: 'placeholder' },
      { source: 'helperText',  target: 'helperText'  },
      { source: 'disabled',    target: 'disabled'    },
    ],
    bindingPath: 'value',
    validationPaths: { required: 'required', readOnly: 'readOnly', disabled: 'disabled' },
  },

  // ── Structural ────────────────────────────────────────────────────────────
  {
    pegaType: 'View',
    canonicalType: 'Container',
    targetType: 'Container',
    propMappings: [
      { source: 'name', target: 'label', transform: (v) => String(v ?? 'View') },
    ],
  },
  {
    pegaType: 'Region',
    canonicalType: 'Container',
    targetType: 'Container',
    propMappings: [
      { source: 'name', target: 'label', transform: (v) => String(v ?? 'Region') },
      { source: 'layout', target: 'layout' },
    ],
  },

  // ── Display ───────────────────────────────────────────────────────────────
  {
    pegaType: 'Button',
    canonicalType: 'Button',
    targetType: 'Button',
    propMappings: [
      { source: 'label',     target: 'label',     transform: labelVal },
      { source: 'variant',   target: 'variant'   },
      { source: 'size',      target: 'size'      },
      { source: 'disabled',  target: 'disabled'  },
      { source: 'fullWidth', target: 'fullWidth' },
    ],
    validationPaths: { disabled: 'disabled' },
  },
  {
    pegaType: 'Label',
    canonicalType: 'Label',
    targetType: 'Text',
    propMappings: [
      { source: 'value', target: 'content', transform: labelVal },
      { source: 'variant', target: 'variant' },
    ],
  },
  {
    pegaType: 'Text',
    canonicalType: 'Label',
    targetType: 'Text',
    propMappings: [
      { source: 'value', target: 'content', transform: labelVal },
    ],
  },
  {
    pegaType: 'RichText',
    canonicalType: 'Label',
    targetType: 'Text',
    propMappings: [
      { source: 'value', target: 'content', transform: labelVal },
    ],
  },
];

/** O(1) lookup by Pega type string */
export const PEGA_TYPE_MAP = new Map<string, TypeMapping>(
  TYPE_MAPPINGS.map((m) => [m.pegaType, m])
);

/** O(1) lookup by canonical type (returns the first registered mapping) */
export const CANONICAL_TYPE_MAP = new Map<CanonicalType, TypeMapping>();
for (const m of TYPE_MAPPINGS) {
  if (!CANONICAL_TYPE_MAP.has(m.canonicalType)) {
    CANONICAL_TYPE_MAP.set(m.canonicalType, m);
  }
}

/** All canonical type strings (for override dropdowns) */
export const ALL_CANONICAL_TYPES: CanonicalType[] = [
  'Container',
  'TextField',
  'TextArea',
  'Button',
  'Dropdown',
  'Label',
  'Checkbox',
  'RadioGroup',
  'DatePicker',
  'Unknown',
];

/** Map canonical type → default target type */
export const CANONICAL_TO_TARGET: Record<CanonicalType, ComponentType> = {
  Container: 'Container',
  TextField: 'TextInput',
  TextArea: 'TextInput',
  Button: 'Button',
  Dropdown: 'Dropdown',
  Label: 'Text',
  Checkbox: 'TextInput',
  RadioGroup: 'Dropdown',
  DatePicker: 'TextInput',
  Unknown: 'Text',
};
