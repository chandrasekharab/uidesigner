/**
 * mockFigmaSamples.ts
 * ────────────────────
 * Sample Figma export JSON files for development and demo purposes.
 * These follow the shape of a real Figma REST API file response so that
 * parseFigmaExport() can process them without any API dependency.
 *
 * Provided samples:
 *   1. SAMPLE_FIGMA_CASE_DETAIL  — A typical "Case Detail" form page layout
 *   2. SAMPLE_FIGMA_DASHBOARD    — A dashboard layout with grid sections
 *   3. SAMPLE_FIGMA_MOBILE_FORM  — A mobile-first vertical form layout
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function frame(
  id: string,
  name: string,
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE' = 'VERTICAL',
  children: Record<string, unknown>[] = [],
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    name,
    type: 'FRAME',
    layoutMode,
    visible: true,
    opacity: 1,
    itemSpacing: 12,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    absoluteBoundingBox: extra.absoluteBoundingBox ?? { x: 0, y: 0, width: 360, height: 200 },
    children,
    ...extra,
  };
}

function group(
  id: string,
  name: string,
  children: Record<string, unknown>[] = []
): Record<string, unknown> {
  return {
    id,
    name,
    type: 'GROUP',
    visible: true,
    opacity: 1,
    absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 120 },
    children,
  };
}

function component(
  id: string,
  name: string,
  componentId?: string
): Record<string, unknown> {
  return {
    id,
    name,
    type: componentId ? 'INSTANCE' : 'COMPONENT',
    componentId: componentId ?? id + '-component',
    visible: true,
    opacity: 1,
    absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 40 },
    children: [],
  };
}

function text(id: string, name: string): Record<string, unknown> {
  return {
    id,
    name,
    type: 'TEXT',
    visible: true,
    opacity: 1,
    absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 20 },
    children: [],
  };
}

function rect(id: string, name: string): Record<string, unknown> {
  return {
    id,
    name,
    type: 'RECTANGLE',
    visible: true,
    opacity: 1,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 4 },
    children: [],
  };
}

// ─── Sample 1: Case Detail Form ───────────────────────────────────────────────

/**
 * Represents a typical Pega "Case Detail" view layout in Figma.
 * Structure:
 *   Page → CaseDetail
 *     ├── Header (horizontal) — Case ID + actions
 *     ├── FormContent (vertical)
 *     │   ├── PersonalInfo (horizontal grid — 2 col)
 *     │   ├── AddressSection (vertical)
 *     │   └── Attachments (vertical)
 *     ├── ActivityFeed (vertical)
 *     └── FooterActions (horizontal)
 */
export const SAMPLE_FIGMA_CASE_DETAIL = {
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Case Detail Page',
        type: 'CANVAS',
        children: [
          frame('2:1', 'CaseDetail', 'VERTICAL', [
            // Header
            frame('3:1', 'Header', 'HORIZONTAL', [
              component('3:2', 'CaseIdBadge', 'comp-badge'),
              component('3:3', 'StatusTag', 'comp-tag'),
              text('3:4', 'Case Title'),
              frame('3:5', 'HeaderActions', 'HORIZONTAL', [
                component('3:6', 'ActionButton:Submit', 'comp-button'),
                component('3:7', 'ActionButton:Save', 'comp-button'),
              ], { absoluteBoundingBox: { x: 280, y: 0, width: 160, height: 40 } }),
            ], { absoluteBoundingBox: { x: 0, y: 0, width: 1024, height: 56 } }),

            // Main content column
            frame('4:1', 'FormContent', 'VERTICAL', [
              // Personal Info — 2-column grid
              frame('5:1', 'PersonalInfo', 'HORIZONTAL', [
                frame('5:2', 'PersonalInfoLeft', 'VERTICAL', [
                  component('5:3', 'TextField:FirstName', 'comp-textfield'),
                  component('5:4', 'TextField:LastName', 'comp-textfield'),
                  component('5:5', 'DatePicker:DateOfBirth', 'comp-datepicker'),
                ], { absoluteBoundingBox: { x: 0, y: 0, width: 460, height: 180 } }),
                frame('5:6', 'PersonalInfoRight', 'VERTICAL', [
                  component('5:7', 'TextField:Email', 'comp-textfield'),
                  component('5:8', 'TextField:Phone', 'comp-textfield'),
                  component('5:9', 'Dropdown:Country', 'comp-dropdown'),
                ], { absoluteBoundingBox: { x: 480, y: 0, width: 460, height: 180 } }),
              ], { absoluteBoundingBox: { x: 0, y: 60, width: 960, height: 200 } }),

              // Address section
              frame('6:1', 'AddressSection', 'VERTICAL', [
                text('6:2', 'Section Title: Address'),
                component('6:3', 'TextField:Street', 'comp-textfield'),
                frame('6:4', 'AddressRow', 'HORIZONTAL', [
                  component('6:5', 'TextField:City', 'comp-textfield'),
                  component('6:6', 'TextField:State', 'comp-textfield'),
                  component('6:7', 'TextField:Zip', 'comp-textfield'),
                ], { absoluteBoundingBox: { x: 0, y: 0, width: 920, height: 48 } }),
              ], { absoluteBoundingBox: { x: 0, y: 280, width: 960, height: 160 } }),

              // Attachments
              frame('7:1', 'Attachments', 'VERTICAL', [
                text('7:2', 'Section Title: Documents'),
                component('7:3', 'FileUpload', 'comp-file-upload'),
                component('7:4', 'AttachmentList', 'comp-list'),
              ], { absoluteBoundingBox: { x: 0, y: 460, width: 960, height: 140 } }),
            ], { absoluteBoundingBox: { x: 0, y: 60, width: 1024, height: 600 } }),

            // Activity feed
            frame('8:1', 'ActivityFeed', 'VERTICAL', [
              text('8:2', 'Activity'),
              component('8:3', 'FeedItem:1', 'comp-feed-item'),
              component('8:4', 'FeedItem:2', 'comp-feed-item'),
              component('8:5', 'FeedItem:3', 'comp-feed-item'),
            ], { absoluteBoundingBox: { x: 0, y: 680, width: 1024, height: 200 } }),

            // Footer actions
            frame('9:1', 'FooterActions', 'HORIZONTAL', [
              component('9:2', 'Button:Cancel', 'comp-button'),
              rect('9:3', 'Spacer'),
              component('9:4', 'Button:Submit', 'comp-button'),
              component('9:5', 'Button:SaveDraft', 'comp-button'),
            ], { absoluteBoundingBox: { x: 0, y: 900, width: 1024, height: 56 } }),
          ], { absoluteBoundingBox: { x: 0, y: 0, width: 1024, height: 960 } }),
        ],
      },
    ],
  },
};

// ─── Sample 2: Dashboard Layout ───────────────────────────────────────────────

/**
 * A data-heavy dashboard with KPI cards, charts and a data grid.
 * Structure:
 *   Dashboard
 *     ├── TopBar (horizontal)
 *     ├── KPIRow (horizontal — 4 cards)
 *     ├── ContentRow (horizontal)
 *     │   ├── ChartPanel (vertical)
 *     │   └── SummaryPanel (vertical)
 *     └── DataGrid (vertical)
 */
export const SAMPLE_FIGMA_DASHBOARD = {
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Dashboard',
        type: 'CANVAS',
        children: [
          frame('d2:1', 'Dashboard', 'VERTICAL', [
            frame('d3:1', 'TopBar', 'HORIZONTAL', [
              text('d3:2', 'Dashboard Title'),
              component('d3:3', 'UserAvatar', 'comp-avatar'),
              component('d3:4', 'NotificationBell', 'comp-bell'),
            ], { absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 56 } }),

            frame('d4:1', 'KPIRow', 'HORIZONTAL', [
              frame('d4:2', 'KPICard:OpenCases', 'VERTICAL', [
                text('d4:3', 'Open Cases'), text('d4:4', '142'),
              ], { absoluteBoundingBox: { x: 0,   y: 0, width: 320, height: 100 } }),
              frame('d4:5', 'KPICard:Resolved', 'VERTICAL', [
                text('d4:6', 'Resolved'), text('d4:7', '87'),
              ], { absoluteBoundingBox: { x: 340, y: 0, width: 320, height: 100 } }),
              frame('d4:8', 'KPICard:Pending', 'VERTICAL', [
                text('d4:9', 'Pending'), text('d4:10', '23'),
              ], { absoluteBoundingBox: { x: 680, y: 0, width: 320, height: 100 } }),
              frame('d4:11', 'KPICard:Escalated', 'VERTICAL', [
                text('d4:12', 'Escalated'), text('d4:13', '5'),
              ], { absoluteBoundingBox: { x: 1020, y: 0, width: 320, height: 100 } }),
            ], { absoluteBoundingBox: { x: 0, y: 60, width: 1440, height: 120 } }),

            frame('d5:1', 'ContentRow', 'HORIZONTAL', [
              frame('d5:2', 'ChartPanel', 'VERTICAL', [
                text('d5:3', 'Cases Over Time'),
                component('d5:4', 'LineChart', 'comp-chart'),
              ], { absoluteBoundingBox: { x: 0, y: 0, width: 900, height: 320 } }),
              frame('d5:5', 'SummaryPanel', 'VERTICAL', [
                text('d5:6', 'Summary'),
                component('d5:7', 'SummaryList', 'comp-list'),
              ], { absoluteBoundingBox: { x: 920, y: 0, width: 480, height: 320 } }),
            ], { absoluteBoundingBox: { x: 0, y: 200, width: 1440, height: 360 } }),

            frame('d6:1', 'DataGrid', 'VERTICAL', [
              text('d6:2', 'Case List'),
              component('d6:3', 'TableHeader', 'comp-table-header'),
              component('d6:4', 'TableRow:1', 'comp-table-row'),
              component('d6:5', 'TableRow:2', 'comp-table-row'),
              component('d6:6', 'TableRow:3', 'comp-table-row'),
              component('d6:7', 'Pagination', 'comp-pagination'),
            ], { absoluteBoundingBox: { x: 0, y: 580, width: 1440, height: 300 } }),
          ], { absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 } }),
        ],
      },
    ],
  },
};

// ─── Sample 3: Mobile Form Layout ─────────────────────────────────────────────

/**
 * A mobile-first form for case creation.
 * Single-column vertical stack with sections and a sticky footer.
 */
export const SAMPLE_FIGMA_MOBILE_FORM = {
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Mobile Form',
        type: 'CANVAS',
        children: [
          frame('m2:1', 'MobileForm', 'VERTICAL', [
            frame('m3:1', 'MobileHeader', 'HORIZONTAL', [
              component('m3:2', 'BackButton', 'comp-icon-button'),
              text('m3:3', 'Create Case'),
              component('m3:4', 'CloseButton', 'comp-icon-button'),
            ], { absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 52 } }),

            frame('m4:1', 'StepIndicator', 'HORIZONTAL', [
              component('m4:2', 'Step:1:Active', 'comp-step'),
              component('m4:3', 'Step:2', 'comp-step'),
              component('m4:4', 'Step:3', 'comp-step'),
            ], { absoluteBoundingBox: { x: 0, y: 56, width: 390, height: 40 } }),

            // Tab sections for multi-step
            frame('m5:1', 'FormSections', 'VERTICAL', [
              frame('m5:2', 'BasicInfo', 'VERTICAL', [
                component('m5:3', 'TextField:CaseName', 'comp-textfield'),
                component('m5:4', 'Dropdown:CaseType', 'comp-dropdown'),
                component('m5:5', 'TextField:Description', 'comp-textarea'),
              ], { absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 200 } }),

              frame('m5:6', 'ContactInfo', 'VERTICAL', [
                component('m5:7', 'TextField:FullName', 'comp-textfield'),
                component('m5:8', 'TextField:Email', 'comp-textfield'),
                component('m5:9', 'TextField:PhoneNumber', 'comp-textfield'),
              ], { absoluteBoundingBox: { x: 0, y: 220, width: 390, height: 180 } }),

              frame('m5:10', 'AdditionalDetails', 'VERTICAL', [
                component('m5:11', 'Dropdown:Priority', 'comp-dropdown'),
                component('m5:12', 'DatePicker:DueDate', 'comp-datepicker'),
                component('m5:13', 'Checkbox:Urgent', 'comp-checkbox'),
              ], { absoluteBoundingBox: { x: 0, y: 420, width: 390, height: 160 } }),
            ], { absoluteBoundingBox: { x: 0, y: 100, width: 390, height: 600 } }),

            frame('m6:1', 'MobileFooter', 'HORIZONTAL', [
              component('m6:2', 'Button:Back', 'comp-button'),
              component('m6:3', 'Button:Next', 'comp-button'),
            ], { absoluteBoundingBox: { x: 0, y: 760, width: 390, height: 56 } }),
          ], { absoluteBoundingBox: { x: 0, y: 0, width: 390, height: 844 } }),
        ],
      },
    ],
  },
};

// ─── Sample registry ──────────────────────────────────────────────────────────

export interface FigmaSampleEntry {
  id: string;
  name: string;
  description: string;
  data: typeof SAMPLE_FIGMA_CASE_DETAIL;
}

export const FIGMA_SAMPLES: FigmaSampleEntry[] = [
  {
    id: 'case-detail',
    name: 'Case Detail Form',
    description: 'Pega-style case detail view — header, form sections, activity feed, footer actions',
    data: SAMPLE_FIGMA_CASE_DETAIL,
  },
  {
    id: 'dashboard',
    name: 'Dashboard Layout',
    description: 'Data dashboard with KPI cards, charts and a case list grid',
    data: SAMPLE_FIGMA_DASHBOARD,
  },
  {
    id: 'mobile-form',
    name: 'Mobile Form',
    description: 'Mobile-first multi-step case creation form',
    data: SAMPLE_FIGMA_MOBILE_FORM,
  },
];

export default FIGMA_SAMPLES;
