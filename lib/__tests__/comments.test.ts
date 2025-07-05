import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  createComment, 
  getComments, 
  getComment,
  updateCommentStatus,
  likeComment,
  reportComment,
  addReply,
  deleteComment,
  getCommentStats,
  _testOnlyComments
} from '../comments';
import { CommentCreate, CommentFilter } from '../types';

// Mock the logger
jest.mock('../logger', () => ({
  log: jest.fn()
}));

describe('Comments System', () => {
  beforeEach(() => {
    // Clear the comments Map before each test
    _testOnlyComments.clear();
  });

  describe('createComment', () => {
    it('should create a valid comment', () => {
      const commentData: CommentCreate = {
        author: 'Test User',
        email: 'test@example.com',
        message: 'This is a test comment with enough characters',
        type: 'general'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(true);
      expect(result.comment).toBeDefined();
      expect(result.comment?.author).toBe('Test User');
      expect(result.comment?.message).toBe('This is a test comment with enough characters');
      expect(result.comment?.type).toBe('general');
      expect(result.comment?.status).toBe('approved');
      expect(result.comment?.likes).toBe(0);
      expect(result.comment?.reported).toBe(false);
    });

    it('should validate author name length', () => {
      const commentData: CommentCreate = {
        author: 'A', // Too short
        message: 'This is a valid message with enough characters',
        type: 'general'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Author name must be at least 2 characters');
    });

    it('should validate message length', () => {
      const commentData: CommentCreate = {
        author: 'Test User',
        message: 'Short', // Too short
        type: 'general'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Message must be at least 10 characters');
    });

    it('should validate email format', () => {
      const commentData: CommentCreate = {
        author: 'Test User',
        email: 'invalid-email',
        message: 'This is a valid message with enough characters',
        type: 'general'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid email address');
    });

    it('should handle inappropriate content', () => {
      const commentData: CommentCreate = {
        author: 'Test User',
        message: 'This message contains spam content which should be flagged',
        type: 'general'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(true);
      expect(result.comment?.status).toBe('pending'); // Should be pending due to spam
    });

    it('should support different comment types', () => {
      const types: Array<'general' | 'feedback' | 'issue'> = ['general', 'feedback', 'issue'];

      types.forEach(type => {
        const commentData: CommentCreate = {
          author: 'Test User',
          message: `This is a ${type} comment with enough characters`,
          type
        };

        const result = createComment(commentData);

        expect(result.success).toBe(true);
        expect(result.comment?.type).toBe(type);
      });
    });

    it('should support provider-specific comments', () => {
      const commentData: CommentCreate = {
        author: 'Test User',
        message: 'This is a comment about OpenAI specifically',
        type: 'provider',
        providerId: 'openai'
      };

      const result = createComment(commentData);

      expect(result.success).toBe(true);
      expect(result.comment?.providerId).toBe('openai');
    });
  });

  describe('getComments', () => {
    beforeEach(() => {
      // Create some test comments
      createComment({
        author: 'User 1',
        message: 'General comment about the dashboard',
        type: 'general'
      });

      createComment({
        author: 'User 2',
        message: 'Feedback about the interface',
        type: 'feedback'
      });

      createComment({
        author: 'User 3',
        message: 'Issue with OpenAI status',
        type: 'issue',
        providerId: 'openai'
      });
    });

    it('should return all comments by default', () => {
      const comments = getComments();
      expect(comments).toHaveLength(3);
    });

    it('should filter by type', () => {
      const feedbackComments = getComments({ type: 'feedback' });
      expect(feedbackComments).toHaveLength(1);
      expect(feedbackComments[0].type).toBe('feedback');
    });

    it('should filter by provider', () => {
      const openaiComments = getComments({ providerId: 'openai' });
      expect(openaiComments).toHaveLength(1);
      expect(openaiComments[0].providerId).toBe('openai');
    });

    it('should limit results', () => {
      const limitedComments = getComments({ limit: 2 });
      expect(limitedComments).toHaveLength(2);
    });

    it('should support pagination', () => {
      const firstPage = getComments({ limit: 2, offset: 0 });
      const secondPage = getComments({ limit: 2, offset: 2 });

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1); // Only 3 total comments
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it('should sort by creation date (newest first)', () => {
      const comments = getComments();
      
      // Comments should be sorted newest first
      for (let i = 1; i < comments.length; i++) {
        const prevDate = new Date(comments[i - 1].createdAt);
        const currentDate = new Date(comments[i].createdAt);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currentDate.getTime());
      }
    });
  });

  describe('comment actions', () => {
    let commentId: string;

    beforeEach(() => {
      const result = createComment({
        author: 'Test User',
        message: 'This is a test comment for actions',
        type: 'general'
      });
      commentId = result.comment!.id;
    });

    it('should like a comment', () => {
      const success = likeComment(commentId);
      expect(success).toBe(true);

      const comment = getComment(commentId);
      expect(comment?.likes).toBe(1);
    });

    it('should report a comment', () => {
      const success = reportComment(commentId);
      expect(success).toBe(true);

      const comment = getComment(commentId);
      expect(comment?.reported).toBe(true);
      expect(comment?.status).toBe('pending'); // Should be auto-moderated
    });

    it('should update comment status', () => {
      const success = updateCommentStatus(commentId, 'hidden');
      expect(success).toBe(true);

      const comment = getComment(commentId);
      expect(comment?.status).toBe('hidden');
      expect(comment?.updatedAt).toBeDefined();
    });

    it('should delete (hide) a comment', () => {
      const success = deleteComment(commentId);
      expect(success).toBe(true);

      const comment = getComment(commentId);
      expect(comment?.status).toBe('hidden');
    });

    it('should handle invalid comment IDs', () => {
      const success = likeComment('invalid-id');
      expect(success).toBe(false);
    });
  });

  describe('replies', () => {
    let parentCommentId: string;

    beforeEach(() => {
      const result = createComment({
        author: 'Parent User',
        message: 'This is a parent comment',
        type: 'general'
      });
      parentCommentId = result.comment!.id;
    });

    it('should add a reply to a comment', () => {
      const replyData: CommentCreate = {
        author: 'Reply User',
        message: 'This is a reply to the parent comment',
        type: 'general'
      };

      const result = addReply(parentCommentId, replyData);

      expect(result.success).toBe(true);
      expect(result.reply).toBeDefined();
      expect(result.reply?.author).toBe('Reply User');

      const parentComment = getComment(parentCommentId);
      expect(parentComment?.replies).toHaveLength(1);
      expect(parentComment?.replies?.[0].author).toBe('Reply User');
    });

    it('should not add reply to non-existent comment', () => {
      const replyData: CommentCreate = {
        author: 'Reply User',
        message: 'This is a reply to a non-existent comment',
        type: 'general'
      };

      const result = addReply('invalid-id', replyData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Parent comment not found');
    });

    it('should validate reply data', () => {
      const replyData: CommentCreate = {
        author: 'A', // Too short
        message: 'Short', // Too short
        type: 'general'
      };

      const result = addReply(parentCommentId, replyData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Author name must be at least 2 characters');
      expect(result.errors).toContain('Message must be at least 10 characters');
    });
  });

  describe('getCommentStats', () => {
    beforeEach(() => {
      // Create comments with different statuses and types
      createComment({
        author: 'User 1',
        message: 'Approved general comment',
        type: 'general'
      });

      const result2 = createComment({
        author: 'User 2',
        message: 'This contains spam so should be pending',
        type: 'feedback'
      });
      
      createComment({
        author: 'User 3',
        message: 'Issue with OpenAI specifically',
        type: 'issue',
        providerId: 'openai'
      });

      // Hide one comment
      if (result2.comment) {
        updateCommentStatus(result2.comment.id, 'hidden');
      }
    });

    it('should return correct statistics', () => {
      const stats = getCommentStats();

      expect(stats.total).toBe(3);
      expect(stats.approved).toBe(2); // Two approved (one is pending due to spam)
      expect(stats.pending).toBe(0); // None pending after hiding one
      expect(stats.hidden).toBe(1); // One hidden

      expect(stats.byType.general).toBe(1);
      expect(stats.byType.feedback).toBe(1);
      expect(stats.byType.issue).toBe(1);

      expect(stats.byProvider.openai).toBe(1);
    });
  });
}); 