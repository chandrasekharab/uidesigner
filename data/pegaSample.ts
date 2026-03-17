// ─── Realistic Pega Constellation View JSON Sample ────────────────────────────
// Represents a "New Customer Registration" case view.
// Structure follows Pega Constellation's View → Region → Component hierarchy.

export const PEGA_SAMPLE_JSON = {
  type: 'View',
  name: 'NewCustomerRegistration',
  config: {
    template: 'SimpleFormTemplate',
    ruleClass: 'Work-CustomerRegistration',
    inherit: 'Work-',
  },
  children: [
    {
      type: 'Region',
      config: { name: 'PersonalDetails' },
      children: [
        {
          type: 'TextInput',
          config: {
            label: { value: 'First Name' },
            value: '@P .FirstName',
            required: true,
            disabled: false,
            helperText: 'Enter your legal first name',
          },
        },
        {
          type: 'TextInput',
          config: {
            label: { value: 'Last Name' },
            value: '@P .LastName',
            required: true,
            disabled: false,
          },
        },
        {
          type: 'TextInput',
          config: {
            label: { value: 'Email Address' },
            value: '@P .EmailAddress',
            required: true,
            disabled: false,
            helperText: 'Work email preferred',
          },
        },
        {
          type: 'Dropdown',
          config: {
            label: { value: 'Country' },
            value: '@P .Country',
            datasource: '@ASSOCIATED .CountryOptions',
            required: true,
            placeholder: 'Select a country',
          },
        },
      ],
    },
    {
      type: 'Region',
      config: { name: 'AccountDetails' },
      children: [
        {
          type: 'TextInput',
          config: {
            label: { value: 'Company Name' },
            value: '@P .CompanyName',
            required: false,
            disabled: false,
          },
        },
        {
          type: 'Dropdown',
          config: {
            label: { value: 'Account Type' },
            value: '@P .AccountType',
            datasource: '@ASSOCIATED .AccountTypeOptions',
            required: true,
            placeholder: 'Choose account type',
          },
        },
        {
          type: 'Label',
          config: {
            value: 'Your information is protected by our privacy policy.',
            variant: 'caption',
          },
        },
      ],
    },
    {
      type: 'Region',
      config: { name: 'FormActions' },
      children: [
        {
          type: 'Button',
          config: {
            label: 'Submit Application',
            variant: 'primary',
            actions: [{ event: 'onClick', action: 'submitCase' }],
          },
        },
        {
          type: 'Button',
          config: {
            label: 'Save Draft',
            variant: 'secondary',
          },
        },
      ],
    },
  ],
};

export const PEGA_SAMPLE_STRING = JSON.stringify(PEGA_SAMPLE_JSON, null, 2);
