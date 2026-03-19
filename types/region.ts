// ─── Region Model ─────────────────────────────────────────────────────────────
// Core data contract for the "Highlight & Map Regions" pipeline.
// A Region is a user-drawn rectangle on an uploaded design screenshot,
// enriched with AI-detected type intelligence and a schema mapping.

// ─── Bounding Box ─────────────────────────────────────────────────────────────

export interface RegionBoundingBox {
  /** Normalised (0–1) x origin, relative to image width */
  x: number;
  /** Normalised (0–1) y origin, relative to image height */
  y: number;
  /** Normalised (0–1) width */
  width: number;
  /** Normalised (0–1) height */
  height: number;
}

// ─── Detected Region Type ─────────────────────────────────────────────────────

export type RegionDetectedType =
  | 'Header'
  | 'FormSection'
  | 'Attachments'
  | 'ActivityFeed'
  | 'Steps'
  | 'DataGrid'
  | 'CaseSummary'
  | 'Navigation'
  | 'Footer'
  | 'Card'
  | 'Tabs'
  | 'Modal'
  | 'Unknown';

// ─── Mapping Category ─────────────────────────────────────────────────────────

export type RegionMappingCategory = 'layout' | 'widget' | 'fieldGroup';

// ─── Mapped Schema ────────────────────────────────────────────────────────────

export interface RegionMappedSchema {
  /** Broad category in the canonical / intermediate representation */
  category: RegionMappingCategory;
  /** Canonical type (aligns with CanonicalType in types/canonical.ts) */
  canonicalType: string;
  /** Corresponding Pega Constellation view / widget type */
  pegaType?: string;
  /** Human-readable mapping label shown in the UI */
  label?: string;
  /** Extra config (e.g. columns for grid, dataPage for widgets) */
  config?: Record<string, unknown>;
}

// ─── Region ───────────────────────────────────────────────────────────────────

export interface Region {
  /** UUID */
  id: string;
  /** User-assigned display name (e.g. "Claimant Details Form") */
  name: string;
  /** Normalised bounding box (0–1 relative to image dimensions) */
  boundingBox: RegionBoundingBox;
  /** Base64 data-URL of the cropped sub-image for this region */
  imageSegment: string;
  /** CSS colour string for the highlight box border / fill */
  color: string;
  /** AI-detected or user-set visual type */
  detectedType?: RegionDetectedType;
  /** Schema mapping assigned by the user or suggested by AI */
  mappedSchema?: RegionMappedSchema;
}

// ─── Analysis Result ──────────────────────────────────────────────────────────

export interface RegionAnalysisResult {
  regionId: string;
  detectedType: RegionDetectedType;
  confidence: number;
  suggestedMapping: RegionMappedSchema;
  reason: string;
  mock: boolean;
}

// ─── Export Package ───────────────────────────────────────────────────────────

export interface RegionExportPackage {
  exportedAt: string;
  imageWidth: number;
  imageHeight: number;
  regions: Region[];
  /** Pega metadata JSON derived from the mapped regions */
  pegaMetadata?: Record<string, unknown>;
}
