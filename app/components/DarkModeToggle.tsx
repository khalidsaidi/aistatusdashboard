'use client';

import { useState, useEffect } from 'react';

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Handle cases where localStorage might not be available
    let darkMode = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        darkMode = localStorage.getItem('darkMode') === 'true';
      }
    } catch (error) {
      // localStorage not available or throws error
      console.warn('localStorage not available:', error);
    }

    setIsDark(darkMode);

    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

  if (!mounted) {
    return (
      <button
        type="button"
        className="p-3 rounded-md bg-gray-200 dark:bg-gray-700 min-h-[44px] min-w-[44px]"
        aria-label="Toggle dark mode"
      >
        <span className="w-5 h-5 block">🌙</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleDarkMode}
      className="p-3 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
      aria-label="Toggle dark mode"
    >
      <span className="w-5 h-5 block">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
