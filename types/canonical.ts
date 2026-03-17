// ─── Canonical / Intermediate Schema ─────────────────────────────────────────
// This is the platform's internal representation that sits between
// the source format (e.g. Pega Constellation) and the target UI schema.
// It acts as a stable transformation contract independent of either end.

export type CanonicalType =
  | 'Container'
  | 'TextField'
  | 'TextArea'
  | 'Button'
  | 'Dropdown'
  | 'Label'
  | 'Checkbox'
  | 'RadioGroup'
  | 'DatePicker'
  | 'Unknown';

export interface CanonicalBinding {
  /** Data property reference extracted from source, e.g. "FirstName" */
  field?: string;
  /** Associated data source for lists, e.g. "CountryOptions" */
  dataSource?: string;
  [key: string]: unknown;
}

export type ValidationRule =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'custom';

export interface CanonicalValidation {
  rule: ValidationRule;
  /** Numeric threshold for min/maxLength, regex string for pattern */
  value?: string | number;
  message: string;
  /** Optional expression — validation is skipped when this evaluates to falsy */
  condition?: string;
}

export interface CanonicalVisibility {
  /** When expression evaluates to false, component is hidden */
  condition?: string;
  hidden?: boolean;
}

export interface CanonicalMeta {
  /** Original type string from the source system */
  sourceType?: string;
  /** JSONPath-like path within the source document */
  sourcePath?: string;
  /** Human-readable description of the applied mapping rule */
  mappingRule?: string;
  /** True when no mapping rule matched and a fallback was used */
  unmapped?: boolean;
}

export interface CanonicalComponent {
  id: string;
  type: CanonicalType;
  /** Human-readable label shown in the mapping UI */
  label?: string;
  /** Arbitrary props after applying source → canonical mapping */
  props: Record<string, unknown>;
  /** Data bindings to back-end fields / data sources */
  bindings: CanonicalBinding;
  /** Validation rules extracted or inferred from source */
  validations: CanonicalValidation[];
  /** Conditional visibility rules */
  visibility?: CanonicalVisibility;
  children: CanonicalComponent[];
  /** Internal metadata used by the mapping UI — not emitted in target output */
  _meta: CanonicalMeta;
}

// ─── Transform Project ────────────────────────────────────────────────────────
// Persisted record representing a single end-to-end transformation pipeline.

export type TransformStatus = 'draft' | 'parsed' | 'mapped' | 'complete';
/** Output format for the generated target schema */
export type TargetFormat = 'native' | 'a2ui';
export interface MappingOverrideSerialized {
  overrideTargetType?: string;
  overrideProps?: Record<string, unknown>;
}

export interface TransformProject {
  id: string;
  name: string;
  description?: string;
  status: TransformStatus;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
  // Pipeline data (each field holds the output of its step)
  sourceText: string;
  intermediateSchema: CanonicalComponent[];
  overrides: Record<string, MappingOverrideSerialized>;   // keyed by canonical id
  targetFormat: TargetFormat;
  targetJSON: string;
}
