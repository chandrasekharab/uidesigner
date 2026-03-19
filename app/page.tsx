'use client';

import React from 'react';
import { Toolbar } from '@/components/Toolbar';
import { BuilderLayout } from '@/components/BuilderLayout';
import { TransformationStudio } from '@/components/transform/TransformationStudio';
import { RendererExperience } from '@/components/renderer/RendererExperience';
import { DesignGeneratorExperience } from '@/components/design/DesignGeneratorExperience';
import { SchemaAwareExperience } from '@/components/design/SchemaAwareExperience';
import { useBuilderStore } from '@/store/builderStore';

export default function BuilderPage() {
  const appMode = useBuilderStore((s) => s.appMode);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <Toolbar />
      {appMode === 'builder' ? (
        <BuilderLayout />
      ) : appMode === 'transform' ? (
        <TransformationStudio />
      ) : appMode === 'design' ? (
        <DesignGeneratorExperience />
      ) : appMode === 'schema-design' ? (
        <SchemaAwareExperience />
      ) : (
        <RendererExperience />
      )}
    </div>
  );
}
