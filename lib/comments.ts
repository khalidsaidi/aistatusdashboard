import { UserComment, CommentCreate, CommentFilter } from './types';
import { log } from './logger';

// In-memory storage for demo - in production, use database
const comments = new Map<string, UserComment>();

// Export for testing purposes
export const _testOnlyComments = comments;

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Validate comment content
 */
function validateComment(comment: CommentCreate): string[] {
  const errors: string[] = [];

  if (!comment.author || comment.author.trim().length < 2) {
    errors.push('Author name must be at least 2 characters');
  }

  if (!comment.message || comment.message.trim().length < 10) {
    errors.push('Message must be at least 10 characters');
  }

  if (comment.message && comment.message.length > 1000) {
    errors.push('Message must be less than 1000 characters');
  }

  if (comment.email && !isValidEmail(comment.email)) {
    errors.push('Invalid email address');
  }

  return errors;
}

/**
 * Check for spam/inappropriate content (basic implementation)
 */
function containsInappropriateContent(text: string): boolean {
  const inappropriateWords = [
    'spam',
    'viagra',
    'casino',
    'porn',
    'xxx',
    // Add more as needed
  ];

  const lowercaseText = text.toLowerCase();
  return inappropriateWords.some((word) => lowercaseText.includes(word));
}

/**
 * Create a new comment
 */
export function createComment(commentData: CommentCreate): {
  success: boolean;
  comment?: UserComment;
  errors?: string[];
} {
  const errors = validateComment(commentData);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Check for inappropriate content
  const hasInappropriateContent =
    containsInappropriateContent(commentData.message) ||
    containsInappropriateContent(commentData.author);

  const comment: UserComment = {
    id: generateId(),
    author: commentData.author.trim(),
    email: commentData.email?.trim(),
    message: commentData.message.trim(),
    providerId: commentData.providerId,
    type: commentData.type,
    createdAt: new Date().toISOString(),
    status: hasInappropriateContent ? 'pending' : 'approved',
    replies: [],
    likes: 0,
    reported: false,
  };

  comments.set(comment.id, comment);

  log('info', 'Comment created', {
    id: comment.id,
    author: comment.author,
    type: comment.type,
    status: comment.status,
    providerId: comment.providerId,
  });

  return { success: true, comment };
}

/**
 * Get comments with filtering
 */
export function getComments(filter: CommentFilter = {}): UserComment[] {
  const allComments = Array.from(comments.values());

  let filteredComments = allComments.filter((comment) => {
    // Filter by provider
    if (filter.providerId && comment.providerId !== filter.providerId) {
      return false;
    }

    // Filter by type
    if (filter.type && comment.type !== filter.type) {
      return false;
    }

    // Filter by status
    if (filter.status && comment.status !== filter.status) {
      return false;
    }

    return true;
  });

  // Sort by creation date (newest first)
  filteredComments.sort((a, b) => {
    const getTime = (dateValue: string | { _seconds: number; _nanoseconds: number }) => {
      if (typeof dateValue === 'string') {
        return new Date(dateValue).getTime();
      } else {
        return dateValue._seconds * 1000;
      }
    };
    return getTime(b.createdAt) - getTime(a.createdAt);
  });

  // Apply pagination
  if (filter.offset) {
    filteredComments = filteredComments.slice(filter.offset);
  }

  if (filter.limit) {
    filteredComments = filteredComments.slice(0, filter.limit);
  }

  return filteredComments;
}

/**
 * Get a specific comment by ID
 */
export function getComment(id: string): UserComment | null {
  return comments.get(id) || null;
}

/**
 * Update comment status (for moderation)
 */
export function updateCommentStatus(
  id: string,
  status: 'pending' | 'approved' | 'hidden'
): boolean {
  const comment = comments.get(id);
  if (!comment) return false;

  comment.status = status;
  comment.updatedAt = new Date().toISOString();

  log('info', 'Comment status updated', {
    id,
    status,
    author: comment.author,
  });

  return true;
}

/**
 * Like a comment
 */
export function likeComment(id: string): boolean {
  const comment = comments.get(id);
  if (!comment) return false;

  comment.likes = (comment.likes || 0) + 1;

  return true;
}

/**
 * Report a comment
 */
export function reportComment(id: string): boolean {
  const comment = comments.get(id);
  if (!comment) return false;

  comment.reported = true;
  comment.status = 'pending'; // Auto-moderate reported comments

  log('warn', 'Comment reported', {
    id,
    author: comment.author,
    message: (comment.message || comment.content || '').substring(0, 50) + '...',
  });

  return true;
}

/**
 * Add reply to comment
 */
export function addReply(
  parentId: string,
  replyData: CommentCreate
): { success: boolean; reply?: UserComment; errors?: string[] } {
  const parentComment = comments.get(parentId);
  if (!parentComment) {
    return { success: false, errors: ['Parent comment not found'] };
  }

  const errors = validateComment(replyData);
  if (errors.length > 0) {
    return { success: false, errors };
  }

  const reply: UserComment = {
    id: generateId(),
    author: replyData.author.trim(),
    email: replyData.email?.trim(),
    message: replyData.message.trim(),
    type: 'general', // Replies are always general type
    createdAt: new Date().toISOString(),
    status: 'approved',
    likes: 0,
    reported: false,
  };

  if (!parentComment.replies) {
    parentComment.replies = [];
  }

  parentComment.replies.push(reply);

  log('info', 'Reply added', {
    parentId,
    replyId: reply.id,
    author: reply.author,
  });

  return { success: true, reply };
}

/**
 * Delete comment (soft delete by hiding)
 */
export function deleteComment(id: string): boolean {
  return updateCommentStatus(id, 'hidden');
}

/**
 * Get comment statistics
 */
export function getCommentStats(): {
  total: number;
  approved: number;
  pending: number;
  hidden: number;
  byType: Record<string, number>;
  byProvider: Record<string, number>;
} {
  const allComments = Array.from(comments.values());

  const stats = {
    total: allComments.length,
    approved: allComments.filter((c) => c.status === 'approved').length,
    pending: allComments.filter((c) => c.status === 'pending').length,
    hidden: allComments.filter((c) => c.status === 'hidden').length,
    byType: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
  };

  // Count by type
  allComments.forEach((comment) => {
    const type = comment.type || 'general';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  // Count by provider
  allComments.forEach((comment) => {
    if (comment.providerId) {
      stats.byProvider[comment.providerId] = (stats.byProvider[comment.providerId] || 0) + 1;
    }
  });

  return stats;
}

/**
 * Email validation helper
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
