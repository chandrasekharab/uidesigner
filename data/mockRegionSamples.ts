// ─── Mock Region Samples ──────────────────────────────────────────────────────
// Provides: colour palette, a programmatic SVG design screenshot, and
// pre-defined region examples for the "Highlight & Map Regions" feature.
// Used when no real image has been uploaded yet.

import type { Region, RegionMappedSchema } from '@/types/region';

// ─── Colour Palette ───────────────────────────────────────────────────────────

export const REGION_COLORS: string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f43f5e', // rose
];

/** Returns a colour from the palette based on an index (wraps around). */
export function regionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length];
}

// ─── Schema Mapping Options ───────────────────────────────────────────────────

export interface SchemaMappingOption {
  value: string;
  label: string;
  pegaType: string;
}

export const SCHEMA_MAPPING_OPTIONS: Record<string, SchemaMappingOption[]> = {
  layout: [
    { value: 'SingleColumn',    label: 'Single Column Layout',  pegaType: 'region' },
    { value: 'TwoColumn',       label: 'Two Column Layout',     pegaType: 'region' },
    { value: 'ThreeColumn',     label: 'Three Column Layout',   pegaType: 'region' },
    { value: 'FourColumn',      label: 'Four Column Layout',    pegaType: 'region' },
    { value: 'TabsLayout',      label: 'Tabs Layout',           pegaType: 'region' },
    { value: 'AccordionLayout', label: 'Accordion Layout',      pegaType: 'region' },
    { value: 'Section',         label: 'Section / Group',       pegaType: 'region' },
    { value: 'InlineLayout',    label: 'Inline Layout',         pegaType: 'region' },
  ],
  widget: [
    { value: 'PulseWidget',       label: 'Pulse / Activity Feed',  pegaType: 'pxPulse' },
    { value: 'AttachmentsWidget', label: 'Attachments',            pegaType: 'pxAttachContent' },
    { value: 'StepsWidget',       label: 'Process Steps',          pegaType: 'pxProcessSteps' },
    { value: 'DataGrid',          label: 'Data Grid',              pegaType: 'DataGrid' },
    { value: 'CaseSummary',       label: 'Case Summary',           pegaType: 'pxCaseSummary' },
    { value: 'EmbeddedView',      label: 'Embedded View',          pegaType: 'View' },
    { value: 'RichTextWidget',    label: 'Rich Text',              pegaType: 'RichText' },
  ],
  fieldGroup: [
    { value: 'SingleColumn', label: 'Single Column Fields', pegaType: 'region' },
    { value: 'TwoColumn',    label: 'Two Column Fields',    pegaType: 'region' },
    { value: 'ThreeColumn',  label: 'Three Column Fields',  pegaType: 'region' },
    { value: 'InlineLayout', label: 'Inline Fields',        pegaType: 'region' },
  ],
};

// ─── Mock Design SVG ──────────────────────────────────────────────────────────
// A programmatic SVG simulating a Pega Constellation case management screen.
// Dimensions: 900 × 700.  Used as the default image when no upload has occurred.

export const MOCK_DESIGN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700" font-family="Arial, sans-serif">
  <rect width="900" height="700" fill="#f8fafc"/>

  <!-- ── Header bar ──────────────────────────────────────────────────── -->
  <rect x="0" y="0" width="900" height="56" fill="#1e293b"/>
  <text x="20" y="36" fill="#f8fafc" font-size="18" font-weight="bold">Claim Case – CLM-1042</text>
  <text x="700" y="28" fill="#94a3b8" font-size="12">Status: Open</text>
  <rect x="820" y="14" width="60" height="28" rx="4" fill="#6366f1"/>
  <text x="850" y="33" fill="white" font-size="12" text-anchor="middle">Submit</text>

  <!-- ── Case Summary bar ───────────────────────────────────────────── -->
  <rect x="0" y="56" width="900" height="52" fill="#e2e8f0"/>
  <text x="20" y="77" fill="#334155" font-size="13" font-weight="bold">Claimant: John Smith</text>
  <text x="200" y="77" fill="#64748b" font-size="12">Policy #: POL-88221</text>
  <text x="380" y="77" fill="#64748b" font-size="12">Filed: 2025-01-15</text>
  <text x="540" y="77" fill="#64748b" font-size="12">Priority: High</text>
  <text x="20" y="97" fill="#64748b" font-size="11">Assigned to: Sarah Johnson  |  Region: Northeast  |  SLA: 3 days remaining</text>

  <!-- ── Process Steps ──────────────────────────────────────────────── -->
  <rect x="0" y="108" width="900" height="56" fill="#fff"/>
  <line x1="0" y1="164" x2="900" y2="164" stroke="#e2e8f0" stroke-width="1"/>
  <circle cx="100" cy="136" r="14" fill="#22c55e"/>
  <text x="100" y="141" fill="white" font-size="11" text-anchor="middle" font-weight="bold">1</text>
  <text x="100" y="158" fill="#22c55e" font-size="10" text-anchor="middle">Filed</text>
  <line x1="114" y1="136" x2="196" y2="136" stroke="#22c55e" stroke-width="2"/>
  <circle cx="210" cy="136" r="14" fill="#22c55e"/>
  <text x="210" y="141" fill="white" font-size="11" text-anchor="middle" font-weight="bold">2</text>
  <text x="210" y="158" fill="#22c55e" font-size="10" text-anchor="middle">Review</text>
  <line x1="224" y1="136" x2="326" y2="136" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="340" cy="136" r="14" fill="#6366f1"/>
  <text x="340" y="141" fill="white" font-size="11" text-anchor="middle" font-weight="bold">3</text>
  <text x="340" y="158" fill="#6366f1" font-size="10" text-anchor="middle">Assessment</text>
  <line x1="354" y1="136" x2="446" y2="136" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="460" cy="136" r="14" fill="#e2e8f0"/>
  <text x="460" y="141" fill="#94a3b8" font-size="11" text-anchor="middle" font-weight="bold">4</text>
  <text x="460" y="158" fill="#94a3b8" font-size="10" text-anchor="middle">Approval</text>
  <line x1="474" y1="136" x2="566" y2="136" stroke="#e2e8f0" stroke-width="2"/>
  <circle cx="580" cy="136" r="14" fill="#e2e8f0"/>
  <text x="580" y="141" fill="#94a3b8" font-size="11" text-anchor="middle" font-weight="bold">5</text>
  <text x="580" y="158" fill="#94a3b8" font-size="10" text-anchor="middle">Closed</text>

  <!-- ── Left column background ─────────────────────────────────────── -->
  <rect x="0" y="164" width="580" height="536" fill="#fff"/>

  <!-- Claimant Details section card -->
  <rect x="12" y="176" width="556" height="196" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="12" y="176" width="556" height="36" rx="6" fill="#f1f5f9"/>
  <text x="24" y="200" fill="#1e293b" font-size="13" font-weight="bold">Claimant Details</text>
  <text x="24" y="232" fill="#64748b" font-size="11">First Name</text>
  <rect x="24" y="238" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="32" y="257" fill="#334155" font-size="12">John</text>
  <text x="296" y="232" fill="#64748b" font-size="11">Last Name</text>
  <rect x="296" y="238" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="304" y="257" fill="#334155" font-size="12">Smith</text>
  <text x="24" y="284" fill="#64748b" font-size="11">Email Address</text>
  <rect x="24" y="290" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="32" y="309" fill="#334155" font-size="12">john.smith@email.com</text>
  <text x="296" y="284" fill="#64748b" font-size="11">Phone Number</text>
  <rect x="296" y="290" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="304" y="309" fill="#334155" font-size="12">+1 (555) 234-5678</text>
  <text x="24" y="338" fill="#64748b" font-size="11">Policy Type</text>
  <rect x="24" y="344" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="32" y="363" fill="#334155" font-size="12">Comprehensive Auto</text>
  <text x="254" y="363" fill="#94a3b8" font-size="14">▾</text>

  <!-- Incident Details section card -->
  <rect x="12" y="384" width="556" height="148" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="12" y="384" width="556" height="36" rx="6" fill="#f1f5f9"/>
  <text x="24" y="408" fill="#1e293b" font-size="13" font-weight="bold">Incident Details</text>
  <text x="24" y="440" fill="#64748b" font-size="11">Incident Date</text>
  <rect x="24" y="446" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="32" y="465" fill="#334155" font-size="12">2025-01-12</text>
  <text x="296" y="440" fill="#64748b" font-size="11">Estimated Damage</text>
  <rect x="296" y="446" width="240" height="28" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="304" y="465" fill="#334155" font-size="12">$4,200.00</text>
  <text x="24" y="492" fill="#64748b" font-size="11">Description</text>
  <rect x="24" y="498" width="512" height="24" rx="4" fill="#fff" stroke="#cbd5e1" stroke-width="1"/>
  <text x="32" y="514" fill="#94a3b8" font-size="11">Enter incident description...</text>

  <!-- ── Right column ────────────────────────────────────────────────── -->
  <rect x="580" y="164" width="320" height="536" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>

  <!-- Attachments card -->
  <rect x="592" y="176" width="296" height="184" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="592" y="176" width="296" height="36" rx="6" fill="#f1f5f9"/>
  <text x="604" y="200" fill="#1e293b" font-size="13" font-weight="bold">Attachments (3)</text>
  <rect x="856" y="184" width="20" height="20" rx="4" fill="#6366f1"/>
  <text x="866" y="199" fill="white" font-size="16" text-anchor="middle">+</text>
  <rect x="604" y="220" width="272" height="32" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="616" y="241" fill="#334155" font-size="11">accident_photo.jpg</text>
  <text x="840" y="241" fill="#94a3b8" font-size="10">1.2 MB</text>
  <rect x="604" y="258" width="272" height="32" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="616" y="279" fill="#334155" font-size="11">police_report.pdf</text>
  <text x="840" y="279" fill="#94a3b8" font-size="10">845 KB</text>
  <rect x="604" y="296" width="272" height="32" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="616" y="317" fill="#334155" font-size="11">insurance_card.pdf</text>
  <text x="840" y="317" fill="#94a3b8" font-size="10">234 KB</text>

  <!-- Activity Feed / Pulse card -->
  <rect x="592" y="372" width="296" height="248" rx="6" fill="#fff" stroke="#e2e8f0" stroke-width="1"/>
  <rect x="592" y="372" width="296" height="36" rx="6" fill="#f1f5f9"/>
  <text x="604" y="396" fill="#1e293b" font-size="13" font-weight="bold">Activity Feed</text>
  <circle cx="612" cy="424" r="12" fill="#6366f1"/>
  <text x="612" y="429" fill="white" font-size="10" text-anchor="middle">SJ</text>
  <text x="632" y="418" fill="#334155" font-size="11" font-weight="bold">Sarah Johnson</text>
  <text x="632" y="433" fill="#64748b" font-size="10">Case assigned for review</text>
  <text x="820" y="418" fill="#94a3b8" font-size="9">2h ago</text>
  <line x1="604" y1="448" x2="876" y2="448" stroke="#f1f5f9" stroke-width="1"/>
  <circle cx="612" cy="466" r="12" fill="#22c55e"/>
  <text x="612" y="471" fill="white" font-size="10" text-anchor="middle">JS</text>
  <text x="632" y="460" fill="#334155" font-size="11" font-weight="bold">John Smith</text>
  <text x="632" y="475" fill="#64748b" font-size="10">Submitted additional documents</text>
  <text x="820" y="460" fill="#94a3b8" font-size="9">5h ago</text>
  <line x1="604" y1="490" x2="876" y2="490" stroke="#f1f5f9" stroke-width="1"/>
  <circle cx="612" cy="508" r="12" fill="#f97316"/>
  <text x="612" y="513" fill="white" font-size="10" text-anchor="middle">SY</text>
  <text x="632" y="502" fill="#334155" font-size="11" font-weight="bold">System</text>
  <text x="632" y="517" fill="#64748b" font-size="10">Priority escalated to High</text>
  <text x="820" y="502" fill="#94a3b8" font-size="9">1d ago</text>
  <line x1="604" y1="532" x2="876" y2="532" stroke="#f1f5f9" stroke-width="1"/>
  <circle cx="612" cy="550" r="12" fill="#e2e8f0"/>
  <text x="612" y="555" fill="#64748b" font-size="10" text-anchor="middle">MR</text>
  <text x="632" y="544" fill="#334155" font-size="11" font-weight="bold">Mike Rodriguez</text>
  <text x="632" y="559" fill="#64748b" font-size="10">Initial assessment complete</text>
  <text x="820" y="544" fill="#94a3b8" font-size="9">2d ago</text>
  <rect x="604" y="588" width="248" height="24" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  <text x="612" y="604" fill="#94a3b8" font-size="11">Add a comment...</text>
  <rect x="856" y="588" width="24" height="24" rx="4" fill="#6366f1"/>
  <text x="868" y="604" fill="white" font-size="12" text-anchor="middle">&#8594;</text>
</svg>`;

/** Convert the SVG string to a base64 data-URL usable as an img src. */
export function getMockDesignDataUrl(): string {
  const encoded = encodeURIComponent(MOCK_DESIGN_SVG);
  return `data:image/svg+xml,${encoded}`;
}

// ─── Pre-defined Sample Regions ───────────────────────────────────────────────
// Coordinates are normalised (0–1) against the 900×700 SVG viewport.

type SampleRegion = Omit<Region, 'imageSegment'>;

export const SAMPLE_REGIONS: SampleRegion[] = [
  {
    id: 'region-header',
    name: 'Header',
    color: REGION_COLORS[0],
    boundingBox: { x: 0, y: 0, width: 1, height: 0.08 },
    detectedType: 'Header',
    mappedSchema: {
      category: 'widget',
      canonicalType: 'CaseSummary',
      pegaType: 'pxCaseSummary',
      label: 'Case Header',
    } as RegionMappedSchema,
  },
  {
    id: 'region-case-summary',
    name: 'Case Summary Bar',
    color: REGION_COLORS[4],
    boundingBox: { x: 0, y: 0.08, width: 1, height: 0.074 },
    detectedType: 'CaseSummary',
    mappedSchema: {
      category: 'widget',
      canonicalType: 'CaseSummary',
      pegaType: 'pxCaseSummary',
      label: 'Case Summary',
    } as RegionMappedSchema,
  },
  {
    id: 'region-steps',
    name: 'Process Steps',
    color: REGION_COLORS[5],
    boundingBox: { x: 0, y: 0.154, width: 1, height: 0.08 },
    detectedType: 'Steps',
    mappedSchema: {
      category: 'widget',
      canonicalType: 'StepsWidget',
      pegaType: 'pxProcessSteps',
      label: 'Case Stage Steps',
    } as RegionMappedSchema,
  },
  {
    id: 'region-claimant-form',
    name: 'Claimant Details',
    color: REGION_COLORS[1],
    boundingBox: { x: 0, y: 0.234, width: 0.645, height: 0.28 },
    detectedType: 'FormSection',
    mappedSchema: {
      category: 'fieldGroup',
      canonicalType: 'TwoColumn',
      pegaType: 'region',
      label: 'Claimant Details',
      config: { columns: 2 },
    } as RegionMappedSchema,
  },
  {
    id: 'region-incident-form',
    name: 'Incident Details',
    color: REGION_COLORS[2],
    boundingBox: { x: 0, y: 0.514, width: 0.645, height: 0.212 },
    detectedType: 'FormSection',
    mappedSchema: {
      category: 'fieldGroup',
      canonicalType: 'TwoColumn',
      pegaType: 'region',
      label: 'Incident Details',
      config: { columns: 2 },
    } as RegionMappedSchema,
  },
  {
    id: 'region-attachments',
    name: 'Attachments',
    color: REGION_COLORS[3],
    boundingBox: { x: 0.645, y: 0.234, width: 0.355, height: 0.263 },
    detectedType: 'Attachments',
    mappedSchema: {
      category: 'widget',
      canonicalType: 'AttachmentsWidget',
      pegaType: 'pxAttachContent',
      label: 'File Attachments',
    } as RegionMappedSchema,
  },
  {
    id: 'region-activity-feed',
    name: 'Activity Feed',
    color: REGION_COLORS[6],
    boundingBox: { x: 0.645, y: 0.497, width: 0.355, height: 0.354 },
    detectedType: 'ActivityFeed',
    mappedSchema: {
      category: 'widget',
      canonicalType: 'PulseWidget',
      pegaType: 'pxPulse',
      label: 'Case Activity Pulse',
    } as RegionMappedSchema,
  },
];

// ─── Region → Pega JSON generator ────────────────────────────────────────────

/** Derive a minimal Pega Constellation view JSON from a set of mapped regions. */
export function buildPegaMetadataFromRegions(
  regions: Region[],
  viewName = 'NewHarness'
): Record<string, unknown> {
  const mapped = regions.filter((r) => r.mappedSchema);

  const children = mapped.map((r) => {
    const m = r.mappedSchema!;
    if (m.category === 'widget') {
      return {
        type: 'View',
        config: {
          template: m.pegaType ?? m.canonicalType,
          label: m.label ?? r.name,
        },
      };
    }
    if (m.category === 'fieldGroup') {
      return {
        type: 'Region',
        config: {
          layout: m.canonicalType,
          label: m.label ?? r.name,
          columns: (m.config as Record<string, unknown> | undefined)?.columns ?? 1,
        },
      };
    }
    // layout container
    return {
      type: 'Region',
      config: {
        layout: m.canonicalType,
        label: m.label ?? r.name,
      },
    };
  });

  return {
    name: viewName,
    type: 'Harness',
    config: { label: viewName },
    children,
    metadata: {
      generatedBy: 'Highlight & Map Regions',
      generatedAt: new Date().toISOString(),
      regionCount: regions.length,
    },
  };
}
