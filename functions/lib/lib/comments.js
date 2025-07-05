"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommentStats = exports.deleteComment = exports.addReply = exports.reportComment = exports.likeComment = exports.updateCommentStatus = exports.getComment = exports.getComments = exports.createComment = void 0;
const logger_1 = require("./logger");
// In-memory storage for demo - in production, use database
const comments = new Map();
/**
 * Generate unique ID
 */
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
/**
 * Validate comment content
 */
function validateComment(comment) {
    const errors = [];
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
function containsInappropriateContent(text) {
    const inappropriateWords = [
        'spam', 'viagra', 'casino', 'porn', 'xxx',
        // Add more as needed
    ];
    const lowercaseText = text.toLowerCase();
    return inappropriateWords.some(word => lowercaseText.includes(word));
}
/**
 * Create a new comment
 */
function createComment(commentData) {
    var _a;
    const errors = validateComment(commentData);
    if (errors.length > 0) {
        return { success: false, errors };
    }
    // Check for inappropriate content
    const hasInappropriateContent = containsInappropriateContent(commentData.message) ||
        containsInappropriateContent(commentData.author);
    const comment = {
        id: generateId(),
        author: commentData.author.trim(),
        email: (_a = commentData.email) === null || _a === void 0 ? void 0 : _a.trim(),
        message: commentData.message.trim(),
        providerId: commentData.providerId,
        type: commentData.type,
        createdAt: new Date().toISOString(),
        status: hasInappropriateContent ? 'pending' : 'approved',
        replies: [],
        likes: 0,
        reported: false
    };
    comments.set(comment.id, comment);
    (0, logger_1.log)('info', 'Comment created', {
        id: comment.id,
        author: comment.author,
        type: comment.type,
        status: comment.status,
        providerId: comment.providerId
    });
    return { success: true, comment };
}
exports.createComment = createComment;
/**
 * Get comments with filtering
 */
function getComments(filter = {}) {
    const allComments = Array.from(comments.values());
    let filteredComments = allComments.filter(comment => {
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
    filteredComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // Apply pagination
    if (filter.offset) {
        filteredComments = filteredComments.slice(filter.offset);
    }
    if (filter.limit) {
        filteredComments = filteredComments.slice(0, filter.limit);
    }
    return filteredComments;
}
exports.getComments = getComments;
/**
 * Get a specific comment by ID
 */
function getComment(id) {
    return comments.get(id) || null;
}
exports.getComment = getComment;
/**
 * Update comment status (for moderation)
 */
function updateCommentStatus(id, status) {
    const comment = comments.get(id);
    if (!comment)
        return false;
    comment.status = status;
    comment.updatedAt = new Date().toISOString();
    (0, logger_1.log)('info', 'Comment status updated', {
        id,
        status,
        author: comment.author
    });
    return true;
}
exports.updateCommentStatus = updateCommentStatus;
/**
 * Like a comment
 */
function likeComment(id) {
    const comment = comments.get(id);
    if (!comment)
        return false;
    comment.likes += 1;
    return true;
}
exports.likeComment = likeComment;
/**
 * Report a comment
 */
function reportComment(id) {
    const comment = comments.get(id);
    if (!comment)
        return false;
    comment.reported = true;
    comment.status = 'pending'; // Auto-moderate reported comments
    (0, logger_1.log)('warn', 'Comment reported', {
        id,
        author: comment.author,
        message: comment.message.substring(0, 50) + '...'
    });
    return true;
}
exports.reportComment = reportComment;
/**
 * Add reply to comment
 */
function addReply(parentId, replyData) {
    var _a;
    const parentComment = comments.get(parentId);
    if (!parentComment) {
        return { success: false, errors: ['Parent comment not found'] };
    }
    const errors = validateComment(replyData);
    if (errors.length > 0) {
        return { success: false, errors };
    }
    const reply = {
        id: generateId(),
        author: replyData.author.trim(),
        email: (_a = replyData.email) === null || _a === void 0 ? void 0 : _a.trim(),
        message: replyData.message.trim(),
        type: 'general',
        createdAt: new Date().toISOString(),
        status: 'approved',
        likes: 0,
        reported: false
    };
    if (!parentComment.replies) {
        parentComment.replies = [];
    }
    parentComment.replies.push(reply);
    (0, logger_1.log)('info', 'Reply added', {
        parentId,
        replyId: reply.id,
        author: reply.author
    });
    return { success: true, reply };
}
exports.addReply = addReply;
/**
 * Delete comment (soft delete by hiding)
 */
function deleteComment(id) {
    return updateCommentStatus(id, 'hidden');
}
exports.deleteComment = deleteComment;
/**
 * Get comment statistics
 */
function getCommentStats() {
    const allComments = Array.from(comments.values());
    const stats = {
        total: allComments.length,
        approved: allComments.filter(c => c.status === 'approved').length,
        pending: allComments.filter(c => c.status === 'pending').length,
        hidden: allComments.filter(c => c.status === 'hidden').length,
        byType: {},
        byProvider: {}
    };
    // Count by type
    allComments.forEach(comment => {
        stats.byType[comment.type] = (stats.byType[comment.type] || 0) + 1;
    });
    // Count by provider
    allComments.forEach(comment => {
        if (comment.providerId) {
            stats.byProvider[comment.providerId] = (stats.byProvider[comment.providerId] || 0) + 1;
        }
    });
    return stats;
}
exports.getCommentStats = getCommentStats;
/**
 * Email validation helper
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
//# sourceMappingURL=comments.js.map