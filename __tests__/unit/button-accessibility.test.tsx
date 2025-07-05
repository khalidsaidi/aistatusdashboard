import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import '@testing-library/jest-dom';
import DashboardTabs from '@/app/components/DashboardTabs';
import APIDemo from '@/app/components/APIDemo';
import CommentSection from '@/app/components/CommentSection';

describe('Button Accessibility and Styling', () => {
  const mockStatuses = [
    {
      id: 'openai',
      name: 'OpenAI',
      status: 'operational' as const,
      responseTime: 150,
      lastChecked: new Date().toISOString(),
      statusPageUrl: 'https://status.openai.com'
    }
  ];

  describe('Minimum Touch Target Size', () => {
    it('should have buttons with minimum 44px touch targets in DashboardTabs', () => {
      render(<DashboardTabs statuses={mockStatuses} />);
      
      // Tab buttons should meet minimum size requirements
      const tabButtons = screen.getAllByRole('button');
      tabButtons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        const minWidth = parseInt(styles.minWidth) || parseInt(styles.width);
        
        expect(minHeight).toBeGreaterThanOrEqual(44);
        expect(minWidth).toBeGreaterThanOrEqual(44);
      });
    });

    it('should have buttons with minimum touch targets in APIDemo', () => {
      render(<APIDemo />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        const minWidth = parseInt(styles.minWidth) || parseInt(styles.width);
        
        expect(minHeight).toBeGreaterThanOrEqual(44);
        expect(minWidth).toBeGreaterThanOrEqual(44);
      });
    });

    it('should have buttons with minimum touch targets in CommentSection', () => {
      render(<CommentSection title="Test Comments" />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const minHeight = parseInt(styles.minHeight) || parseInt(styles.height);
        const minWidth = parseInt(styles.minWidth) || parseInt(styles.width);
        
        expect(minHeight).toBeGreaterThanOrEqual(44);
        expect(minWidth).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Button Accessibility', () => {
    it('should have proper ARIA labels for icon-only buttons', () => {
      render(<DashboardTabs statuses={mockStatuses} />);
      
      // Search for buttons that might be icon-only
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const hasText = button.textContent && button.textContent.trim().length > 0;
        const hasAriaLabel = button.getAttribute('aria-label');
        const hasAriaLabelledBy = button.getAttribute('aria-labelledby');
        
        // Icon-only buttons should have aria-label or aria-labelledby
        if (!hasText) {
          expect(hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
        }
      });
    });

    it('should have consistent focus indicators', () => {
      render(<DashboardTabs statuses={mockStatuses} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Focus the button
        button.focus();
        
        const styles = window.getComputedStyle(button);
        // Should have visible focus indicator (outline or ring)
        const hasOutline = styles.outline !== 'none' && styles.outline !== '0px';
        const hasRing = styles.boxShadow.includes('ring') || styles.boxShadow.includes('focus');
        
        expect(hasOutline || hasRing).toBeTruthy();
      });
    });
  });

  describe('Button State Management', () => {
    it('should properly handle disabled states', () => {
      render(<CommentSection title="Test Comments" />);
      
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      
      // Button should be disabled initially (empty form)
      expect(submitButton).toBeDisabled();
      
      // Button should have proper disabled styling
      const styles = window.getComputedStyle(submitButton);
      expect(styles.cursor).toBe('not-allowed');
    });

    it('should have consistent button styling across components', () => {
      const { rerender } = render(<DashboardTabs statuses={mockStatuses} />);
      
      const dashboardButtons = screen.getAllByRole('button');
      const dashboardStyles = dashboardButtons.map(btn => ({
        borderRadius: window.getComputedStyle(btn).borderRadius,
        padding: window.getComputedStyle(btn).padding,
        fontWeight: window.getComputedStyle(btn).fontWeight
      }));
      
      rerender(<APIDemo />);
      const apiButtons = screen.getAllByRole('button');
      const apiStyles = apiButtons.map(btn => ({
        borderRadius: window.getComputedStyle(btn).borderRadius,
        padding: window.getComputedStyle(btn).padding,
        fontWeight: window.getComputedStyle(btn).fontWeight
      }));
      
      // Primary buttons should have consistent styling
      const primaryDashboard = dashboardStyles.filter(s => s.fontWeight === '500' || s.fontWeight === 'medium');
      const primaryApi = apiStyles.filter(s => s.fontWeight === '500' || s.fontWeight === 'medium');
      
      if (primaryDashboard.length > 0 && primaryApi.length > 0) {
        expect(primaryDashboard[0].borderRadius).toBe(primaryApi[0].borderRadius);
      }
    });
  });

  describe('Button Loading States', () => {
    it('should show loading states properly', () => {
      render(<APIDemo />);
      
      // Find test buttons
      const testButtons = screen.getAllByText(/test/i).filter(el => el.tagName === 'BUTTON');
      
      testButtons.forEach(button => {
        // Button should be clickable when not loading
        expect(button).not.toBeDisabled();
        
        // Should have proper loading state handling
        expect(button.textContent).not.toContain('undefined');
      });
    });
  });
}); 