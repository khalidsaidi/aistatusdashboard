'use client';

import { useState, useEffect } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render something - don't use early return
  return (
    <>
      {mounted ? (
        <>{children}</>
      ) : (
        <div className="max-w-6xl mx-auto text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      )}
    </>
  );
} 