import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DarkModeToggle from '@/app/components/DarkModeToggle';
import Navbar from '@/app/components/Navbar';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, width, height, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} {...props} />;
  };
});

describe('Dark Mode Toggle Component', () => {
  beforeEach(() => {
    // Clear mocks
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    document.documentElement.classList.remove('dark');
  });

  describe('Component Rendering', () => {
    it('should render dark mode toggle button', () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-label');
    });

    it('should show moon icon in light mode', () => {
      localStorageMock.getItem.mockReturnValue('light');
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toHaveTextContent('🌙');
      expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
    });

    it('should show sun icon in dark mode', async () => {
      localStorageMock.getItem.mockReturnValue('dark');
      render(<DarkModeToggle />);
      
      await waitFor(() => {
        const toggle = screen.getByRole('button');
        expect(toggle).toHaveTextContent('☀️');
        expect(toggle).toHaveAttribute('aria-label', 'Switch to light mode');
      });
    });
  });

  describe('Theme Detection', () => {
    it('should detect system preference for dark mode', async () => {
      // Mock system preference for dark mode
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      localStorageMock.getItem.mockReturnValue(null); // No saved preference
      
      render(<DarkModeToggle />);
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        const toggle = screen.getByRole('button');
        expect(toggle).toHaveTextContent('☀️');
      });
    });

    it('should use saved theme preference over system preference', async () => {
      // Mock system preference for dark mode
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      localStorageMock.getItem.mockReturnValue('light'); // Saved as light
      
      render(<DarkModeToggle />);
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        const toggle = screen.getByRole('button');
        expect(toggle).toHaveTextContent('🌙');
      });
    });
  });

  describe('Toggle Functionality', () => {
    it('should switch from light to dark mode on click', async () => {
      localStorageMock.getItem.mockReturnValue('light');
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      expect(toggle).toHaveTextContent('🌙');
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        expect(toggle).toHaveTextContent('☀️');
        expect(toggle).toHaveAttribute('aria-label', 'Switch to light mode');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
    });

    it('should switch from dark to light mode on click', async () => {
      localStorageMock.getItem.mockReturnValue('dark');
      render(<DarkModeToggle />);
      
      await waitFor(() => {
        const toggle = screen.getByRole('button');
        expect(toggle).toHaveTextContent('☀️');
      });
      
      const toggle = screen.getByRole('button');
      await userEvent.click(toggle);
      
      await waitFor(() => {
        expect(toggle).toHaveTextContent('🌙');
        expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });
  });

  describe('Local Storage Persistence', () => {
    it('should save theme preference to localStorage', async () => {
      render(<DarkModeToggle />);
      
      const toggle = screen.getByRole('button');
      await userEvent.click(toggle);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should load theme preference from localStorage on mount', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      render(<DarkModeToggle />);
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('theme');
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
      
      await userEvent.keyboard(' ');
      
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
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
      expect(toggle).toHaveAttribute('aria-label', 'Switch to dark mode');
      
      await userEvent.click(toggle);
      
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-label', 'Switch to light mode');
      });
    });
  });
});

describe('Dark Mode Integration in Navbar', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    document.documentElement.classList.remove('dark');
  });

  it('should render dark mode toggle in navbar', () => {
    render(<Navbar />);
    
    // This test will FAIL initially because DarkModeToggle is not integrated
    const toggle = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(toggle).toBeInTheDocument();
  });

  it('should position dark mode toggle between logo and navigation', () => {
    render(<Navbar />);
    
    const logo = screen.getByAltText('AI Status Dashboard Logo');
    const toggle = screen.getByRole('button', { name: /switch to dark mode/i });
    const nav = screen.getByRole('navigation');
    
    // Check positioning in DOM order
    const logoParent = logo.closest('div');
    const toggleElement = toggle;
    const navElement = nav;
    
    expect(logoParent?.nextElementSibling).toBe(toggleElement);
    expect(toggleElement.nextElementSibling).toBe(navElement);
  });

  it('should apply dark theme to navbar when toggled', async () => {
    render(<Navbar />);
    
    const toggle = screen.getByRole('button', { name: /switch to dark mode/i });
    const header = screen.getByRole('banner');
    
    await userEvent.click(toggle);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      // Navbar should have dark theme classes
      expect(header).toHaveClass('dark:bg-gray-800');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should show dark mode toggle on mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      render(<Navbar />);
      
      const toggle = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(toggle).toBeVisible();
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
    // Start in dark mode
    localStorageMock.getItem.mockReturnValue('dark');
    render(<DarkModeToggle />);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    
    const toggle = screen.getByRole('button');
    await userEvent.click(toggle);
    
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});

describe('SSR Compatibility', () => {
  it('should not cause hydration mismatches', () => {
    // Mock SSR environment
    const originalWindow = global.window;
    delete (global as any).window;
    
    // This should not throw
    expect(() => {
      render(<DarkModeToggle />);
    }).not.toThrow();
    
    // Restore window
    global.window = originalWindow;
  });

  it('should handle missing localStorage gracefully', () => {
    const originalLocalStorage = window.localStorage;
    delete (window as any).localStorage;
    
    expect(() => {
      render(<DarkModeToggle />);
    }).not.toThrow();
    
    window.localStorage = originalLocalStorage;
  });
});

describe('Dark Mode Toggle Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset document classes
    document.documentElement.className = '';
  });

  describe('Navbar Integration', () => {
    it('should render dark mode toggle in navbar', () => {
      render(<Navbar />);
      
      // Look for the dark mode toggle button
      const toggleButton = screen.getByRole('button', { name: /switch to (dark|light) mode/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should position dark mode toggle between logo and navigation', () => {
      render(<Navbar />);
      
      const navbar = screen.getByRole('banner');
      const logo = screen.getByAltText(/ai status dashboard logo/i);
      const toggleButton = screen.getByRole('button', { name: /switch to (dark|light) mode/i });
      const navigation = screen.getByRole('navigation');
      
      // Check that toggle appears after logo but before navigation in DOM order
      const navbarChildren = Array.from(navbar.querySelectorAll('*'));
      const logoIndex = navbarChildren.findIndex(child => child.contains(logo));
      const toggleIndex = navbarChildren.findIndex(child => child.contains(toggleButton));
      const navIndex = navbarChildren.findIndex(child => child.contains(navigation));
      
      expect(logoIndex).toBeLessThan(toggleIndex);
      expect(toggleIndex).toBeLessThan(navIndex);
    });
  });

  describe('Theme Switching', () => {
    it('should toggle theme when clicked', async () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      
      // Initial state should be light mode
      expect(document.documentElement).not.toHaveClass('dark');
      
      // Click to switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
      
      // Click again to switch back to light mode
      const lightModeButton = screen.getByRole('button', { name: /switch to light mode/i });
      fireEvent.click(lightModeButton);
      
      await waitFor(() => {
        expect(document.documentElement).not.toHaveClass('dark');
      });
    });

    it('should update toggle icon based on current theme', async () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      
      // Should show moon icon in light mode (indicating dark mode available)
      expect(toggleButton).toHaveTextContent('🌙');
      
      // Click to switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        // Should show sun icon in dark mode (indicating light mode available)
        const lightModeButton = screen.getByRole('button', { name: /switch to light mode/i });
        expect(lightModeButton).toHaveTextContent('☀️');
      });
    });
  });

  describe('localStorage Persistence', () => {
    it('should save theme preference to localStorage', async () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      
      // Click to switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      });
      
      // Click to switch back to light mode
      const lightModeButton = screen.getByRole('button', { name: /switch to light mode/i });
      fireEvent.click(lightModeButton);
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      });
    });

        it('should load theme preference from localStorage on mount', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      render(<Navbar />);
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('theme');
      expect(document.documentElement).toHaveClass('dark');
    });

    it('should default to light theme when no preference stored', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      render(<Navbar />);

      expect(document.documentElement).not.toHaveClass('dark');
    });
  });

  describe('Component Updates', () => {
    it('should update all themed components when theme changes', async () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      const navbar = screen.getByRole('banner');
      
      // Initial light theme styling
      expect(navbar).toHaveClass('bg-slate-700');
      
      // Switch to dark mode
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
        // Navbar should have dark theme classes applied
        expect(navbar).toHaveClass('dark:bg-gray-800');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      
      expect(toggleButton).toHaveAttribute('aria-label');
      expect(toggleButton).toHaveAttribute('title');
    });

    it('should be keyboard accessible', () => {
      render(<Navbar />);
      
      const toggleButton = screen.getByRole('button', { name: /switch to dark mode/i });
      
      // Should be focusable
      toggleButton.focus();
      expect(toggleButton).toHaveFocus();
      
      // Should respond to Enter key
      fireEvent.keyDown(toggleButton, { key: 'Enter', code: 'Enter' });
      expect(document.documentElement).toHaveClass('dark');
      
      // Should respond to Space key
      fireEvent.keyDown(toggleButton, { key: ' ', code: 'Space' });
      expect(document.documentElement).not.toHaveClass('dark');
    });
  });
}); 