/**
 * RegionMapping — Core data model for the Template Mapping Studio.
 *
 * Represents a directed mapping from a source Pega template region
 * to a user-defined target layout region, with optional transformation rules.
 */

// ─── Transformation Rule ──────────────────────────────────────────────────────

export type TransformationType =
  | 'layout-change'      // Change the layout type of the target region
  | 'widget-replacement' // Swap one widget type for another
  | 'field-grouping'     // Group multiple source fields into a single target section
  | 'property-remap'     // Rename or remap a data property path
  | 'visibility-rule';   // Inject a visibility condition

export interface TransformationRule {
  type: TransformationType;
  params?: Record<string, unknown>;
  /** Human-readable description of this transformation */
  label?: string;
}

// ─── Mapping Types ────────────────────────────────────────────────────────────

export type MappingType =
  | 'one-to-one'   // One source region → one target region
  | 'one-to-many'  // One source region split across multiple target regions
  | 'many-to-one'; // Multiple source regions merged into one target region

// ─── Region Mapping ───────────────────────────────────────────────────────────

export interface RegionMapping {
  /** Stable unique identifier for this mapping rule */
  id: string;
  /** Source region ID (from PegaTemplateRegion.id) */
  sourceRegionId: string;
  /** Target region ID (from TargetLayoutRegion.id) */
  targetRegionId: string;
  /**
   * Cardinality of the mapping:
   * - 'one-to-one':  direct 1:1 transfer
   * - 'one-to-many': fan out — source children distributed to multiple targets
   * - 'many-to-one': consolidation — multiple sources merged into one target
   */
  mappingType: MappingType;
  /** Optional transformation rules to apply during generation */
  transformations?: TransformationRule[];
  /** Optional display label overriding the auto-generated one */
  label?: string;
  /** Optional notes visible in the mapping review panel */
  notes?: string;
  /** Whether this mapping was suggested by AI vs. manually created */
  source: 'manual' | 'ai-suggested';
  /** AI confidence 0-1 (only set when source === 'ai-suggested') */
  confidence?: number;
}

// ─── Target Layout Region ─────────────────────────────────────────────────────

export type TargetLayoutType = 'flex' | 'grid' | 'tabs' | 'sections' | 'inline';

export interface TargetLayoutRegion {
  /** Stable unique identifier */
  id: string;
  /** User-defined name for this region */
  name: string;
  /** Layout model for this region */
  layout: TargetLayoutType;
  /** Column count (for grid/flex layouts) */
  columns?: number;
  /** Row span hint */
  rows?: number;
  /** Whether child regions can be nested inside */
  nestable?: boolean;
  /** Orientation for flex regions */
  orientation?: 'horizontal' | 'vertical';
  /** Accent color hex for visual identification */
  color: string;
  /** Optional description / tooltip */
  description?: string;
  /** Order index in the target layout */
  order: number;
}

// ─── Target Layout ────────────────────────────────────────────────────────────

export interface TargetLayout {
  id: string;
  name: string;
  type: TargetLayoutType;
  regions: TargetLayoutRegion[];
  /** Created timestamp ISO string */
  createdAt: string;
}

// ─── Mapping Validation Issue ─────────────────────────────────────────────────

export type MappingIssueSeverity = 'error' | 'warning' | 'info';

export interface MappingIssue {
  severity: MappingIssueSeverity;
  mappingId?: string;
  regionId?: string;
  message: string;
}

// ─── Mapping Validation Result ────────────────────────────────────────────────

export interface MappingValidationSummary {
  valid: boolean;
  issues: MappingIssue[];
  totalSourceRegions: number;
  totalTargetRegions: number;
  mappedSourceRegions: number;
  mappedTargetRegions: number;
  unmappedSourceIds: string[];
  unmappedTargetIds: string[];
}

// ─── Template Mapping Project ─────────────────────────────────────────────────

export type ProjectStatus = 'draft' | 'mapped' | 'generated' | 'exported';

export interface TemplateMappingProject {
  id: string;
  name: string;
  /** The selected Pega source template ID */
  sourceTemplateId: string;
  /** Snapshot name of the source template at save time */
  sourceTemplateName: string;
  /** User-defined target layout */
  targetLayout: TargetLayout;
  /** All mapping rules */
  mappings: RegionMapping[];
  /** Last generated output JSON (null until first generation) */
  generatedOutput: unknown | null;
  /** Project lifecycle status */
  status: ProjectStatus;
  /** Persist-safe metadata */
  createdAt: string;
  updatedAt: string;
}

// ─── AI Suggestion Contract ───────────────────────────────────────────────────

export interface RegionMappingSuggestion {
  sourceRegionId: string;
  targetRegionId: string;
  mappingType: MappingType;
  confidence: number;
  reason: string;
}

// ─── Mapping Utilities ────────────────────────────────────────────────────────

/** Derive an auto-label for a mapping given source/target region names */
export function deriveMappingLabel(sourceName: string, targetName: string): string {
  return `${sourceName} → ${targetName}`;
}

/** Validate a full set of region mappings and return a summary */
export function validateRegionMappings(
  mappings: RegionMapping[],
  sourceRegionIds: string[],
  targetRegionIds: string[]
): MappingValidationSummary {
  const issues: MappingIssue[] = [];

  // Check for duplicate one-to-one same-source mappings
  const sourceCount = new Map<string, number>();
  const targetCount = new Map<string, number>();
  for (const m of mappings) {
    sourceCount.set(m.sourceRegionId, (sourceCount.get(m.sourceRegionId) ?? 0) + 1);
    targetCount.set(m.targetRegionId, (targetCount.get(m.targetRegionId) ?? 0) + 1);
  }

  for (const m of mappings) {
    const srcCount = sourceCount.get(m.sourceRegionId) ?? 0;
    const tgtCount = targetCount.get(m.targetRegionId) ?? 0;

    if (m.mappingType === 'one-to-one' && srcCount > 1) {
      issues.push({
        severity: 'warning',
        mappingId: m.id,
        message: `Source region "${m.sourceRegionId}" is mapped ${srcCount} times but type is one-to-one. Consider changing to one-to-many.`,
      });
    }
    if (m.mappingType === 'one-to-one' && tgtCount > 1) {
      issues.push({
        severity: 'warning',
        mappingId: m.id,
        message: `Target region "${m.targetRegionId}" receives ${tgtCount} sources but type is one-to-one. Consider changing to many-to-one.`,
      });
    }

    // Reference integrity
    if (!sourceRegionIds.includes(m.sourceRegionId)) {
      issues.push({
        severity: 'error',
        mappingId: m.id,
        message: `Mapping references unknown source region "${m.sourceRegionId}".`,
      });
    }
    if (!targetRegionIds.includes(m.targetRegionId)) {
      issues.push({
        severity: 'error',
        mappingId: m.id,
        message: `Mapping references unknown target region "${m.targetRegionId}".`,
      });
    }
  }

  const mappedSourceIds = new Set(mappings.map((m) => m.sourceRegionId));
  const mappedTargetIds = new Set(mappings.map((m) => m.targetRegionId));
  const unmappedSourceIds = sourceRegionIds.filter((id) => !mappedSourceIds.has(id));
  const unmappedTargetIds = targetRegionIds.filter((id) => !mappedTargetIds.has(id));

  for (const id of unmappedSourceIds) {
    issues.push({ severity: 'info', regionId: id, message: `Source region "${id}" has no mapping — it will be omitted from output.` });
  }
  for (const id of unmappedTargetIds) {
    issues.push({ severity: 'warning', regionId: id, message: `Target region "${id}" receives no content — it will appear empty.` });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues,
    totalSourceRegions: sourceRegionIds.length,
    totalTargetRegions: targetRegionIds.length,
    mappedSourceRegions: mappedSourceIds.size,
    mappedTargetRegions: mappedTargetIds.size,
    unmappedSourceIds,
    unmappedTargetIds,
  };
}
