'use client';

import { useState, useEffect } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  // Simplified approach - just render children directly
  // The hydration mismatch protection is handled by individual components
  return <>{children}</>;
}
