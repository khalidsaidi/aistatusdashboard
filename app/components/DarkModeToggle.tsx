'use client';

import { useState, useEffect } from 'react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage ? localStorage.getItem('darkMode') === 'true' : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);

    // Handle cases where localStorage might not be available
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('darkMode', newDarkMode.toString());
      }
    } catch (error) {
      // localStorage not available or throws error
      console.warn('localStorage not available:', error);
    }

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      className="h-10 w-10 rounded-full border border-slate-200/70 bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center"
      aria-label="Toggle dark mode"
      suppressHydrationWarning
      data-tour="theme-toggle"
    >
      {isDark ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4.75a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5A.75.75 0 0112 4.75zm0 14.5a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm7.25-7.25a.75.75 0 01.75-.75v-.5a.75.75 0 011.5 0v.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75zm-14.5 0a.75.75 0 01.75-.75v-.5a.75.75 0 011.5 0v.5a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75zM6.47 6.47a.75.75 0 011.06 0l.35.35a.75.75 0 01-1.06 1.06l-.35-.35a.75.75 0 010-1.06zm10.64 10.64a.75.75 0 011.06 0l.35.35a.75.75 0 11-1.06 1.06l-.35-.35a.75.75 0 010-1.06zM17.53 6.47a.75.75 0 010 1.06l-.35.35a.75.75 0 11-1.06-1.06l.35-.35a.75.75 0 011.06 0zM6.82 16.12a.75.75 0 010 1.06l-.35.35a.75.75 0 01-1.06-1.06l.35-.35a.75.75 0 011.06 0zM12 7.25A4.75 4.75 0 1016.75 12 4.76 4.76 0 0012 7.25z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.64 13a1 1 0 00-1.05-.14A8.05 8.05 0 0111.14 3.4a1 1 0 00-1.19-1.19A10 10 0 1021.78 14a1 1 0 00-.14-1z" />
        </svg>
      )}
    </button>
  );
}
