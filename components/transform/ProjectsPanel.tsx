'use client';

/**
 * ProjectsPanel
 *
 * Left sidebar in the Transform mode.
 * Lists all saved TransformProject records, lets the user create / rename /
 * delete them, and shows the lifecycle status badge for each.
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { cn } from '@/utils/cn';
import type { TransformProject } from '@/types/canonical';
import {
  getAllProjects,
  createProject,
  deleteProject,
  renameProject,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/services/transformProjectService';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  FolderOpen,
  Layers,
} from 'lucide-react';

interface ProjectsPanelProps {
  activeId: string | null;
  onSelect: (project: TransformProject) => void;
  onProjectsChange?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const ProjectsPanel = memo(function ProjectsPanel({
  activeId,
  onSelect,
  onProjectsChange,
}: ProjectsPanelProps) {
  const [projects, setProjects] = useState<TransformProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setProjects(getAllProjects());
    onProjectsChange?.();
  }, [onProjectsChange]);

  useEffect(() => { refresh(); }, [refresh]);

  // Focus inputs when they appear
  useEffect(() => {
    if (creating && newInputRef.current) newInputRef.current.focus();
  }, [creating]);
  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  const handleCreate = useCallback(() => {
    const name = newName.trim() || 'Untitled project';
    const project = createProject(name);
    setCreating(false);
    setNewName('');
    refresh();
    onSelect(project);
  }, [newName, onSelect, refresh]);

  const handleRename = useCallback(
    (id: string) => {
      if (editName.trim()) renameProject(id, editName.trim());
      setEditingId(null);
      setEditName('');
      refresh();
    },
    [editName, refresh]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteProject(id);
      setConfirmDeleteId(null);
      refresh();
    },
    [refresh]
  );

  return (
    <div className="w-60 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            Projects
          </span>
          <span className="ml-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full px-1.5 py-0.5 font-medium">
            {projects.length}
          </span>
        </div>
        <button
          onClick={() => { setCreating(true); setNewName(''); }}
          title="New project"
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors font-medium"
        >
          <Plus size={11} /> New
        </button>
      </div>

      {/* New project input */}
      {creating && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-indigo-100 bg-indigo-50 flex-shrink-0">
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            placeholder="Project name…"
            className="flex-1 text-xs px-2 py-1 rounded border border-indigo-300 outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-800 dark:border-indigo-600 dark:text-slate-100"
          />
          <button onClick={handleCreate} className="text-green-600 hover:text-green-700">
            <Check size={14} />
          </button>
          <button onClick={() => { setCreating(false); setNewName(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Project list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {projects.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 gap-2 px-4 text-center">
            <FolderOpen size={22} className="opacity-40" />
            <p className="text-[11px]">No projects yet.<br />Click <strong>New</strong> to create one.</p>
          </div>
        )}

        {projects.map((project) => {
          const sc = STATUS_COLORS[project.status];
          const isActive = project.id === activeId;
          const isEditing = editingId === project.id;
          const isConfirmDelete = confirmDeleteId === project.id;

          return (
            <div
              key={project.id}
              onClick={() => !isEditing && !isConfirmDelete && onSelect(project)}
              className={cn(
                'group relative flex flex-col px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-2 border-l-transparent'
              )}
            >
              {/* Name row */}
              <div className="flex items-start gap-1.5">
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(project.id);
                      if (e.key === 'Escape') { setEditingId(null); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 outline-none focus:ring-1 focus:ring-indigo-400 dark:bg-slate-800 dark:text-slate-100"
                  />
                ) : (
                  <span
                    className={cn(
                      'flex-1 text-xs font-semibold truncate leading-tight',
                      isActive ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                    )}
                  >
                    {project.name}
                  </span>
                )}

                {/* Action buttons — visible on hover or when active */}
                {!isEditing && !isConfirmDelete && (
                  <div className={cn(
                    'flex items-center gap-0.5 flex-shrink-0 transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(project.id);
                        setEditName(project.name);
                      }}
                      title="Rename"
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(project.id);
                      }}
                      title="Delete"
                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); handleRename(project.id); }}
                      className="p-0.5 rounded hover:bg-green-100 text-green-600"><Check size={11} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"><X size={11} /></button>
                  </div>
                )}
              </div>

              {/* Delete confirmation */}
              {isConfirmDelete && (
                <div
                  className="flex items-center gap-1.5 mt-1.5 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-red-600 font-medium">Delete?</span>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Status badge + timestamp */}
              {!isEditing && !isConfirmDelete && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={cn('flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', sc.bg, sc.text)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', sc.dot)} />
                    {STATUS_LABELS[project.status]}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
