import type { UIComponent } from '@/types';

const STORAGE_KEY = 'ui-builder-saved';

/**
 * Explicitly save the current UI to a named localStorage slot.
 * (The Zustand store auto-saves drafts under a separate key.)
 */
export async function saveUI(
  components: UIComponent[],
  name = 'Untitled UI'
): Promise<{ id: string; savedAt: string }> {
  const savedAt = new Date().toISOString();
  const payload = { id: 'default', name, components, savedAt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return { id: 'default', savedAt };
}

/**
 * Load the last explicitly saved UI from localStorage.
 */
export async function loadUI(): Promise<{
  id: string;
  components: UIComponent[];
  name: string;
  savedAt: string;
}> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('No saved UI found in localStorage.');
  return JSON.parse(raw);
}
