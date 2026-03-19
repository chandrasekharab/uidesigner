// ─── Mock Design Detection Scenarios ─────────────────────────────────────────
// Static mock data returned by designParser.ts when no real AI key is present.
// Each scenario mimics the output of a real computer-vision pipeline.

import type {
  DetectedComponent,
  DetectedComponentType,
} from '@/services/designParser';

// ─── Helper ───────────────────────────────────────────────────────────────────

function comp(
  type: DetectedComponentType,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<DetectedComponent> = {}
): DetectedComponent {
  return {
    id: `mock-${type}-${label.replace(/\s+/g, '-').toLowerCase()}`,
    type,
    label,
    confidence: 0.88 + Math.random() * 0.1,
    boundingBox: { x, y, width: w, height: h },
    children: [],
    attributes: {},
    ...extra,
  };
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export const MOCK_DETECTION_SCENARIOS = {
  // ── Login Screen ────────────────────────────────────────────────────────────
  login: {
    screenType: 'form' as const,
    title: 'Login',
    ocrLines: [
      'Sign In',
      'Email Address',
      'Enter your email',
      'Password',
      'Enter your password',
      'Forgot Password?',
      'Login',
      "Don't have an account? Sign Up",
    ],
    components: [
      comp('heading', 'Sign In', 0.3, 0.08, 0.4, 0.06),
      comp('label',   'Email Address', 0.1, 0.2, 0.35, 0.04),
      comp('input',   'Email', 0.1, 0.25, 0.8, 0.06, { placeholder: 'Enter your email', attributes: { inputType: 'email' } }),
      comp('label',   'Password', 0.1, 0.35, 0.35, 0.04),
      comp('input',   'Password', 0.1, 0.4, 0.8, 0.06, { placeholder: 'Enter your password', attributes: { inputType: 'password' } }),
      comp('link',    'Forgot Password?', 0.6, 0.5, 0.28, 0.03),
      comp('button',  'Login', 0.1, 0.56, 0.8, 0.07, { attributes: { variant: 'primary' } }),
      comp('text',    "Don't have an account? Sign Up", 0.2, 0.67, 0.6, 0.04),
    ],
  },

  // ── Generic Form ────────────────────────────────────────────────────────────
  form: {
    screenType: 'form' as const,
    title: 'Contact Form',
    ocrLines: [
      'Contact Us',
      'First Name',
      'Last Name',
      'Email Address',
      'Phone Number',
      'Subject',
      'Message',
      'Send Message',
      'Cancel',
    ],
    components: [
      comp('heading',  'Contact Us', 0.3, 0.05, 0.4, 0.07),
      comp('label',    'First Name', 0.05, 0.17, 0.3, 0.04),
      comp('input',    'First Name', 0.05, 0.22, 0.42, 0.06, { placeholder: 'Enter first name' }),
      comp('label',    'Last Name', 0.53, 0.17, 0.3, 0.04),
      comp('input',    'Last Name', 0.53, 0.22, 0.42, 0.06, { placeholder: 'Enter last name' }),
      comp('label',    'Email Address', 0.05, 0.33, 0.35, 0.04),
      comp('input',    'Email Address', 0.05, 0.38, 0.9, 0.06, { placeholder: 'you@example.com', attributes: { inputType: 'email' } }),
      comp('label',    'Phone Number', 0.05, 0.49, 0.3, 0.04),
      comp('input',    'Phone Number', 0.05, 0.54, 0.9, 0.06, { placeholder: '+1 (555) 000-0000', attributes: { inputType: 'tel' } }),
      comp('label',    'Subject', 0.05, 0.65, 0.2, 0.04),
      comp('dropdown', 'Subject', 0.05, 0.7, 0.9, 0.06, { placeholder: 'Select a topic' }),
      comp('label',    'Message', 0.05, 0.81, 0.2, 0.04),
      comp('input',    'Message', 0.05, 0.86, 0.9, 0.1, { placeholder: 'Write your message...', attributes: { multiline: true } }),
      comp('button',   'Send Message', 0.05, 0.98, 0.4, 0.07, { attributes: { variant: 'primary' } }),
      comp('button',   'Cancel', 0.5, 0.98, 0.4, 0.07, { attributes: { variant: 'secondary' } }),
    ],
  },

  // ── Registration Screen ──────────────────────────────────────────────────────
  registration: {
    screenType: 'form' as const,
    title: 'Create Account',
    ocrLines: [
      'Create Account',
      'Full Name',
      'Email',
      'Password',
      'Confirm Password',
      'Date of Birth',
      'Country',
      'I agree to Terms & Conditions',
      'Register',
    ],
    components: [
      comp('heading',  'Create Account', 0.3, 0.04, 0.4, 0.06),
      comp('label',    'Full Name', 0.05, 0.14, 0.3, 0.04),
      comp('input',    'Full Name', 0.05, 0.19, 0.9, 0.06, { placeholder: 'John Doe' }),
      comp('label',    'Email', 0.05, 0.3, 0.2, 0.04),
      comp('input',    'Email', 0.05, 0.35, 0.9, 0.06, { placeholder: 'john@example.com', attributes: { inputType: 'email' } }),
      comp('label',    'Password', 0.05, 0.46, 0.2, 0.04),
      comp('input',    'Password', 0.05, 0.51, 0.9, 0.06, { placeholder: '••••••••', attributes: { inputType: 'password' } }),
      comp('label',    'Confirm Password', 0.05, 0.62, 0.35, 0.04),
      comp('input',    'Confirm Password', 0.05, 0.67, 0.9, 0.06, { placeholder: '••••••••', attributes: { inputType: 'password' } }),
      comp('label',    'Date of Birth', 0.05, 0.78, 0.3, 0.04),
      comp('input',    'Date of Birth', 0.05, 0.83, 0.44, 0.06, { attributes: { inputType: 'date' } }),
      comp('label',    'Country', 0.51, 0.78, 0.2, 0.04),
      comp('dropdown', 'Country', 0.51, 0.83, 0.44, 0.06, { placeholder: 'Select country' }),
      comp('checkbox', 'I agree to Terms & Conditions', 0.05, 0.95, 0.7, 0.04),
      comp('button',   'Register', 0.05, 1.02, 0.9, 0.07, { attributes: { variant: 'primary' } }),
    ],
  },

  // ── Dashboard Screen ─────────────────────────────────────────────────────────
  dashboard: {
    screenType: 'dashboard' as const,
    title: 'Dashboard Overview',
    ocrLines: [
      'Dashboard',
      'Total Users',
      '12,450',
      'Revenue',
      '$98,320',
      'Active Cases',
      '342',
      'Pending',
      '87',
      'Recent Activity',
      'Search',
      'Filter',
      'Export',
    ],
    components: [
      comp('heading',   'Dashboard', 0.02, 0.02, 0.25, 0.06),
      comp('card',      'Total Users',   0.02, 0.12, 0.22, 0.14, { attributes: { value: '12,450', trend: '+5.2%' } }),
      comp('card',      'Revenue',       0.26, 0.12, 0.22, 0.14, { attributes: { value: '$98,320', trend: '+2.1%' } }),
      comp('card',      'Active Cases',  0.5, 0.12, 0.22, 0.14, { attributes: { value: '342', trend: '-1.0%' } }),
      comp('card',      'Pending',       0.74, 0.12, 0.22, 0.14, { attributes: { value: '87', trend: '+0.5%' } }),
      comp('section',   'Recent Activity', 0.02, 0.32, 0.96, 0.5),
      comp('input',     'Search',        0.02, 0.34, 0.5, 0.05, { placeholder: 'Search activity...' }),
      comp('button',    'Filter',        0.55, 0.34, 0.2, 0.05, { attributes: { variant: 'secondary' } }),
      comp('button',    'Export',        0.77, 0.34, 0.2, 0.05, { attributes: { variant: 'secondary' } }),
      comp('table',     'Activity Table', 0.02, 0.42, 0.96, 0.38),
    ],
  },
} as const;

export type MockScenario = keyof typeof MOCK_DETECTION_SCENARIOS;
