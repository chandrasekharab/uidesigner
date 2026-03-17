import type { UIComponent } from '@/types';

const API_BASE = '/api/ui';

/**
 * Save the current UI component tree to the backend.
 */
export async function saveUI(
  components: UIComponent[],
  name = 'Untitled UI'
): Promise<{ id: string; savedAt: string }> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ components, name }),
  });

  if (!res.ok) {
    throw new Error('Failed to save UI');
  }

  return res.json();
}

/**
 * Load the saved UI component tree from the backend.
 */
export async function loadUI(): Promise<{
  id: string;
  components: UIComponent[];
  name: string;
  savedAt: string;
}> {
  const res = await fetch(API_BASE);

  if (!res.ok) {
    throw new Error('Failed to load UI');
  }

  return res.json();
}
