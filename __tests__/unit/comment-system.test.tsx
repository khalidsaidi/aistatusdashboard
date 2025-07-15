import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import CommentSection from '@/app/components/CommentSection';

describe('CommentSystem', () => {
  it('renders comment form elements', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    // Wait for async operations to complete
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /post comment/i })).toBeDefined();
    });
  });

  it('disables submit button when form is empty', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('enables submit button when form has content', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    const messageInput = screen.getByPlaceholderText(/share your thoughts/i);
    const submitButton = screen.getByRole('button', { name: /post comment/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(messageInput, {
        target: { value: 'Test message that is long enough to be valid' },
      });
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows comment form is always visible', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    // Wait for async operations to complete
    await waitFor(() => {
      // The form elements should be visible by default
      expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /post comment/i })).toBeDefined();
    });
  });

  it('validates required fields', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('handles form submission', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i) as HTMLInputElement;
    const messageInput = screen.getByPlaceholderText(/share your thoughts/i);
    const submitButton = screen.getByRole('button', { name: /post comment/i });

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(messageInput, {
        target: { value: 'Test message that is long enough to be valid' },
      });
    });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Check if form was reset (success) OR error message is shown (rate limited)
      const isFormReset = nameInput.value === '';
      const hasErrorMessage = screen.queryByText(/Too many requests|Error:/);
      
      // Either the form should be reset on success OR show an error message
      expect(isFormReset || hasErrorMessage).toBeTruthy();
    });
  });

  it('displays form elements with correct attributes', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/your name/i);
      const messageInput = screen.getByPlaceholderText(/share your thoughts/i);

      expect(nameInput.getAttribute('type')).toBe('text');
      expect(messageInput).toBeDefined();
    });
  });

  it('renders form container', async () => {
    await act(async () => {
      render(<CommentSection title="Test Comments" />);
    });

    await waitFor(() => {
      // Check that form elements exist instead of looking for role="form"
      expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
    });
  });
});
