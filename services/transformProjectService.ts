/**
 * Transform Project Service
 *
 * Persists TransformProject records to localStorage.
 * Key: 'transform-projects'  →  TransformProject[]
 */

import { v4 as uuidv4 } from 'uuid';
import type { TransformProject, TransformStatus } from '@/types/canonical';

const STORAGE_KEY = 'transform-projects';

function load(): TransformProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TransformProject[]) : [];
  } catch {
    return [];
  }
}

function save(projects: TransformProject[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getAllProjects(): TransformProject[] {
  return load().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProject(id: string): TransformProject | null {
  return load().find((p) => p.id === id) ?? null;
}

export function createProject(name: string, description?: string): TransformProject {
  const now = new Date().toISOString();
  const project: TransformProject = {
    id: uuidv4(),
    name: name.trim() || 'Untitled project',
    description,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sourceText: '',
    intermediateSchema: [],
    overrides: {},
    targetJSON: '',
  };
  const projects = load();
  projects.push(project);
  save(projects);
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<Omit<TransformProject, 'id' | 'createdAt'>>
): TransformProject | null {
  const projects = load();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated: TransformProject = {
    ...projects[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  projects[idx] = updated;
  save(projects);
  return updated;
}

export function deleteProject(id: string): void {
  const projects = load().filter((p) => p.id !== id);
  save(projects);
}

export function renameProject(id: string, name: string): TransformProject | null {
  return updateProject(id, { name: name.trim() || 'Untitled project' });
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<TransformStatus, string> = {
  draft: 'Draft',
  parsed: 'Parsed',
  mapped: 'Mapped',
  complete: 'Complete',
};

export const STATUS_COLORS: Record<TransformStatus, { bg: string; text: string; dot: string }> = {
  draft:    { bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400' },
  parsed:   { bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-500' },
  mapped:   { bg: 'bg-orange-50',   text: 'text-orange-600',  dot: 'bg-orange-500' },
  complete: { bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-500' },
};
