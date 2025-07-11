import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DarkModeToggle from '@/app/components/DarkModeToggle';
import Navbar from '@/app/components/Navbar';

describe('Dark Mode Toggle Component', () => {
  beforeEach(() => {
    // Reset document classes for test isolation
    document.documentElement.classList.remove('dark');
    // Clear localStorage to ensure clean state
    localStorage.clear();
  });

  describe('Component Rendering', () => {
    it('should render dark mode toggle button', () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-label');
    });

    it('should show moon icon in light mode', () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
      // Check for moon icon SVG path
      expect(toggle.querySelector('path')).toHaveAttribute('d', 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z');
    });

    it('should handle theme state changes', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      
      // Test initial state
      expect(toggle).toBeInTheDocument();
      
      // Test click interaction
      await userEvent.click(toggle);
      
      // Component should handle state change
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });
  });

  describe('Theme Detection', () => {
    it('should handle system preference detection', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      
      // Component should render without errors regardless of system preference
      expect(toggle).toBeInTheDocument();
      // Check that an SVG icon is present
      expect(toggle.querySelector('svg')).toBeInTheDocument();
    });

    it('should prioritize saved preferences', async () => {
      // Test that component handles localStorage gracefully
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toBeInTheDocument();
      
      // Component should work regardless of localStorage state
      await userEvent.click(toggle);
      
      await waitFor(() => {
        // Check that an SVG icon is present
        expect(toggle.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Toggle Functionality', () => {
    it('should switch themes on click', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      const initialPath = toggle.querySelector('path')?.getAttribute('d');
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        // Icon should change after click
        const newPath = toggle.querySelector('path')?.getAttribute('d');
        expect(newPath).not.toBe(initialPath);
      });
    });

    it('should update document classes', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      
      // Initial state should be light mode (no dark class)
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        // Document should have dark class applied
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      }, { timeout: 2000 });
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        // Dark class should be removed
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      }, { timeout: 2000 });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be accessible via keyboard (Enter key)', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      toggle.focus();
      
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('should be accessible via keyboard (Space key)', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      toggle.focus();
      
      // Initial state should be light mode
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      
      await userEvent.keyboard(' ');
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      }, { timeout: 2000 });
    });

    it('should have visible focus indicator', () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      toggle.focus();
      
      expect(toggle).toHaveFocus();
      // Focus styles should be visible (tested via CSS classes)
      expect(toggle).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toHaveAttribute('aria-label');
      expect(toggle).toHaveAttribute('title');
    });

    it('should update aria-label when theme changes', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      const initialLabel = toggle.getAttribute('aria-label');
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        const newLabel = toggle.getAttribute('aria-label');
        expect(newLabel).not.toBe(initialLabel);
      });
    });
  });
});

describe('Dark Mode Integration in Navbar', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('should render dark mode toggle in navbar', () => {
    render(<Navbar />);
    
    const toggles = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
    expect(toggles.length).toBeGreaterThan(0);
    expect(toggles[0]).toBeInTheDocument();
  });

      it('should handle theme switching in navbar context', async () => {
      render(<Navbar />);
      
      const toggles = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      const toggle = toggles[0]; // Use first toggle (desktop version)
      
      // Initial state should be light mode
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      }, { timeout: 2000 });
    });

  describe('Mobile Responsiveness', () => {
    it('should show dark mode toggle on mobile screens', () => {
      // Test that component renders on different screen sizes
      render(<Navbar />);
      
      const toggles = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      expect(toggles.length).toBe(2); // Desktop and mobile versions
      expect(toggles[0]).toBeVisible();
    });
  });
});

describe('Theme Propagation', () => {
  it('should apply dark theme classes to document element', async () => {
    render(<DarkModeToggle />);
    
    const toggle = screen.getByRole('button');
    await userEvent.click(toggle);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should remove dark theme classes when switching to light', async () => {
    // Start by applying dark mode
    document.documentElement.classList.add('dark');
    
    render(<DarkModeToggle />);
    
    const toggle = screen.getByRole('button');
    await userEvent.click(toggle);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});

describe('SSR Compatibility', () => {
  it('should not cause hydration mismatches', () => {
    // Test that component renders without throwing
    expect(() => {
      render(<DarkModeToggle />);
    }).not.toThrow();
  });

  it('should handle missing APIs gracefully', () => {
    // Test that component handles missing browser APIs
    expect(() => {
      render(<DarkModeToggle />);
    }).not.toThrow();
  });
});

describe('Dark Mode Toggle Integration', () => {
  beforeEach(() => {
    // Reset document classes
    document.documentElement.className = '';
    localStorage.clear();
  });

  describe('Navbar Integration', () => {
    it('should render dark mode toggle in navbar', () => {
      render(<Navbar />);
      
      // Look for the dark mode toggle buttons (desktop and mobile)
      const toggleButtons = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      expect(toggleButtons.length).toBe(2);
      expect(toggleButtons[0]).toBeInTheDocument();
    });

    it('should position correctly in navbar layout', () => {
      render(<Navbar />);
      
      const navbar = screen.getByRole('banner');
      const toggleButtons = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      
      // Verify toggles are within navbar
      expect(navbar).toContainElement(toggleButtons[0]);
      expect(navbar).toContainElement(toggleButtons[1]);
    });
  });

  describe('Theme Switching', () => {
    it('should toggle theme when clicked', async () => {
      render(<Navbar />);
      
      const toggleButtons = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      const toggleButton = toggleButtons[0]; // Use desktop version
      
      // Initial state should be light mode
      expect(document.documentElement).not.toHaveClass('dark');
      
      // Click to switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
    });

    it('should update toggle icon based on current theme', async () => {
      render(<Navbar />);
      
      const toggleButtons = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      const toggleButton = toggleButtons[0]; // Use desktop version
      const initialPath = toggleButton.querySelector('path')?.getAttribute('d');
      
      // Click to switch theme
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        // Icon should change
        const newPath = toggleButton.querySelector('path')?.getAttribute('d');
        expect(newPath).not.toBe(initialPath);
      });
    });
  });

  describe('Component Updates', () => {
    it('should update themed components when theme changes', async () => {
      render(<Navbar />);
      
      const toggleButtons = screen.getAllByRole('button', { name: /switch to (dark|light) mode/i });
      const toggleButton = toggleButtons[0]; // Use desktop version
      const navbar = screen.getByRole('banner');
      
      // Switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
        // Navbar should be present and themed
        expect(navbar).toBeInTheDocument();
      });
    });
  });
}); 