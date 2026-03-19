/**
 * Sample Pega Constellation Schema Templates
 *
 * These are used as built-in options in the Schema-Aware Generator so the
 * feature works fully offline/mock without requiring the user to upload a file.
 *
 * Each template is a realistic Pega Constellation View definition with:
 *  - named fields, property references, validation rules
 *  - layout patterns, action definitions
 */

export interface SampleSchema {
  id: string;
  label: string;
  description: string;
  category: 'form' | 'dashboard' | 'list' | 'modal';
  json: unknown;
}

// ─── Schema Templates ─────────────────────────────────────────────────────────

const LOGIN_FORM_SCHEMA: SampleSchema = {
  id: 'pega-login-view',
  label: 'Login Form View',
  category: 'form',
  description: 'Pega Constellation standard login view with email + password authentication fields',
  json: {
    version: '8.8',
    description: 'Pega Constellation Login View',
    view: {
      type: 'form',
      name: 'LoginView',
      classReference: 'User-',
      layout: 'stacked',
      regions: [
        {
          name: 'header',
          layout: 'stacked',
          fields: [
            { type: 'heading', label: 'Sign In', variant: 'h2', property: '.Title' },
          ],
        },
        {
          name: 'body',
          layout: 'stacked',
          fields: [
            {
              type: 'email',
              label: 'Email Address',
              property: '.EmailAddress',
              required: true,
              placeholder: 'Enter your work email',
              validations: ['pattern: ^[^@]+@[^@]+\\.[^@]+$', 'maxLength: 255'],
            },
            {
              type: 'password',
              label: 'Password',
              property: '.Password',
              required: true,
              placeholder: 'Enter password',
              validations: ['minLength: 8'],
            },
            {
              type: 'checkbox',
              label: 'Remember Me',
              property: '.RememberMe',
            },
          ],
        },
      ],
      actions: [
        { type: 'button', label: 'Sign In', actionType: 'Submit', variant: 'primary' },
        { type: 'link', label: 'Forgot password?', property: '.ForgotPasswordLink' },
      ],
    },
  },
};

const CONTACT_FORM_SCHEMA: SampleSchema = {
  id: 'pega-contact-form',
  label: 'Contact / Request Form',
  category: 'form',
  description: 'General-purpose contact form with personal details, phone, and message fields',
  json: {
    version: '8.8',
    description: 'Pega Constellation Contact Form',
    view: {
      type: 'form',
      name: 'ContactFormView',
      classReference: 'Work-ServiceRequest',
      layout: 'stacked',
      regions: [
        {
          name: 'personalDetails',
          layout: 'column-2',
          fields: [
            {
              type: 'text',
              label: 'First Name',
              property: '.FirstName',
              required: true,
              validations: ['maxLength: 100'],
            },
            {
              type: 'text',
              label: 'Last Name',
              property: '.LastName',
              required: true,
              validations: ['maxLength: 100'],
            },
            {
              type: 'email',
              label: 'Email Address',
              property: '.EmailAddress',
              required: true,
              validations: ['pattern: ^[^@]+@[^@]+\\.[^@]+$'],
            },
            {
              type: 'tel',
              label: 'Phone Number',
              property: '.PhoneNumber',
              placeholder: '+1 (555) 000-0000',
              validations: ['pattern: ^\\+?[\\d\\s\\-()]{7,20}$'],
            },
          ],
        },
        {
          name: 'requestDetails',
          layout: 'stacked',
          fields: [
            {
              type: 'dropdown',
              label: 'Subject',
              property: '.Subject',
              required: true,
              dataSource: 'D_SubjectList',
              options: [
                { key: 'general', value: 'General Enquiry' },
                { key: 'support', value: 'Technical Support' },
                { key: 'billing', value: 'Billing' },
                { key: 'feedback', value: 'Feedback' },
              ],
            },
            {
              type: 'textarea',
              label: 'Message',
              property: '.Message',
              required: true,
              placeholder: 'Describe your request…',
              validations: ['minLength: 10', 'maxLength: 2000'],
            },
          ],
        },
      ],
      actions: [
        { type: 'button', label: 'Submit Request', actionType: 'Submit', variant: 'primary' },
        { type: 'button', label: 'Cancel', actionType: 'Cancel', variant: 'secondary' },
      ],
    },
  },
};

const REGISTRATION_SCHEMA: SampleSchema = {
  id: 'pega-registration-view',
  label: 'Account Registration View',
  category: 'form',
  description: 'New user registration with personal info, credentials, and role selection',
  json: {
    version: '8.8',
    description: 'Pega Constellation Registration View',
    view: {
      type: 'form',
      name: 'RegistrationView',
      classReference: 'User-Registration',
      layout: 'stacked',
      regions: [
        {
          name: 'credentials',
          layout: 'stacked',
          fields: [
            { type: 'text', label: 'Full Name', property: '.FullName', required: true, validations: ['maxLength: 200'] },
            { type: 'email', label: 'Email Address', property: '.EmailAddress', required: true },
            { type: 'password', label: 'Password', property: '.Password', required: true, validations: ['minLength: 8', 'pattern: (?=.*[A-Z])(?=.*[0-9])'] },
            { type: 'password', label: 'Confirm Password', property: '.ConfirmPassword', required: true },
          ],
        },
        {
          name: 'profile',
          layout: 'column-2',
          fields: [
            {
              type: 'dropdown',
              label: 'Role',
              property: '.UserRole',
              required: true,
              dataSource: 'D_RoleList',
              options: [
                { key: 'admin', value: 'Administrator' },
                { key: 'user', value: 'Standard User' },
                { key: 'viewer', value: 'Read Only' },
              ],
            },
            { type: 'tel', label: 'Mobile Number', property: '.MobileNumber' },
            { type: 'date', label: 'Date of Birth', property: '.DateOfBirth' },
          ],
        },
        {
          name: 'consent',
          layout: 'stacked',
          fields: [
            { type: 'checkbox', label: 'I agree to the Terms and Conditions', property: '.TermsAccepted', required: true },
            { type: 'checkbox', label: 'Subscribe to newsletter', property: '.NewsletterOptIn' },
          ],
        },
      ],
      actions: [
        { type: 'button', label: 'Create Account', actionType: 'Submit', variant: 'primary' },
        { type: 'button', label: 'Back to Login', actionType: 'Navigate', variant: 'secondary' },
      ],
    },
  },
};

const DASHBOARD_SCHEMA: SampleSchema = {
  id: 'pega-dashboard-view',
  label: 'Operations Dashboard View',
  category: 'dashboard',
  description: 'Case management dashboard with KPI cards, status filters, and case list',
  json: {
    version: '8.8',
    description: 'Pega Constellation Operations Dashboard',
    view: {
      type: 'dashboard',
      name: 'OperationsDashboard',
      classReference: 'Work-',
      layout: 'stacked',
      regions: [
        {
          name: 'kpiRow',
          layout: 'column-4',
          fields: [
            { type: 'metric', label: 'Open Cases', property: '.OpenCasesCount', value: '0', trend: 'up' },
            { type: 'metric', label: 'Resolved Today', property: '.ResolvedToday', value: '0', trend: 'neutral' },
            { type: 'metric', label: 'SLA Breaches', property: '.SLABreachCount', value: '0', trend: 'down' },
            { type: 'metric', label: 'Avg Resolution (hrs)', property: '.AvgResolutionHrs', value: '0', trend: 'neutral' },
          ],
        },
        {
          name: 'filters',
          layout: 'column-3',
          fields: [
            { type: 'text', label: 'Search Cases', property: '.SearchText', placeholder: 'Case ID or description…' },
            {
              type: 'dropdown',
              label: 'Status Filter',
              property: '.StatusFilter',
              dataSource: 'D_CaseStatusList',
              options: [
                { key: 'all', value: 'All Statuses' },
                { key: 'open', value: 'Open' },
                { key: 'pending', value: 'Pending' },
                { key: 'resolved', value: 'Resolved' },
              ],
            },
            { type: 'date', label: 'From Date', property: '.FilterFromDate' },
          ],
        },
        {
          name: 'caseList',
          layout: 'stacked',
          fields: [
            { type: 'table', label: 'Cases', property: '.CasesPage', dataSource: 'D_CaseList' },
          ],
        },
      ],
      actions: [
        { type: 'button', label: 'New Case', actionType: 'Submit', variant: 'primary' },
        { type: 'button', label: 'Export', actionType: 'Custom', variant: 'secondary' },
        { type: 'button', label: 'Refresh', actionType: 'Custom', variant: 'secondary' },
      ],
    },
  },
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const SAMPLE_SCHEMAS: SampleSchema[] = [
  LOGIN_FORM_SCHEMA,
  CONTACT_FORM_SCHEMA,
  REGISTRATION_SCHEMA,
  DASHBOARD_SCHEMA,
];

export type SampleSchemaId = 'pega-login-view' | 'pega-contact-form' | 'pega-registration-view' | 'pega-dashboard-view';
