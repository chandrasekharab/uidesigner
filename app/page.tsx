'use client';

import React from 'react';
import { Toolbar } from '@/components/Toolbar';
import { BuilderLayout } from '@/components/BuilderLayout';

export default function BuilderPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <Toolbar />
      <BuilderLayout />
    </div>
  );
}
