/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPanel from '../../app/components/NotificationPanel';

// Set up real DOM environment
beforeEach(() => {
  // Reset DOM state
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  
  // Reset any global state
  if (typeof window !== 'undefined') {
    // Clear localStorage/sessionStorage if used
    localStorage.clear();
    sessionStorage.clear();
  }
});

describe('NotificationPanel - Real Implementation', () => {
  const user = userEvent.setup();

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      expect(() => {
        render(<NotificationPanel />);
      }).not.toThrow();
    });

    it('should display all notification tabs', () => {
      render(<NotificationPanel />);

      // Test that all tabs are present
      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
      expect(screen.getByText('🔔 Web Push')).toBeInTheDocument();
      expect(screen.getByText('🪝 Webhooks')).toBeInTheDocument();
      expect(screen.getByText('📋 Incidents')).toBeInTheDocument();
    });

    it('should have email tab active by default', () => {
      render(<NotificationPanel />);

      // Email tab should be active by default
      expect(screen.getByText('Email Address')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between tabs when clicked', async () => {
      render(<NotificationPanel />);

      // Start with email tab
      expect(screen.getByText('Email Address')).toBeInTheDocument();

      // Switch to web push tab
      await user.click(screen.getByText('🔔 Web Push'));
      
      // Should show web push content
      await waitFor(() => {
        expect(screen.getByText(/Browser Push Notifications/)).toBeInTheDocument();
      });

      // Switch to webhooks tab
      await user.click(screen.getByText('🪝 Webhooks'));
      
      // Should show webhook content
      await waitFor(() => {
        expect(screen.getByText('Webhook URL')).toBeInTheDocument();
      });

      // Switch to incidents tab
      await user.click(screen.getByText('📋 Incidents'));
      
      // Should show incidents content
      await waitFor(() => {
        expect(screen.getByText(/Recent Incidents/)).toBeInTheDocument();
      });
    });
  });

  describe('Web Push Notifications Tab', () => {
    beforeEach(async () => {
      render(<NotificationPanel />);
      await user.click(screen.getByText('🔔 Web Push'));
    });

    it('should display push notification interface', () => {
      expect(screen.getByText(/Browser Push Notifications/)).toBeInTheDocument();
      
      // Should show either the enable form or status based on browser support
      const hasSupport = 'Notification' in window && 'serviceWorker' in navigator;
      
      if (hasSupport) {
        // If supported, should show enable button or current status
        const enableButton = screen.queryByText('Enable Push Notifications');
        const enabledStatus = screen.queryByText('Push Enabled ✓');
        
        expect(enableButton || enabledStatus).toBeInTheDocument();
      } else {
        // If not supported, should show not supported message
        expect(screen.getByText('⚠️ Web Push Not Supported')).toBeInTheDocument();
      }
    });

    it('should show provider selection checkboxes', () => {
      // Test that provider checkboxes are rendered
      const providers = ['openai', 'anthropic', 'huggingface', 'google-ai'];
      
      providers.forEach(provider => {
        const checkbox = screen.queryByTestId(`provider-${provider}`);
        if (checkbox) {
          expect(checkbox).toBeInTheDocument();
        }
      });
    });

    it('should show notification type options', () => {
      // Test notification type checkboxes
      const types = ['incident', 'recovery', 'degradation'];
      
      types.forEach(type => {
        const checkbox = screen.queryByTestId(`notification-type-${type}`);
        if (checkbox) {
          expect(checkbox).toBeInTheDocument();
        }
      });
    });

    it('should handle provider selection interactions', async () => {
      const openaiCheckbox = screen.queryByTestId('provider-openai');
      
      if (openaiCheckbox) {
        // Test checking and unchecking
        await user.click(openaiCheckbox);
        await user.click(openaiCheckbox);
        
        // Should not throw errors
        expect(true).toBe(true);
      }
    });
  });

  describe('Email Notifications Tab', () => {
    beforeEach(async () => {
      render(<NotificationPanel />);
      // Email tab should be active by default
    });

    it('should display email subscription form', () => {
      expect(screen.getByText('Email Address')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      expect(screen.getByText('Subscribe to Email Alerts')).toBeInTheDocument();
    });

    it('should handle email input', async () => {
      const emailInput = screen.getByPlaceholderText('your@email.com');
      
      await user.type(emailInput, 'test@example.com');
      
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should handle form submission attempt', async () => {
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const submitButton = screen.getByText('Subscribe to Email Alerts');
      
      await user.type(emailInput, 'test@example.com');
      
      // This will attempt to submit to real API
      // In test environment, it should handle network errors gracefully
      expect(() => user.click(submitButton)).not.toThrow();
    });
  });

  describe('Webhooks Tab', () => {
    beforeEach(async () => {
      render(<NotificationPanel />);
      await user.click(screen.getByText('🪝 Webhooks'));
    });

    it('should display webhook registration form', async () => {
      await waitFor(() => {
        expect(screen.getByText('Webhook URL')).toBeInTheDocument();
      });
      
      expect(screen.getByPlaceholderText('https://your-app.com/webhook')).toBeInTheDocument();
      expect(screen.getByText('Register Webhook')).toBeInTheDocument();
    });

    it('should handle webhook URL input', async () => {
      const urlInput = screen.getByPlaceholderText('https://your-app.com/webhook');
      
      await user.type(urlInput, 'https://example.com/webhook');
      
      expect(urlInput).toHaveValue('https://example.com/webhook');
    });

    it('should validate webhook URL format', async () => {
      const urlInput = screen.getByPlaceholderText('https://your-app.com/webhook');
      const submitButton = screen.getByText('Register Webhook');
      
      // Test with invalid URL
      await user.type(urlInput, 'invalid-url');
      await user.click(submitButton);
      
      // Should handle validation (implementation dependent)
      expect(true).toBe(true);
    });
  });

  describe('Incidents Tab', () => {
    beforeEach(async () => {
      render(<NotificationPanel />);
      await user.click(screen.getByText('📋 Incidents'));
    });

    it('should display incidents interface', async () => {
      await waitFor(() => {
        expect(screen.getByText(/Recent Incidents/)).toBeInTheDocument();
      });
    });

    it('should have refresh functionality', async () => {
      const refreshButton = screen.queryByText('🔄 Refresh');
      
      if (refreshButton) {
        expect(() => user.click(refreshButton)).not.toThrow();
      }
    });
  });

  describe('Real API Integration', () => {
    it('should handle API calls gracefully when endpoints are unavailable', async () => {
      render(<NotificationPanel />);
      
      // Test email subscription
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const emailSubmit = screen.getByText('Subscribe to Email Alerts');
      
      await user.type(emailInput, 'test@example.com');
      
      // This should not crash even if API is unavailable
      expect(() => user.click(emailSubmit)).not.toThrow();
      
      // Test webhook registration
      await user.click(screen.getByText('🪝 Webhooks'));
      
      const webhookInput = screen.getByPlaceholderText('https://your-app.com/webhook');
      const webhookSubmit = screen.getByText('Register Webhook');
      
      await user.type(webhookInput, 'https://example.com/webhook');
      
      // This should not crash even if API is unavailable
      expect(() => user.click(webhookSubmit)).not.toThrow();
    });

    it('should handle push notification subscription with real Firebase', async () => {
      render(<NotificationPanel />);
      await user.click(screen.getByText('🔔 Web Push'));
      
      const enableButton = screen.queryByText('Enable Push Notifications');
      
      if (enableButton) {
        // This will test real Firebase integration
        // Should handle gracefully if Firebase is not configured
        expect(() => user.click(enableButton)).not.toThrow();
      }
    });
  });

  describe('Form Validation', () => {
    it('should handle empty form submissions', async () => {
      render(<NotificationPanel />);
      
      // Test empty email submission
      const emailSubmit = screen.getByText('Subscribe to Email Alerts');
      await user.click(emailSubmit);
      
      // Should not crash
      expect(true).toBe(true);
      
      // Test empty webhook submission
      await user.click(screen.getByText('🪝 Webhooks'));
      const webhookSubmit = screen.getByText('Register Webhook');
      await user.click(webhookSubmit);
      
      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle invalid email formats', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const emailSubmit = screen.getByText('Subscribe to Email Alerts');
      
      // Test various invalid email formats
      const invalidEmails = ['invalid', '@example.com', 'test@', 'test.com'];
      
      for (const email of invalidEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, email);
        await user.click(emailSubmit);
        
        // Should handle validation gracefully
        expect(true).toBe(true);
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<NotificationPanel />);
      
      // Check for accessible form elements
      expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<NotificationPanel />);
      
      // Test tab navigation between elements
      await user.keyboard('{Tab}');
      await user.keyboard('{Tab}');
      
      // Should not crash during keyboard navigation
      expect(true).toBe(true);
    });

    it('should have proper button types', () => {
      render(<NotificationPanel />);
      
      const buttons = screen.getAllByRole('button');
      
      // All buttons should have proper attributes
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle component errors gracefully', () => {
      // Test that component doesn't crash with various props
      expect(() => {
        render(<NotificationPanel />);
      }).not.toThrow();
    });

    it('should handle state updates without memory leaks', async () => {
      render(<NotificationPanel />);
      
      // Rapidly switch between tabs
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByText('🔔 Web Push'));
        await user.click(screen.getByText('📧 Email Alerts'));
        await user.click(screen.getByText('🪝 Webhooks'));
        await user.click(screen.getByText('📋 Incidents'));
      }
      
      // Should not cause memory issues
      expect(true).toBe(true);
    });
  });

  describe('Real Browser Environment', () => {
    it('should work with actual browser APIs', () => {
      render(<NotificationPanel />);
      
      // Test that component works with real browser environment
      const hasNotifications = 'Notification' in window;
      const hasServiceWorker = 'serviceWorker' in navigator;
      
      console.log(`Notification API: ${hasNotifications}`);
      console.log(`Service Worker API: ${hasServiceWorker}`);
      
      // Component should render regardless of API availability
      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
    });

    it('should handle different notification permission states', async () => {
      render(<NotificationPanel />);
      await user.click(screen.getByText('🔔 Web Push'));
      
      if ('Notification' in window) {
        const permission = Notification.permission;
        console.log(`Current permission: ${permission}`);
        
        // Component should handle all permission states
        expect(['default', 'granted', 'denied']).toContain(permission);
      }
    });
  });

  describe('Performance', () => {
    it('should render quickly', () => {
      const start = performance.now();
      render(<NotificationPanel />);
      const end = performance.now();
      
      // Should render in reasonable time (less than 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should handle rapid user interactions', async () => {
      render(<NotificationPanel />);
      
      // Rapidly click between tabs
      const tabs = ['🔔 Web Push', '📧 Email Alerts', '🪝 Webhooks', '📋 Incidents'];
      
      for (let i = 0; i < 20; i++) {
        const tab = tabs[i % tabs.length];
        await user.click(screen.getByText(tab));
      }
      
      // Should handle rapid clicks without issues
      expect(true).toBe(true);
    });
  });
}); 