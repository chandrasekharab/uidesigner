/**
 * Pega Constellation Template Registry
 *
 * Defines predefined source templates for the Template Mapping Studio.
 * Each template matches a common Pega Constellation view pattern and
 * exposes named regions that users can map to their target layout.
 */

import type { RegionDetectedType } from '@/types/region';
import type { CanonicalType } from '@/types/canonical';

// ─── Template Region ──────────────────────────────────────────────────────────

export interface PegaTemplateRegion {
  /** Stable identifier used in mapping rules */
  id: string;
  /** Human-readable name shown in the UI */
  name: string;
  /** Detected visual type (aligns with Region type system) */
  type: RegionDetectedType;
  /** Primary canonical type rendered by this region */
  defaultWidget: CanonicalType;
  /** One-line description shown as a tooltip */
  description: string;
  /** Optional: matching Pega region layout tag */
  pegaLayout?: string;
  /** Color used to visually distinguish this region in the studio */
  color: string;
  /** Mock children JSON for preview / transformation seeding */
  sampleJson?: unknown;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export interface PegaTemplate {
  id: string;
  name: string;
  description: string;
  category: 'case-view' | 'form-view' | 'dashboard' | 'list-view';
  /** Icon name (lucide-react) for the template picker */
  icon: string;
  /** Accent color class for the card UI */
  accentColor: string;
  regions: PegaTemplateRegion[];
  /** Representative Pega Constellation JSON snippet for this template */
  sampleJson: unknown;
}

// ─── Case View Template ───────────────────────────────────────────────────────

const CASE_VIEW_TEMPLATE: PegaTemplate = {
  id: 'pega-case-view',
  name: 'Case View',
  description: 'Standard Pega case details view with header summary, form fields, attachments, social feed, and process steps.',
  category: 'case-view',
  icon: 'FileText',
  accentColor: 'indigo',
  regions: [
    {
      id: 'cv-header',
      name: 'Header',
      type: 'Header',
      defaultWidget: 'Container',
      description: 'Case title, status badge, and quick action buttons.',
      pegaLayout: 'stacked',
      color: '#6366f1',
      sampleJson: {
        type: 'Region',
        name: 'Header',
        layout: 'stacked',
        fields: [
          { type: 'pxCaseSummary', config: { label: 'Case Summary' } },
          { type: 'Button', config: { label: 'Edit', actionType: 'localAction' } },
        ],
      },
    },
    {
      id: 'cv-form-section',
      name: 'Form Section',
      type: 'FormSection',
      defaultWidget: 'TwoColumn',
      description: 'Primary data entry area — case fields arranged in a two-column layout.',
      pegaLayout: 'twoColumn',
      color: '#0ea5e9',
      sampleJson: {
        type: 'Region',
        name: 'FormSection',
        layout: 'twoColumn',
        fields: [
          { type: 'TextInput', config: { label: 'First Name', property: '.FirstName' } },
          { type: 'TextInput', config: { label: 'Last Name', property: '.LastName' } },
          { type: 'Dropdown', config: { label: 'Status', property: '.Status', dataSource: '@ASSOCIATED .StatusOptions' } },
          { type: 'DateTime', config: { label: 'Date of Birth', property: '.DateOfBirth' } },
        ],
      },
    },
    {
      id: 'cv-attachments',
      name: 'Attachments',
      type: 'Attachments',
      defaultWidget: 'AttachmentsWidget',
      description: 'Document / file attachment widget (pxAttachContent).',
      pegaLayout: 'stacked',
      color: '#f59e0b',
      sampleJson: {
        type: 'pxAttachContent',
        config: { label: 'Attachments', maxItems: 10 },
      },
    },
    {
      id: 'cv-pulse',
      name: 'Pulse',
      type: 'ActivityFeed',
      defaultWidget: 'PulseWidget',
      description: 'Social collaboration feed (pxPulse) for case notes and messages.',
      pegaLayout: 'stacked',
      color: '#10b981',
      sampleJson: {
        type: 'pxPulse',
        config: { label: 'Pulse', property: '.pyWorkPage' },
      },
    },
    {
      id: 'cv-steps',
      name: 'Process Steps',
      type: 'Steps',
      defaultWidget: 'StepsWidget',
      description: 'Horizontal process step tracker (pxProcessSteps).',
      pegaLayout: 'stacked',
      color: '#8b5cf6',
      sampleJson: {
        type: 'pxProcessSteps',
        config: { label: 'Case Stages', property: '.pyStageList' },
      },
    },
  ],
  sampleJson: {
    view: {
      type: 'case',
      name: 'CaseView',
      regions: [
        { name: 'Header', layout: 'stacked' },
        { name: 'FormSection', layout: 'twoColumn' },
        { name: 'Attachments', layout: 'stacked' },
        { name: 'Pulse', layout: 'stacked' },
        { name: 'Steps', layout: 'stacked' },
      ],
    },
  },
};

// ─── Form View Template ───────────────────────────────────────────────────────

const FORM_VIEW_TEMPLATE: PegaTemplate = {
  id: 'pega-form-view',
  name: 'Form View',
  description: 'Data entry form with sections, validation, and submit/cancel actions.',
  category: 'form-view',
  icon: 'ClipboardList',
  accentColor: 'emerald',
  regions: [
    {
      id: 'fv-title',
      name: 'Form Title',
      type: 'Header',
      defaultWidget: 'Label',
      description: 'Title and optional subtitle text at the top of the form.',
      pegaLayout: 'stacked',
      color: '#6366f1',
      sampleJson: {
        type: 'Text',
        config: { label: 'New Case', content: 'Fill in the details below to create a new case.' },
      },
    },
    {
      id: 'fv-personal',
      name: 'Personal Info',
      type: 'FormSection',
      defaultWidget: 'TwoColumn',
      description: 'Personal / identity fields in a two-column grid.',
      pegaLayout: 'twoColumn',
      color: '#0ea5e9',
      sampleJson: {
        type: 'Region',
        name: 'PersonalInfo',
        layout: 'twoColumn',
        fields: [
          { type: 'TextInput', config: { label: 'First Name', property: '.FirstName', required: true } },
          { type: 'TextInput', config: { label: 'Last Name', property: '.LastName', required: true } },
          { type: 'TextInput', config: { label: 'Email', property: '.Email' } },
          { type: 'TextInput', config: { label: 'Phone', property: '.Phone' } },
        ],
      },
    },
    {
      id: 'fv-case-details',
      name: 'Case Details',
      type: 'FormSection',
      defaultWidget: 'SingleColumn',
      description: 'Case-specific fields — description, category, priority.',
      pegaLayout: 'stacked',
      color: '#f59e0b',
      sampleJson: {
        type: 'Region',
        name: 'CaseDetails',
        layout: 'stacked',
        fields: [
          { type: 'TextArea', config: { label: 'Description', property: '.Description' } },
          { type: 'Dropdown', config: { label: 'Category', property: '.Category', dataSource: '@ASSOCIATED .CategoryOptions' } },
          { type: 'Dropdown', config: { label: 'Priority', property: '.Priority', dataSource: '@ASSOCIATED .PriorityOptions' } },
        ],
      },
    },
    {
      id: 'fv-actions',
      name: 'Form Actions',
      type: 'Footer',
      defaultWidget: 'Container',
      description: 'Submit, Cancel, and Save draft action buttons.',
      pegaLayout: 'inline',
      color: '#10b981',
      sampleJson: {
        type: 'Region',
        name: 'Actions',
        layout: 'inline',
        fields: [
          { type: 'Button', config: { label: 'Submit', actionType: 'Submit', variant: 'primary' } },
          { type: 'Button', config: { label: 'Cancel', actionType: 'localAction', variant: 'secondary' } },
        ],
      },
    },
  ],
  sampleJson: {
    view: {
      type: 'form',
      name: 'CreateCaseView',
      regions: [
        { name: 'FormTitle', layout: 'stacked' },
        { name: 'PersonalInfo', layout: 'twoColumn' },
        { name: 'CaseDetails', layout: 'stacked' },
        { name: 'Actions', layout: 'inline' },
      ],
      actions: [
        { type: 'button', label: 'Submit', actionType: 'Submit', variant: 'primary' },
        { type: 'button', label: 'Cancel', actionType: 'localAction', variant: 'secondary' },
      ],
    },
  },
};

// ─── Dashboard View Template ──────────────────────────────────────────────────

const DASHBOARD_VIEW_TEMPLATE: PegaTemplate = {
  id: 'pega-dashboard-view',
  name: 'Dashboard View',
  description: 'Multi-region dashboard with navigation, KPI cards, work list, and filters.',
  category: 'dashboard',
  icon: 'LayoutDashboard',
  accentColor: 'violet',
  regions: [
    {
      id: 'dv-navigation',
      name: 'Navigation',
      type: 'Navigation',
      defaultWidget: 'Container',
      description: 'Top navigation bar with app title and user links.',
      pegaLayout: 'inline',
      color: '#6366f1',
      sampleJson: {
        type: 'Region',
        name: 'Navigation',
        layout: 'inline',
        fields: [
          { type: 'Text', config: { label: 'My Application', content: 'My Application' } },
        ],
      },
    },
    {
      id: 'dv-kpi-strip',
      name: 'KPI Strip',
      type: 'Card',
      defaultWidget: 'FourColumn',
      description: 'Four KPI summary cards (count, status, trends).',
      pegaLayout: 'fourColumn',
      color: '#0ea5e9',
      sampleJson: {
        type: 'Region',
        name: 'KPIStrip',
        layout: 'fourColumn',
        fields: [
          { type: 'pxCaseSummary', config: { label: 'Open Cases', property: '.OpenCases' } },
          { type: 'pxCaseSummary', config: { label: 'Resolved', property: '.ResolvedCases' } },
          { type: 'pxCaseSummary', config: { label: 'Pending', property: '.PendingCases' } },
          { type: 'pxCaseSummary', config: { label: 'Escalated', property: '.EscalatedCases' } },
        ],
      },
    },
    {
      id: 'dv-work-list',
      name: 'Work List',
      type: 'DataGrid',
      defaultWidget: 'DataGrid',
      description: 'Main data grid listing open work items.',
      pegaLayout: 'stacked',
      color: '#f59e0b',
      sampleJson: {
        type: 'DataGrid',
        config: {
          label: 'My Work',
          dataPage: 'D_WorkList',
          columns: [
            { label: 'Case ID', property: '.pyID' },
            { label: 'Status', property: '.pyStatusWork' },
            { label: 'Urgency', property: '.pxUrgencyWork' },
          ],
        },
      },
    },
    {
      id: 'dv-filters',
      name: 'Filters',
      type: 'FormSection',
      defaultWidget: 'ThreeColumn',
      description: 'Search and filter bar for the work list.',
      pegaLayout: 'threeColumn',
      color: '#10b981',
      sampleJson: {
        type: 'Region',
        name: 'Filters',
        layout: 'threeColumn',
        fields: [
          { type: 'TextInput', config: { label: 'Search', property: '.SearchText' } },
          { type: 'Dropdown', config: { label: 'Status', property: '.FilterStatus', dataSource: '@ASSOCIATED .StatusOptions' } },
          { type: 'DateTime', config: { label: 'Date From', property: '.DateFrom' } },
        ],
      },
    },
    {
      id: 'dv-sidebar',
      name: 'Sidebar',
      type: 'CaseSummary',
      defaultWidget: 'CaseSummary',
      description: 'Contextual sidebar with quick case summary and recent activity.',
      pegaLayout: 'stacked',
      color: '#8b5cf6',
      sampleJson: {
        type: 'pxCaseSummary',
        config: { label: 'Quick Summary', property: '.pyWorkPage' },
      },
    },
  ],
  sampleJson: {
    view: {
      type: 'dashboard',
      name: 'DashboardView',
      regions: [
        { name: 'Navigation', layout: 'inline' },
        { name: 'KPIStrip', layout: 'fourColumn' },
        { name: 'WorkList', layout: 'stacked' },
        { name: 'Filters', layout: 'threeColumn' },
        { name: 'Sidebar', layout: 'stacked' },
      ],
    },
  },
};

// ─── List View Template ───────────────────────────────────────────────────────

const LIST_VIEW_TEMPLATE: PegaTemplate = {
  id: 'pega-list-view',
  name: 'List View',
  description: 'Searchable list with header actions, data grid, and pagination.',
  category: 'list-view',
  icon: 'List',
  accentColor: 'amber',
  regions: [
    {
      id: 'lv-header',
      name: 'List Header',
      type: 'Header',
      defaultWidget: 'Container',
      description: 'Page title, create button, and bulk action controls.',
      pegaLayout: 'inline',
      color: '#6366f1',
      sampleJson: {
        type: 'Region',
        name: 'ListHeader',
        layout: 'inline',
        fields: [
          { type: 'Text', config: { label: 'Cases', content: 'All Cases' } },
          { type: 'Button', config: { label: 'New Case', actionType: 'createCase', variant: 'primary' } },
        ],
      },
    },
    {
      id: 'lv-search',
      name: 'Search Bar',
      type: 'FormSection',
      defaultWidget: 'SingleColumn',
      description: 'Global search input with optional quick filters.',
      pegaLayout: 'inline',
      color: '#0ea5e9',
      sampleJson: {
        type: 'Region',
        name: 'SearchBar',
        layout: 'inline',
        fields: [
          { type: 'TextInput', config: { label: 'Search cases...', property: '.SearchText' } },
        ],
      },
    },
    {
      id: 'lv-grid',
      name: 'Data Grid',
      type: 'DataGrid',
      defaultWidget: 'DataGrid',
      description: 'Primary data list with sortable columns and row actions.',
      pegaLayout: 'stacked',
      color: '#f59e0b',
      sampleJson: {
        type: 'DataGrid',
        config: {
          label: 'Cases',
          dataPage: 'D_CaseList',
          columns: [
            { label: 'ID', property: '.pyID' },
            { label: 'Description', property: '.pyLabel' },
            { label: 'Status', property: '.pyStatusWork' },
            { label: 'Created', property: '.pxCreateDateTime' },
          ],
        },
      },
    },
    {
      id: 'lv-pagination',
      name: 'Pagination',
      type: 'Footer',
      defaultWidget: 'Container',
      description: 'Page navigation controls (prev / next / page size).',
      pegaLayout: 'inline',
      color: '#10b981',
      sampleJson: {
        type: 'Region',
        name: 'Pagination',
        layout: 'inline',
        fields: [
          { type: 'Button', config: { label: 'Previous', actionType: 'localAction', variant: 'secondary' } },
          { type: 'Text', config: { label: 'Page', content: 'Page 1 of N' } },
          { type: 'Button', config: { label: 'Next', actionType: 'localAction', variant: 'primary' } },
        ],
      },
    },
  ],
  sampleJson: {
    view: {
      type: 'list',
      name: 'CaseListView',
      regions: [
        { name: 'ListHeader', layout: 'inline' },
        { name: 'SearchBar', layout: 'inline' },
        { name: 'DataGrid', layout: 'stacked' },
        { name: 'Pagination', layout: 'inline' },
      ],
    },
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const PEGA_TEMPLATES: PegaTemplate[] = [
  CASE_VIEW_TEMPLATE,
  FORM_VIEW_TEMPLATE,
  DASHBOARD_VIEW_TEMPLATE,
  LIST_VIEW_TEMPLATE,
];

/** Fast O(1) lookup by template ID */
export const PEGA_TEMPLATE_MAP = new Map<string, PegaTemplate>(
  PEGA_TEMPLATES.map((t) => [t.id, t])
);

/** Get a template by id (returns undefined if not found) */
export function getPegaTemplate(id: string): PegaTemplate | undefined {
  return PEGA_TEMPLATE_MAP.get(id);
}

/** Accent-color Tailwind class lookup */
export const TEMPLATE_ACCENT_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/20',
    border: 'border-indigo-300 dark:border-indigo-700',
    text: 'text-indigo-700 dark:text-indigo-300',
    badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/20',
    border: 'border-violet-300 dark:border-violet-700',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
};
