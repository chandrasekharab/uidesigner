'use client';

import React, { memo, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useBuilderStore } from '@/store/builderStore';
import { ComponentRenderer } from '@/components/ComponentRenderer';
import type { UIComponent, DragData } from '@/types';
import { cn } from '@/utils/cn';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';

// ─── Sortable Wrapper for Canvas Items ───────────────────────────────────────

interface SortableItemProps {
  component: UIComponent;
  selectedId: string | null;
  onSelect: (id: string) => void;
  previewMode: boolean;
}

function SortableItem({ component, selectedId, onSelect, previewMode }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: component.id,
    data: { source: 'canvas', id: component.id } satisfies DragData,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {!previewMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-5 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 z-10"
        >
          <GripVertical size={14} />
        </div>
      )}
      <ComponentRenderer
        component={component}
        onSelect={onSelect}
        previewMode={previewMode}
        isSelected={selectedId === component.id}
      />
    </div>
  );
}

// ─── Droppable Canvas Root ────────────────────────────────────────────────────

interface DroppableCanvasProps {
  components: UIComponent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  previewMode: boolean;
}

function DroppableCanvas({
  components,
  selectedId,
  onSelect,
  previewMode,
}: DroppableCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-root' });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect('');
      }}
      className={cn(
        'min-h-full p-6 transition-colors',
        isOver && 'bg-indigo-50',
        components.length === 0 && 'flex items-center justify-center'
      )}
    >
      {components.length === 0 ? (
        <div className={cn(
          'flex flex-col items-center justify-center gap-3',
          'border-2 border-dashed rounded-xl p-12 text-center',
          'transition-colors',
          isOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300'
        )}>
          <div className="text-4xl">🖼️</div>
          <p className="text-sm font-medium text-slate-500">
            Drag components from the left panel
          </p>
          <p className="text-xs text-slate-400">
            Your UI will appear here
          </p>
        </div>
      ) : (
        <SortableContext
          items={components.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pl-5">
            {components.map((c) => (
              <SortableItem
                key={c.id}
                component={c}
                selectedId={selectedId}
                onSelect={onSelect}
                previewMode={previewMode}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

// ─── Canvas Panel ─────────────────────────────────────────────────────────────

export const Canvas = memo(function Canvas() {
  const components = useBuilderStore((s) => s.components);
  const selectedId = useBuilderStore((s) => s.selectedId);
  const previewMode = useBuilderStore((s) => s.previewMode);
  const addComponent = useBuilderStore((s) => s.addComponent);
  const moveComponent = useBuilderStore((s) => s.moveComponent);
  const selectComponent = useBuilderStore((s) => s.selectComponent);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeDataRef = useRef<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    activeDataRef.current = data;
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const data = activeDataRef.current;
      activeDataRef.current = null;
      setActiveId(null);

      if (!data) return;

      if (data.source === 'palette' && data.type) {
        // Adding a new component from palette
        const overData = over?.data.current as DragData | undefined;
        const parentId =
          overData?.source === 'canvas' && over?.id !== active.id
            ? String(over?.id ?? '')
            : null;

        addComponent(data.type, parentId === '' ? null : parentId);
        return;
      }

      if (data.source === 'canvas' && active.id !== over?.id) {
        // Reordering on canvas
        moveComponent(
          String(active.id),
          over?.id ? String(over.id) : null
        );
      }
    },
    [addComponent, moveComponent]
  );

  const handleSelect = useCallback(
    (id: string) => selectComponent(id || null),
    [selectComponent]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <DroppableCanvas
        components={components}
        selectedId={selectedId}
        onSelect={handleSelect}
        previewMode={previewMode}
      />

      <DragOverlay>
        {activeId && activeDataRef.current?.source === 'palette' && (
          <div className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg shadow-lg opacity-90">
            + {activeDataRef.current.type}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
});
