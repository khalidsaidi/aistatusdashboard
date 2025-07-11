import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DarkModeToggle from '@/app/components/DarkModeToggle';
import Navbar from '@/app/components/Navbar';

// Custom render function that sets up userEvent properly
function renderWithUser(ui: React.ReactElement) {
  const user = userEvent.setup();
  return {
    user,
    ...render(ui),
  };
}

// Helper function to safely perform user interactions
async function safeUserInteraction(callback: () => Promise<void>) {
  await act(async () => {
    await callback();
  });
}

describe('Dark Mode Toggle Component', () => {
  beforeEach(() => {
    // Reset document classes for test isolation
    document.documentElement.classList.remove('dark');
    // Clear localStorage to ensure clean state
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.clear();
    }
  });

  afterEach(() => {
    // Clean up after each test
    document.documentElement.classList.remove('dark');
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.clear();
    }
  });

  it('should render the toggle button', () => {
    render(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('should display moon emoji initially (light mode)', () => {
    render(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });
    expect(toggleButton).toHaveTextContent('🌙');
  });

  it('should toggle to dark mode when clicked', async () => {
    const { user } = renderWithUser(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Initially should show moon (light mode)
    expect(toggleButton).toHaveTextContent('🌙');

    // Click to toggle to dark mode
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    // Should now show sun emoji (dark mode active)
    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('☀️');
    });

    // Document should have dark class
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should toggle back to light mode when clicked again', async () => {
    const { user } = renderWithUser(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Click twice to go dark then back to light
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('☀️');
    });

    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('🌙');
    });

    // Document should not have dark class
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('should persist dark mode preference in localStorage', async () => {
    const { user } = renderWithUser(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Toggle to dark mode
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    await waitFor(() => {
      expect(localStorage.getItem('darkMode')).toBe('true');
    });

    // Toggle back to light mode
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    await waitFor(() => {
      expect(localStorage.getItem('darkMode')).toBe('false');
    });
  });

  it('should restore dark mode from localStorage on mount', () => {
    // Set dark mode in localStorage before rendering
    localStorage.setItem('darkMode', 'true');

    render(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Should show sun emoji (dark mode active)
    expect(toggleButton).toHaveTextContent('☀️');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should work when integrated in Navbar', async () => {
    const { user } = renderWithUser(<Navbar />);

    // Navbar has two dark mode toggle buttons (desktop and mobile)
    // Get all toggle buttons and use the first one (desktop version)
    const toggleButtons = screen.getAllByRole('button', { name: /toggle dark mode/i });
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);

    const toggleButton = toggleButtons[0]; // Use the first (desktop) toggle

    // Initially should show moon (light mode)
    expect(toggleButton).toHaveTextContent('🌙');

    // Click to toggle to dark mode
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    // Should now show sun emoji (dark mode active)
    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('☀️');
    });

    // Document should have dark class
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should handle rapid clicking without issues', async () => {
    const { user } = renderWithUser(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Rapidly click the toggle multiple times
    for (let i = 0; i < 5; i++) {
      await safeUserInteraction(async () => {
        await user.click(toggleButton);
      });
    }

    // Should end up in dark mode (odd number of clicks)
    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('☀️');
    });
    expect(document.documentElement).toHaveClass('dark');
  });

  it('should have proper accessibility attributes', () => {
    render(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    expect(toggleButton).toHaveAttribute('aria-label', 'Toggle dark mode');
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage to throw an error
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error('localStorage error');
    });

    const { user } = renderWithUser(<DarkModeToggle />);

    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });

    // Should not crash when localStorage fails
    await safeUserInteraction(async () => {
      await user.click(toggleButton);
    });

    // Should still toggle visually
    await waitFor(() => {
      expect(toggleButton).toHaveTextContent('☀️');
    });

    // Restore original localStorage
    localStorage.setItem = originalSetItem;
  });

  it('should handle missing localStorage gracefully', () => {
    // Mock localStorage to be undefined
    const originalLocalStorage = window.localStorage;

    // Remove localStorage temporarily
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // Should not crash when localStorage is undefined
    expect(() => {
      render(<DarkModeToggle />);
    }).not.toThrow();

    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });
});
