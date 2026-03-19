// ─── Canonical / Intermediate Schema ─────────────────────────────────────────
// This is the platform's internal representation that sits between
// the source format (e.g. Pega Constellation) and the target UI schema.
// It acts as a stable transformation contract independent of either end.

// ─── Component Category ───────────────────────────────────────────────────────
/** Broad category for a canonical node — drives validation, UI icons, and mapping rules. */
export type CanonicalCategory = 'field' | 'layout' | 'widget';

export type CanonicalType =
  // ── Field types ─────────────────────────────────────────────────────────
  | 'Container'
  | 'TextField'
  | 'TextArea'
  | 'Button'
  | 'Dropdown'
  | 'Label'
  | 'Checkbox'
  | 'RadioGroup'
  | 'DatePicker'
  | 'Unknown'
  // ── Layout types ────────────────────────────────────────────────────────
  | 'SingleColumn'   // Pega: Region with layout "stacked" or 1-col
  | 'TwoColumn'      // Pega: Region with layout "twoColumn"
  | 'ThreeColumn'    // Pega: Region with layout "threeColumn"
  | 'FourColumn'     // Pega: Region with layout "fourColumn"
  | 'InlineLayout'   // Pega: Region with layout "inline" (horizontal row)
  | 'TabsLayout'     // Pega: Region of type "tabs"
  | 'AccordionLayout'// Pega: Region of type "accordion"
  | 'Section'        // Pega: Named section / group
  // ── Widget types ────────────────────────────────────────────────────────
  | 'PulseWidget'        // Pega: pxPulse — activity / discussion feed
  | 'AttachmentsWidget'  // Pega: pxAttachContent — file attachment area
  | 'StepsWidget'        // Pega: pxProcessSteps — case stage / progress stepper
  | 'DataGrid'           // Pega: DataGrid / pxDynGridView — tabular data
  | 'CaseSummary'        // Pega: pxCaseSummary — case header summary
  | 'RichTextWidget'     // Pega: RichText — formatted HTML content
  | 'EmbeddedView';      // Pega: Embedded sub-view / embedded harness

// ─── Layout Configuration ─────────────────────────────────────────────────────
/** Structural layout configuration attached to layout-category canonical nodes. */
export interface LayoutConfig {
  /** Resolved layout variant */
  layoutType?: 'singleColumn' | 'twoColumn' | 'threeColumn' | 'fourColumn' | 'inline' | 'tabs' | 'accordion' | 'section';
  /** Number of columns (1–4) — populated for grid layouts */
  columns?: number;
  /** Gap between children in pixels */
  gap?: number;
  /** Spacing density */
  spacing?: 'compact' | 'normal' | 'spacious';
  /** Tab labels — populated for TabsLayout */
  tabLabels?: string[];
  /** Accordion section titles — populated for AccordionLayout */
  accordionLabels?: string[];
  /** Whether sections/accordion panels start collapsed */
  collapsible?: boolean;
  /** Responsive breakpoint override */
  breakpoint?: 'sm' | 'md' | 'lg';
}

// ─── Widget Configuration ─────────────────────────────────────────────────────
/** Widget-specific configuration attached to widget-category canonical nodes. */
export interface WidgetConfig {
  /** Pega data page or D_ class for data-driven widgets */
  dataPageClass?: string;
  /** Property used to populate the widget */
  sourceProperty?: string;
  /** Maximum rows/items to display */
  maxItems?: number;
  /** Whether the widget allows interaction (e.g. add attachment) */
  interactive?: boolean;
  /** For EmbeddedView: the target view name */
  viewName?: string;
  /** For EmbeddedView: the class context */
  classReference?: string;
  /** Column definitions for DataGrid */
  columns?: Array<{ header: string; property: string; sortable?: boolean }>;
  /** Step items for StepsWidget */
  steps?: Array<{ label: string; status?: 'complete' | 'active' | 'pending' }>;
}

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

// ─── Data Source Reference ────────────────────────────────────────────────────
/** Describes an external / clipboard data source used by a widget or field. */
export interface CanonicalDataSource {
  /** How this source is resolved at runtime */
  type?: 'static' | 'dataPage' | 'clipboard' | 'caseProperty';
  /** Data Page or class name (e.g. "D_EmployeeList") */
  sourceClass?: string;
  /** Clipboard property reference (e.g. ".AttachmentsList") */
  property?: string;
  /** Optional filter expression */
  filter?: string;
  /** Additional parameters for data page calls */
  parameters?: Record<string, unknown>;
}

export interface CanonicalComponent {
  id: string;
  type: CanonicalType;
  /** Broad category — drives icon, validation rules, and UI rendering in the mapping panel */
  category?: CanonicalCategory;
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
  /** Layout configuration — present when category === 'layout' */
  layoutConfig?: LayoutConfig;
  /** Widget configuration — present when category === 'widget' */
  widgetConfig?: WidgetConfig;
  /** Data source reference — present on data-driven widgets */
  dataSource?: CanonicalDataSource;
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
