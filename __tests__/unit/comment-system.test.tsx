import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import CommentSection from '@/app/components/CommentSection';

describe('CommentSystem', () => {
  it('renders comment form elements', () => {
    render(<CommentSection title="Test Comments" />);

    expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /post comment/i })).toBeDefined();
  });

  it('disables submit button when form is empty', () => {
    render(<CommentSection title="Test Comments" />);

    const submitButton = screen.getByRole('button', { name: /post comment/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when form has content', async () => {
    render(<CommentSection title="Test Comments" />);

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

  it('shows comment form is always visible', () => {
    render(<CommentSection title="Test Comments" />);

    // The form elements should be visible by default
    expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /post comment/i })).toBeDefined();
  });

  it('validates required fields', () => {
    render(<CommentSection title="Test Comments" />);

    const submitButton = screen.getByRole('button', { name: /post comment/i });
    expect(submitButton).toBeDisabled();
  });

  it('handles form submission', async () => {
    render(<CommentSection title="Test Comments" />);

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
      // Form should be reset or hidden after submission
      expect(nameInput.value).toBe('');
    });
  });

  it('displays form elements with correct attributes', () => {
    render(<CommentSection title="Test Comments" />);

    const nameInput = screen.getByPlaceholderText(/your name/i);
    const messageInput = screen.getByPlaceholderText(/share your thoughts/i);

    expect(nameInput.getAttribute('type')).toBe('text');
    expect(messageInput).toBeDefined();
  });

  it('renders form container', () => {
    render(<CommentSection title="Test Comments" />);

    // Check that form elements exist instead of looking for role="form"
    expect(screen.getByPlaceholderText(/your name/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeDefined();
  });
});
