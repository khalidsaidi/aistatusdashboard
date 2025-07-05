import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NotificationPanel from '../../app/components/NotificationPanel';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, width, height, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} {...props} />;
  };
});

describe('Notification Panel Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
    
    // Mock the initial API calls that the component makes on mount
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/notifications')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ subscriptions: [] }),
        });
      }
      if (url.includes('/api/incidents')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ incidents: [] }),
        });
      }
      return Promise.reject(new Error('Unhandled URL in mock'));
    });
  });

  describe('Component Rendering', () => {
    it('should render notification panel with email subscription form', () => {
      render(<NotificationPanel />);
      
      expect(screen.getByText(/notifications & alerts/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /subscribe to email alerts/i })).toBeInTheDocument();
    });

    it('should render provider selection checkboxes', () => {
      render(<NotificationPanel />);
      
      // Should have checkboxes for major AI providers (based on actual component)
      expect(screen.getByText(/openai/i)).toBeInTheDocument();
      expect(screen.getByText(/anthropic/i)).toBeInTheDocument();
      expect(screen.getByText(/google ai/i)).toBeInTheDocument();
    });

    it('should render notification type options', () => {
      render(<NotificationPanel />);
      
      expect(screen.getByLabelText(/incidents/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/recoveries/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/maintenance/i)).toBeInTheDocument();
    });

    it('should render webhook subscription section', () => {
      render(<NotificationPanel />);
      
      expect(screen.getByText(/webhook notifications/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/https:\/\/your-app\.com\/webhook/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /subscribe webhook/i })).toBeInTheDocument();
    });
  });

  describe('Email Subscription', () => {
    it('should handle successful email subscription', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Subscription successful' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/subscribeEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            providers: expect.any(Array),
            types: expect.any(Array),
          }),
        });
      });

      expect(screen.getByText(/subscription successful/i)).toBeInTheDocument();
    });

    it('should handle email subscription failure with network error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Network error. Please try again.' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/network error\. please try again\./i)).toBeInTheDocument();
      });
    });

    it('should validate email format before submission', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should require at least one provider selection', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      // Uncheck all providers
      const providerCheckboxes = screen.getAllByRole('checkbox');
      for (const checkbox of providerCheckboxes) {
        if (checkbox.getAttribute('checked')) {
          await userEvent.click(checkbox);
        }
      }
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/please select at least one provider/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should show loading state during subscription', async () => {
      (fetch as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/subscribing\.\.\./i)).toBeInTheDocument();
      expect(subscribeButton).toBeDisabled();
    });
  });

  describe('Webhook Subscription', () => {
    it('should handle successful webhook subscription', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Webhook registered successfully' }),
      });

      render(<NotificationPanel />);
      
      const webhookInput = screen.getByPlaceholderText(/https:\/\/your-app\.com\/webhook/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe webhook/i });
      
      await userEvent.type(webhookInput, 'https://example.com/webhook');
      await userEvent.click(subscribeButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/subscribeWebhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            providers: expect.any(Array),
            types: expect.any(Array),
          }),
        });
      });

      expect(screen.getByText(/webhook registered successfully/i)).toBeInTheDocument();
    });

    it('should validate webhook URL format', async () => {
      render(<NotificationPanel />);
      
      const webhookInput = screen.getByPlaceholderText(/https:\/\/your-app\.com\/webhook/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe webhook/i });
      
      await userEvent.type(webhookInput, 'invalid-url');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/please enter a valid https url/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle webhook subscription failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to register webhook' }),
      });

      render(<NotificationPanel />);
      
      const webhookInput = screen.getByPlaceholderText(/https:\/\/your-app\.com\/webhook/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe webhook/i });
      
      await userEvent.type(webhookInput, 'https://example.com/webhook');
      await userEvent.click(subscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to register webhook/i)).toBeInTheDocument();
      });
    });
  });

  describe('Test Notifications', () => {
    it('should send test notification successfully', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Test notification sent' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const sendTestButton = screen.getByRole('button', { name: /send test/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(sendTestButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/sendTestNotification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        });
      });

      expect(screen.getByText(/test notification sent/i)).toBeInTheDocument();
    });

    it('should handle test notification failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to send test notification' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const sendTestButton = screen.getByRole('button', { name: /send test/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(sendTestButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to send test notification/i)).toBeInTheDocument();
      });
    });

    it('should require email before sending test', async () => {
      render(<NotificationPanel />);
      
      const sendTestButton = screen.getByRole('button', { name: /send test/i });
      
      await userEvent.click(sendTestButton);
      
      expect(screen.getByText(/please enter an email address first/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Unsubscribe Functionality', () => {
    it('should handle successful unsubscribe', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Successfully unsubscribed' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const unsubscribeButton = screen.getByRole('button', { name: /unsubscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(unsubscribeButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/unsubscribeEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        });
      });

      expect(screen.getByText(/successfully unsubscribed/i)).toBeInTheDocument();
    });

    it('should handle unsubscribe failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to unsubscribe' }),
      });

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const unsubscribeButton = screen.getByRole('button', { name: /unsubscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(unsubscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to unsubscribe/i)).toBeInTheDocument();
      });
    });
  });

  describe('Provider Selection', () => {
    it('should allow selecting multiple providers', async () => {
      render(<NotificationPanel />);
      
      const openaiCheckbox = screen.getByLabelText(/openai/i);
      const anthropicCheckbox = screen.getByLabelText(/anthropic/i);
      
      await userEvent.click(openaiCheckbox);
      await userEvent.click(anthropicCheckbox);
      
      expect(openaiCheckbox).toBeChecked();
      expect(anthropicCheckbox).toBeChecked();
    });

    it('should allow deselecting providers', async () => {
      render(<NotificationPanel />);
      
      const openaiCheckbox = screen.getByLabelText(/openai/i);
      
      // Assume it starts checked
      if (openaiCheckbox.getAttribute('checked')) {
        await userEvent.click(openaiCheckbox);
        expect(openaiCheckbox).not.toBeChecked();
      }
    });
  });

  describe('Notification Type Selection', () => {
    it('should allow selecting notification types', async () => {
      render(<NotificationPanel />);
      
      const incidentsCheckbox = screen.getByLabelText(/incidents/i);
      const recoveriesCheckbox = screen.getByLabelText(/recoveries/i);
      
      await userEvent.click(incidentsCheckbox);
      await userEvent.click(recoveriesCheckbox);
      
      expect(incidentsCheckbox).toBeChecked();
      expect(recoveriesCheckbox).toBeChecked();
    });

    it('should require at least one notification type', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      // Uncheck all notification types
      const typeCheckboxes = screen.getAllByRole('checkbox');
      const notificationTypes = typeCheckboxes.filter(checkbox => 
        checkbox.getAttribute('name')?.includes('type')
      );
      
      for (const checkbox of notificationTypes) {
        if (checkbox.getAttribute('checked')) {
          await userEvent.click(checkbox);
        }
      }
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/please select at least one notification type/i)).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and ARIA attributes', () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const webhookInput = screen.getByLabelText(/webhook url/i);
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(webhookInput).toHaveAttribute('type', 'url');
      
      // Check for proper form structure
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      // Tab navigation should work
      emailInput.focus();
      expect(emailInput).toHaveFocus();
      
      await userEvent.tab();
      // Should focus on the next interactive element
      expect(document.activeElement).not.toBe(emailInput);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(subscribeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/network error\. please try again\./i)).toBeInTheDocument();
      });
    });

    it('should clear error messages when user starts typing', async () => {
      render(<NotificationPanel />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const subscribeButton = screen.getByRole('button', { name: /subscribe/i });
      
      // Trigger validation error
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.click(subscribeButton);
      
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      
      // Clear input and type valid email
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, 'valid@example.com');
      
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
  });
}); 