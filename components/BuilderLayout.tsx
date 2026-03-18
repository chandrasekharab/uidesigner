'use client';

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useBuilderStore } from '@/store/builderStore';
import { Palette } from '@/components/Palette';
import { Canvas } from '@/components/Canvas';
import { PropertyEditor } from '@/components/PropertyEditor';
import { JSONPanel } from '@/components/JSONPanel';
import type { DragData } from '@/types';

export const BuilderLayout = memo(function BuilderLayout() {
  const previewMode = useBuilderStore((s) => s.previewMode);
  const addComponent = useBuilderStore((s) => s.addComponent);
  const moveComponent = useBuilderStore((s) => s.moveComponent);

  const [activeData, setActiveData] = useState<DragData | null>(null);
  const activeDataRef = useRef<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData;
    activeDataRef.current = data;
    setActiveData(data);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const data = activeDataRef.current;
      activeDataRef.current = null;
      setActiveData(null);

      if (!data) return;

      if (data.source === 'palette' && data.type) {
        // Dropped onto a canvas component → try to nest inside it (Container)
        const overData = over?.data.current as DragData | undefined;
        const isOverContainer =
          overData?.source === 'canvas' &&
          over?.id !== active.id;

        const parentId = isOverContainer ? String(over!.id) : null;
        addComponent(data.type, parentId);
        return;
      }

      if (data.source === 'canvas' && active.id !== over?.id) {
        moveComponent(
          String(active.id),
          over?.id ? String(over.id) : null
        );
      }
    },
    [addComponent, moveComponent]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 overflow-hidden">
        {!previewMode && <Palette />}

        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 relative">
          {previewMode && (
            <div className="sticky top-0 z-10 bg-indigo-600 text-white text-xs font-medium py-1 text-center tracking-wide">
              PREVIEW MODE — Click &ldquo;Edit Mode&rdquo; in the toolbar to make changes
            </div>
          )}
          <Canvas />
        </main>

        {!previewMode && <PropertyEditor />}
        <JSONPanel />
      </div>

      {/* Drag ghost */}
      <DragOverlay dropAnimation={null}>
        {activeData?.source === 'palette' && activeData.type ? (
          <div className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-xl opacity-90 pointer-events-none">
            + {activeData.type}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
