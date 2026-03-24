import { NextRequest, NextResponse } from 'next/server';
import type { UIComponent } from '@/types';

// ─── Mock AI Suggestions ──────────────────────────────────────────────────────
// Replace this with a real AI provider integration (OpenAI, Anthropic, etc.)
// by reading process.env.NEXT_PUBLIC_AI_API_KEY and calling the appropriate API.

const MOCK_TEMPLATES: Record<string, UIComponent[]> = {
  'login form': [
    {
      id: 'ai-container-1',
      type: 'Container',
      props: { layout: 'vertical', gap: 16, padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', label: 'Login Form' },
      children: [
        {
          id: 'ai-title-1',
          type: 'Text',
          props: { content: 'Sign In', variant: 'h2', color: '#1e293b', align: 'center', bold: true, italic: false },
          children: [],
        },
        {
          id: 'ai-email-1',
          type: 'TextInput',
          props: { label: 'Email', placeholder: 'you@example.com', type: 'email', required: true, disabled: false, helperText: '', value: '' },
          children: [],
        },
        {
          id: 'ai-password-1',
          type: 'TextInput',
          props: { label: 'Password', placeholder: '••••••••', type: 'password', required: true, disabled: false, helperText: '', value: '' },
          children: [],
        },
        {
          id: 'ai-btn-1',
          type: 'Button',
          props: { label: 'Sign In', variant: 'primary', size: 'md', disabled: false, fullWidth: true },
          children: [],
        },
      ],
    },
  ],

  'contact form': [
    {
      id: 'ai-container-2',
      type: 'Container',
      props: { layout: 'vertical', gap: 12, padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', label: 'Contact Form' },
      children: [
        {
          id: 'ai-title-2',
          type: 'Text',
          props: { content: 'Contact Us', variant: 'h2', color: '#1e293b', align: 'left', bold: true, italic: false },
          children: [],
        },
        {
          id: 'ai-name-2',
          type: 'TextInput',
          props: { label: 'Full Name', placeholder: 'John Doe', type: 'text', required: true, disabled: false, helperText: '', value: '' },
          children: [],
        },
        {
          id: 'ai-email-2',
          type: 'TextInput',
          props: { label: 'Email', placeholder: 'you@example.com', type: 'email', required: true, disabled: false, helperText: '', value: '' },
          children: [],
        },
        {
          id: 'ai-topic-2',
          type: 'Dropdown',
          props: { label: 'Topic', placeholder: 'Choose a topic', options: [{ label: 'Support', value: 'support' }, { label: 'Sales', value: 'sales' }, { label: 'Other', value: 'other' }], required: false, disabled: false },
          children: [],
        },
        {
          id: 'ai-btn-2',
          type: 'Button',
          props: { label: 'Send Message', variant: 'primary', size: 'md', disabled: false, fullWidth: false },
          children: [],
        },
      ],
    },
  ],

  default: [
    {
      id: 'ai-default-1',
      type: 'Container',
      props: { layout: 'vertical', gap: 16, padding: 24, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', label: 'AI Generated' },
      children: [
        {
          id: 'ai-default-text',
          type: 'Text',
          props: { content: 'AI-generated UI placeholder', variant: 'body', color: '#64748b', align: 'center', bold: false, italic: true },
          children: [],
        },
        {
          id: 'ai-default-btn',
          type: 'Button',
          props: { label: 'Get Started', variant: 'primary', size: 'md', disabled: false, fullWidth: false },
          children: [],
        },
      ],
    },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt too long (max 2000 characters)' }, { status: 400 });
    }

    // ── Real AI integration point ─────────────────────────────────────────────
    // const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;
    // if (apiKey) {
    //   const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //     method: 'POST',
    //     headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       model: 'gpt-4o',
    //       messages: [{ role: 'user', content: `Generate a UI JSON schema for: ${prompt}` }],
    //     }),
    //   });
    //   const data = await response.json();
    //   const components = JSON.parse(data.choices[0].message.content);
    //   return NextResponse.json({ components });
    // }
    // ─────────────────────────────────────────────────────────────────────────

    // Mock: pick template based on prompt keywords
    const lower = prompt.toLowerCase();
    let components = MOCK_TEMPLATES.default;

    for (const [key, template] of Object.entries(MOCK_TEMPLATES)) {
      if (key !== 'default' && lower.includes(key)) {
        components = template;
        break;
      }
    }

    // Simulate slight network delay (remove in production)
    await new Promise((r) => setTimeout(r, 600));

    return NextResponse.json({ components, mock: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
