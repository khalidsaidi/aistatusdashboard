import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import '@testing-library/jest-dom';
import CommentSection from '@/app/components/CommentSection';

// Mock fetch for API calls
(global as any).fetch = jest.fn();

describe('Comment System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ((global as any).fetch as jest.Mock).mockClear();
  });

  describe('Comment Form', () => {
    it('should render comment form with all required fields', () => {
      render(<CommentSection title="Test Comments" />);
      
      expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /post comment/i })).toBeInTheDocument();
    });

    it('should show form validation errors', async () => {
      render(<CommentSection title="Test Comments" />);
      
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      expect(submitButton).toBeDisabled();
    });

    it('should fail to submit comment due to API error', async () => {
      ((global as any).fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      render(<CommentSection title="Test Comments" />);
      
      const nameInput = screen.getByPlaceholderText(/your name/i);
      const messageInput = screen.getByPlaceholderText(/share your thoughts/i);
      const submitButton = screen.getByRole('button', { name: /post comment/i });
      
      fireEvent.change(nameInput, { target: { value: 'Test User' } });
      fireEvent.change(messageInput, { target: { value: 'This is a test comment' } });
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/failed to post comment/i)).toBeInTheDocument();
      });
    });
  });
});
