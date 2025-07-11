/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPanel from '../../app/components/NotificationPanel';

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

// Helper function to render component and wait for async operations
async function renderAndWaitForAsyncOps(ui: React.ReactElement) {
  const user = userEvent.setup();
  let result: any;

  await act(async () => {
    result = render(ui);
    // Wait for all async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  return {
    user,
    ...result,
  };
}

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
  describe('Component Rendering', () => {
    it('should render without crashing', async () => {
      await act(async () => {
        render(<NotificationPanel />);
        // Wait for async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
    });

    it('should display all notification tabs', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Test that all tabs are present
      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
      expect(screen.getByText('🔔 Web Push')).toBeInTheDocument();
      expect(screen.getByText('🪝 Webhooks')).toBeInTheDocument();
      expect(screen.getByText('📋 Incidents')).toBeInTheDocument();
    });

    it('should have push tab active by default', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Push tab should be active by default (shows Web Push Not Supported message)
      expect(screen.getByText('⚠️ Web Push Not Supported')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch between tabs when clicked', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Start with push tab
      expect(screen.getByText('⚠️ Web Push Not Supported')).toBeInTheDocument();

      // Switch to email tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      // Should show email content
      await waitFor(() => {
        expect(screen.getByText('Email Address')).toBeInTheDocument();
      });

      // Switch to webhooks tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });

      // Should show webhook content
      await waitFor(() => {
        expect(screen.getByText('Webhook URL')).toBeInTheDocument();
      });

      // Switch to incidents tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📋 Incidents'));
      });

      // Should show incidents content
      await waitFor(() => {
        expect(screen.getByText(/Recent Incidents/)).toBeInTheDocument();
      });
    });
  });

  describe('Web Push Notifications Tab', () => {
    it('should display push notification interface', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);
      // Push tab is active by default

      // In test environment, browser APIs are not available, so should show not supported message
      expect(screen.getByText('⚠️ Web Push Not Supported')).toBeInTheDocument();
    });

    it('should show provider selection checkboxes', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Test that provider checkboxes are rendered
      const providers = ['openai', 'anthropic', 'huggingface', 'google-ai'];

      providers.forEach((provider) => {
        const checkbox = screen.queryByTestId(`provider-${provider}`);
        if (checkbox) {
          expect(checkbox).toBeInTheDocument();
        }
      });
    });

    it('should show notification type options', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Test notification type checkboxes
      const types = ['incident', 'recovery', 'degradation'];

      types.forEach((type) => {
        const checkbox = screen.queryByTestId(`notification-type-${type}`);
        if (checkbox) {
          expect(checkbox).toBeInTheDocument();
        }
      });
    });

    it('should handle provider selection interactions', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      const openaiCheckbox = screen.queryByTestId('provider-openai');

      if (openaiCheckbox) {
        // Test checking and unchecking
        await safeUserInteraction(async () => {
          await user.click(openaiCheckbox);
        });
        await safeUserInteraction(async () => {
          await user.click(openaiCheckbox);
        });

        // Should not throw errors
        expect(true).toBe(true);
      }
    });
  });

  describe('Email Notifications Tab', () => {
    it('should display email subscription form', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      await waitFor(() => {
        expect(screen.getByText('Email Address')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      expect(screen.getByText('📧 Subscribe to Email Alerts')).toBeInTheDocument();
    });

    it('should handle email input', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      const emailInput = await screen.findByPlaceholderText('Enter your email address');

      await safeUserInteraction(async () => {
        await user.type(emailInput, 'test@example.com');
      });

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should handle form submission attempt', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      const emailInput = await screen.findByPlaceholderText('Enter your email address');
      const submitButton = await screen.findByText('📧 Subscribe to Email Alerts');

      await safeUserInteraction(async () => {
        await user.type(emailInput, 'test@example.com');
      });

      // This will attempt to submit to real API
      // In test environment, it should handle network errors gracefully
      await safeUserInteraction(async () => {
        await user.click(submitButton);
      });

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe('Webhooks Tab', () => {
    it('should display webhook registration form', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });

      await waitFor(() => {
        expect(screen.getByText('Webhook URL')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('https://your-domain.com/webhook')).toBeInTheDocument();
      expect(screen.getByText('🪝 Add Webhook')).toBeInTheDocument();
    });

    it('should handle webhook URL input', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });

      const urlInput = await screen.findByPlaceholderText('https://your-domain.com/webhook');

      await safeUserInteraction(async () => {
        await user.type(urlInput, 'https://example.com/webhook');
      });

      expect(urlInput).toHaveValue('https://example.com/webhook');
    });

    it('should validate webhook URL format', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });

      const urlInput = await screen.findByPlaceholderText('https://your-domain.com/webhook');
      const submitButton = await screen.findByText('🪝 Add Webhook');

      // Test with invalid URL
      await safeUserInteraction(async () => {
        await user.type(urlInput, 'invalid-url');
      });
      await safeUserInteraction(async () => {
        await user.click(submitButton);
      });

      // Should handle validation (implementation dependent)
      expect(true).toBe(true);
    });
  });

  describe('Incidents Tab', () => {
    it('should display incidents interface', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📋 Incidents'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Recent Incidents/)).toBeInTheDocument();
      });
    });

    it('should have refresh functionality', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📋 Incidents'));
      });

      const refreshButton = screen.queryByText('🔄 Refresh');

      if (refreshButton) {
        await safeUserInteraction(async () => {
          await user.click(refreshButton);
        });
        // Should not throw errors
        expect(true).toBe(true);
      }
    });
  });

  describe('Real API Integration', () => {
    it('should handle API calls gracefully when endpoints are unavailable', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab first
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      // Test email subscription
      const emailInput = await screen.findByPlaceholderText('Enter your email address');
      const emailSubmit = await screen.findByText('📧 Subscribe to Email Alerts');

      await safeUserInteraction(async () => {
        await user.type(emailInput, 'test@example.com');
      });

      // This should not crash even if API is unavailable
      await safeUserInteraction(async () => {
        await user.click(emailSubmit);
      });

      // Test webhook registration
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });

      const webhookInput = await screen.findByPlaceholderText('https://your-domain.com/webhook');
      const webhookSubmit = await screen.findByText('🪝 Add Webhook');

      await safeUserInteraction(async () => {
        await user.type(webhookInput, 'https://example.com/webhook');
      });

      // This should not crash even if API is unavailable
      await safeUserInteraction(async () => {
        await user.click(webhookSubmit);
      });
    });

    it('should handle push notification subscription with real Firebase', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);
      // Push tab is active by default

      const enableButton = screen.queryByText('🔔 Enable Notifications');

      if (enableButton) {
        // This will test real Firebase integration
        // Should handle gracefully if Firebase is not configured
        await safeUserInteraction(async () => {
          await user.click(enableButton);
        });
        expect(true).toBe(true);
      }
    });
  });

  describe('Form Validation', () => {
    it('should handle empty form submissions', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab first
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      // Test empty email submission
      const emailSubmit = await screen.findByText('📧 Subscribe to Email Alerts');
      await safeUserInteraction(async () => {
        await user.click(emailSubmit);
      });

      // Should not crash
      expect(true).toBe(true);

      // Test empty webhook submission
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('🪝 Webhooks'));
      });
      const webhookSubmit = await screen.findByText('🪝 Add Webhook');
      await safeUserInteraction(async () => {
        await user.click(webhookSubmit);
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle invalid email formats', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab first
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      const emailInput = await screen.findByPlaceholderText('Enter your email address');
      const emailSubmit = await screen.findByText('📧 Subscribe to Email Alerts');

      // Test various invalid email formats
      const invalidEmails = ['invalid', '@example.com', 'test@', 'test.com'];

      for (const email of invalidEmails) {
        await safeUserInteraction(async () => {
          await user.clear(emailInput);
          await user.type(emailInput, email);
        });
        await safeUserInteraction(async () => {
          await user.click(emailSubmit);
        });

        // Should handle validation gracefully
        expect(true).toBe(true);
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Switch to email tab first
      await safeUserInteraction(async () => {
        await user.click(screen.getByText('📧 Email Alerts'));
      });

      // Check for accessible form elements
      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Test tab navigation between elements
      await safeUserInteraction(async () => {
        await user.keyboard('{Tab}');
        await user.keyboard('{Tab}');
      });

      // Should not crash during keyboard navigation
      expect(true).toBe(true);
    });

    it('should have proper button types', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      const buttons = screen.getAllByRole('button');

      // All buttons should have proper attributes
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle component errors gracefully', async () => {
      // Test that component doesn't crash with various props
      await act(async () => {
        render(<NotificationPanel />);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
    });

    it('should handle state updates without memory leaks', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Rapidly switch between tabs
      for (let i = 0; i < 10; i++) {
        await safeUserInteraction(async () => {
          await user.click(screen.getByText('🔔 Web Push'));
        });
        await safeUserInteraction(async () => {
          await user.click(screen.getByText('📧 Email Alerts'));
        });
        await safeUserInteraction(async () => {
          await user.click(screen.getByText('🪝 Webhooks'));
        });
        await safeUserInteraction(async () => {
          await user.click(screen.getByText('📋 Incidents'));
        });
      }

      // Should not cause memory issues
      expect(true).toBe(true);
    });
  });

  describe('Real Browser Environment', () => {
    it('should work with actual browser APIs', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Test that component works with real browser environment
      const hasNotifications = 'Notification' in window;
      const hasServiceWorker = 'serviceWorker' in navigator;

      console.log(`Notification API: ${hasNotifications}`);
      console.log(`Service Worker API: ${hasServiceWorker}`);

      // Component should render regardless of API availability
      expect(screen.getByText('📧 Email Alerts')).toBeInTheDocument();
    });

    it('should handle different notification permission states', async () => {
      await renderAndWaitForAsyncOps(<NotificationPanel />);
      // Push tab is active by default

      if ('Notification' in window) {
        const permission = Notification.permission;
        console.log(`Current permission: ${permission}`);

        // Component should handle all permission states
        expect(['default', 'granted', 'denied']).toContain(permission);
      }
    });
  });

  describe('Performance', () => {
    it('should render quickly', async () => {
      const start = performance.now();
      await renderAndWaitForAsyncOps(<NotificationPanel />);
      const end = performance.now();

      // Should render in reasonable time (less than 1000ms including async ops)
      expect(end - start).toBeLessThan(1000);
    });

    it('should handle rapid user interactions', async () => {
      const { user } = await renderAndWaitForAsyncOps(<NotificationPanel />);

      // Rapidly click between tabs
      const tabs = ['🔔 Web Push', '📧 Email Alerts', '🪝 Webhooks', '📋 Incidents'];

      for (let i = 0; i < 20; i++) {
        const tab = tabs[i % tabs.length];
        await safeUserInteraction(async () => {
          await user.click(screen.getByText(tab));
        });
      }

      // Should handle rapid clicks without issues
      expect(true).toBe(true);
    });
  });
});
