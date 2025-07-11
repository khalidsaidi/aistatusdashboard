'use client';

import React from 'react';
import { ToastProvider } from './components/ToastProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
} 