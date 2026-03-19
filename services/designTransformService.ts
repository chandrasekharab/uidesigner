/**
 * Design Transform Service
 *
 * Persists named DesignTransform records to localStorage.
 * A single design input (one ParsedDesign) can produce many named transform
 * variants by saving the current overrides + generated Pega JSON each time.
 *
 * Storage key: 'design-transforms'  →  DesignTransform[]
 */

import { v4 as uuidv4 } from 'uuid';
import type { ParsedDesign, DetectedComponent } from '@/services/designParser';
import type { PegaConstellationMetadata } from '@/services/pegaMetadataGenerator';

const STORAGE_KEY = 'design-transforms';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DesignTransform {
  id: string;
  name: string;
  sourceTitle: string;                               // human label from ParsedDesign.title
  parsedDesign: ParsedDesign;
  overrides: Record<string, Partial<DetectedComponent>>;
  pegaMetadata: PegaConstellationMetadata;
  isMockResult: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function load(): DesignTransform[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DesignTransform[]) : [];
  } catch {
    return [];
  }
}

function persist(transforms: DesignTransform[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transforms));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getAllDesignTransforms(): DesignTransform[] {
  return load().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getDesignTransform(id: string): DesignTransform | null {
  return load().find((t) => t.id === id) ?? null;
}

export function saveDesignTransform(
  data: Omit<DesignTransform, 'id' | 'createdAt' | 'updatedAt'>
): DesignTransform {
  const now = new Date().toISOString();
  const entry: DesignTransform = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };
  const transforms = load();
  transforms.push(entry);
  persist(transforms);
  return entry;
}

export function updateDesignTransform(
  id: string,
  patch: Partial<Pick<DesignTransform, 'name' | 'overrides' | 'pegaMetadata'>>
): DesignTransform | null {
  const transforms = load();
  const idx = transforms.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated: DesignTransform = {
    ...transforms[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  transforms[idx] = updated;
  persist(transforms);
  return updated;
}

export function deleteDesignTransform(id: string): void {
  persist(load().filter((t) => t.id !== id));
}

/** Count how many saves share the same sourceTitle — used to auto-name variants */
export function countTransformsForTitle(title: string): number {
  return load().filter((t) => t.sourceTitle === title).length;
}
