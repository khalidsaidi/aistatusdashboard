'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import DarkModeToggle from './DarkModeToggle';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-slate-700 dark:bg-gray-800 text-white shadow-lg border-b border-slate-600 dark:border-gray-600">
      <div className="flex items-center justify-between w-full px-4 py-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="flex items-center gap-4 hover:opacity-90 transition-opacity">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-75 blur-md animate-pulse"></div>
              <div className="relative bg-white rounded-full p-2 shadow-xl">
                <Image
                  src="/logo.png"
                  alt="AI Status Dashboard Logo"
                  width={48}
                  height={48}
                  className="rounded-full"
                  priority
                />
              </div>
            </div>
            <h1 className="text-xl md:text-2xl font-bold">AI Status Dashboard</h1>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <DarkModeToggle />
          <nav className="flex gap-6">
            <Link 
              href="/" 
              className="hover:opacity-80 transition-opacity py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
              aria-label="Dashboard"
            >
              Dashboard
            </Link>
            <Link 
              href="/?tab=api" 
              className="hover:opacity-80 transition-opacity py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
              aria-label="API Documentation"
            >
              API
            </Link>
            <a 
              href="/rss.xml" 
              className="hover:opacity-80 transition-opacity py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
              aria-label="RSS Feed"
            >
              RSS Feed
            </a>
          </nav>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-3">
          <DarkModeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md hover:bg-slate-600 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              // Close icon
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Hamburger icon
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          
          {/* Mobile Menu */}
          <div className="absolute top-full left-0 right-0 bg-slate-700 dark:bg-gray-800 border-t border-slate-600 dark:border-gray-600 z-50 md:hidden">
            <nav className="px-4 py-6 space-y-4">
              <Link 
                href="/" 
                className="block py-3 px-4 rounded-md hover:bg-slate-600 dark:hover:bg-gray-700 transition-colors text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                📊 Dashboard
              </Link>
              <Link 
                href="/?tab=api" 
                className="block py-3 px-4 rounded-md hover:bg-slate-600 dark:hover:bg-gray-700 transition-colors text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                🚀 API
              </Link>
              <a 
                href="/rss.xml" 
                className="block py-3 px-4 rounded-md hover:bg-slate-600 dark:hover:bg-gray-700 transition-colors text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => setMobileMenuOpen(false)}
              >
                📡 RSS Feed
              </a>
            </nav>
          </div>
        </>
      )}
    </header>
  );
} 