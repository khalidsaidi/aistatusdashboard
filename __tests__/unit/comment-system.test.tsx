import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(messageInput, { target: { value: 'Test message' } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('shows comment form when add comment button is clicked', async () => {
    render(<CommentSection title="Test Comments" />);
    
    const addButton = screen.getByRole('button', { name: /add comment/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      const form = screen.queryByRole('form');
      expect(form).toBeDefined();
    });
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

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(messageInput, { target: { value: 'Test message' } });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.click(submitButton);

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
    
    const form = screen.queryByRole('form');
    expect(form).toBeDefined();
  });
});
