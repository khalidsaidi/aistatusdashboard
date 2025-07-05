"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const comments_1 = require("../comments");
// Mock the logger
jest.mock('../logger', () => ({
    log: jest.fn()
}));
// Access the internal comments Map for testing
const commentsModule = require('../comments');
(0, globals_1.describe)('Comments System', () => {
    (0, globals_1.beforeEach)(() => {
        // Clear the internal comments Map before each test
        const comments = commentsModule.comments || new Map();
        comments.clear();
    });
    (0, globals_1.describe)('createComment', () => {
        (0, globals_1.it)('should create a valid comment', () => {
            var _a, _b, _c, _d, _e, _f;
            const commentData = {
                author: 'Test User',
                email: 'test@example.com',
                message: 'This is a test comment with enough characters',
                type: 'general'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.comment).toBeDefined();
            (0, globals_1.expect)((_a = result.comment) === null || _a === void 0 ? void 0 : _a.author).toBe('Test User');
            (0, globals_1.expect)((_b = result.comment) === null || _b === void 0 ? void 0 : _b.message).toBe('This is a test comment with enough characters');
            (0, globals_1.expect)((_c = result.comment) === null || _c === void 0 ? void 0 : _c.type).toBe('general');
            (0, globals_1.expect)((_d = result.comment) === null || _d === void 0 ? void 0 : _d.status).toBe('approved');
            (0, globals_1.expect)((_e = result.comment) === null || _e === void 0 ? void 0 : _e.likes).toBe(0);
            (0, globals_1.expect)((_f = result.comment) === null || _f === void 0 ? void 0 : _f.reported).toBe(false);
        });
        (0, globals_1.it)('should validate author name length', () => {
            const commentData = {
                author: 'A',
                message: 'This is a valid message with enough characters',
                type: 'general'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Author name must be at least 2 characters');
        });
        (0, globals_1.it)('should validate message length', () => {
            const commentData = {
                author: 'Test User',
                message: 'Short',
                type: 'general'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Message must be at least 10 characters');
        });
        (0, globals_1.it)('should validate email format', () => {
            const commentData = {
                author: 'Test User',
                email: 'invalid-email',
                message: 'This is a valid message with enough characters',
                type: 'general'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Invalid email address');
        });
        (0, globals_1.it)('should handle inappropriate content', () => {
            var _a;
            const commentData = {
                author: 'Test User',
                message: 'This message contains spam content which should be flagged',
                type: 'general'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)((_a = result.comment) === null || _a === void 0 ? void 0 : _a.status).toBe('pending'); // Should be pending due to spam
        });
        (0, globals_1.it)('should support different comment types', () => {
            const types = ['general', 'feedback', 'issue'];
            types.forEach(type => {
                var _a;
                const commentData = {
                    author: 'Test User',
                    message: `This is a ${type} comment with enough characters`,
                    type
                };
                const result = (0, comments_1.createComment)(commentData);
                (0, globals_1.expect)(result.success).toBe(true);
                (0, globals_1.expect)((_a = result.comment) === null || _a === void 0 ? void 0 : _a.type).toBe(type);
            });
        });
        (0, globals_1.it)('should support provider-specific comments', () => {
            var _a;
            const commentData = {
                author: 'Test User',
                message: 'This is a comment about OpenAI specifically',
                type: 'provider',
                providerId: 'openai'
            };
            const result = (0, comments_1.createComment)(commentData);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)((_a = result.comment) === null || _a === void 0 ? void 0 : _a.providerId).toBe('openai');
        });
    });
    (0, globals_1.describe)('getComments', () => {
        (0, globals_1.beforeEach)(() => {
            // Create some test comments
            (0, comments_1.createComment)({
                author: 'User 1',
                message: 'General comment about the dashboard',
                type: 'general'
            });
            (0, comments_1.createComment)({
                author: 'User 2',
                message: 'Feedback about the interface',
                type: 'feedback'
            });
            (0, comments_1.createComment)({
                author: 'User 3',
                message: 'Issue with OpenAI status',
                type: 'issue',
                providerId: 'openai'
            });
        });
        (0, globals_1.it)('should return all comments by default', () => {
            const comments = (0, comments_1.getComments)();
            (0, globals_1.expect)(comments).toHaveLength(3);
        });
        (0, globals_1.it)('should filter by type', () => {
            const feedbackComments = (0, comments_1.getComments)({ type: 'feedback' });
            (0, globals_1.expect)(feedbackComments).toHaveLength(1);
            (0, globals_1.expect)(feedbackComments[0].type).toBe('feedback');
        });
        (0, globals_1.it)('should filter by provider', () => {
            const openaiComments = (0, comments_1.getComments)({ providerId: 'openai' });
            (0, globals_1.expect)(openaiComments).toHaveLength(1);
            (0, globals_1.expect)(openaiComments[0].providerId).toBe('openai');
        });
        (0, globals_1.it)('should limit results', () => {
            const limitedComments = (0, comments_1.getComments)({ limit: 2 });
            (0, globals_1.expect)(limitedComments).toHaveLength(2);
        });
        (0, globals_1.it)('should support pagination', () => {
            const firstPage = (0, comments_1.getComments)({ limit: 2, offset: 0 });
            const secondPage = (0, comments_1.getComments)({ limit: 2, offset: 2 });
            (0, globals_1.expect)(firstPage).toHaveLength(2);
            (0, globals_1.expect)(secondPage).toHaveLength(1); // Only 3 total comments
            (0, globals_1.expect)(firstPage[0].id).not.toBe(secondPage[0].id);
        });
        (0, globals_1.it)('should sort by creation date (newest first)', () => {
            const comments = (0, comments_1.getComments)();
            // Comments should be sorted newest first
            for (let i = 1; i < comments.length; i++) {
                const prevDate = new Date(comments[i - 1].createdAt);
                const currentDate = new Date(comments[i].createdAt);
                (0, globals_1.expect)(prevDate.getTime()).toBeGreaterThanOrEqual(currentDate.getTime());
            }
        });
    });
    (0, globals_1.describe)('comment actions', () => {
        let commentId;
        (0, globals_1.beforeEach)(() => {
            const result = (0, comments_1.createComment)({
                author: 'Test User',
                message: 'This is a test comment for actions',
                type: 'general'
            });
            commentId = result.comment.id;
        });
        (0, globals_1.it)('should like a comment', () => {
            const success = (0, comments_1.likeComment)(commentId);
            (0, globals_1.expect)(success).toBe(true);
            const comment = (0, comments_1.getComment)(commentId);
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.likes).toBe(1);
        });
        (0, globals_1.it)('should report a comment', () => {
            const success = (0, comments_1.reportComment)(commentId);
            (0, globals_1.expect)(success).toBe(true);
            const comment = (0, comments_1.getComment)(commentId);
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.reported).toBe(true);
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.status).toBe('pending'); // Should be auto-moderated
        });
        (0, globals_1.it)('should update comment status', () => {
            const success = (0, comments_1.updateCommentStatus)(commentId, 'hidden');
            (0, globals_1.expect)(success).toBe(true);
            const comment = (0, comments_1.getComment)(commentId);
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.status).toBe('hidden');
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.updatedAt).toBeDefined();
        });
        (0, globals_1.it)('should delete (hide) a comment', () => {
            const success = (0, comments_1.deleteComment)(commentId);
            (0, globals_1.expect)(success).toBe(true);
            const comment = (0, comments_1.getComment)(commentId);
            (0, globals_1.expect)(comment === null || comment === void 0 ? void 0 : comment.status).toBe('hidden');
        });
        (0, globals_1.it)('should handle invalid comment IDs', () => {
            const success = (0, comments_1.likeComment)('invalid-id');
            (0, globals_1.expect)(success).toBe(false);
        });
    });
    (0, globals_1.describe)('replies', () => {
        let parentCommentId;
        (0, globals_1.beforeEach)(() => {
            const result = (0, comments_1.createComment)({
                author: 'Parent User',
                message: 'This is a parent comment',
                type: 'general'
            });
            parentCommentId = result.comment.id;
        });
        (0, globals_1.it)('should add a reply to a comment', () => {
            var _a, _b;
            const replyData = {
                author: 'Reply User',
                message: 'This is a reply to the parent comment',
                type: 'general'
            };
            const result = (0, comments_1.addReply)(parentCommentId, replyData);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.reply).toBeDefined();
            (0, globals_1.expect)((_a = result.reply) === null || _a === void 0 ? void 0 : _a.author).toBe('Reply User');
            const parentComment = (0, comments_1.getComment)(parentCommentId);
            (0, globals_1.expect)(parentComment === null || parentComment === void 0 ? void 0 : parentComment.replies).toHaveLength(1);
            (0, globals_1.expect)((_b = parentComment === null || parentComment === void 0 ? void 0 : parentComment.replies) === null || _b === void 0 ? void 0 : _b[0].author).toBe('Reply User');
        });
        (0, globals_1.it)('should not add reply to non-existent comment', () => {
            const replyData = {
                author: 'Reply User',
                message: 'This is a reply to a non-existent comment',
                type: 'general'
            };
            const result = (0, comments_1.addReply)('invalid-id', replyData);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Parent comment not found');
        });
        (0, globals_1.it)('should validate reply data', () => {
            const replyData = {
                author: 'A',
                message: 'Short',
                type: 'general'
            };
            const result = (0, comments_1.addReply)(parentCommentId, replyData);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.errors).toContain('Author name must be at least 2 characters');
            (0, globals_1.expect)(result.errors).toContain('Message must be at least 10 characters');
        });
    });
    (0, globals_1.describe)('getCommentStats', () => {
        (0, globals_1.beforeEach)(() => {
            // Create comments with different statuses and types
            (0, comments_1.createComment)({
                author: 'User 1',
                message: 'Approved general comment',
                type: 'general'
            });
            const result2 = (0, comments_1.createComment)({
                author: 'User 2',
                message: 'This contains spam so should be pending',
                type: 'feedback'
            });
            (0, comments_1.createComment)({
                author: 'User 3',
                message: 'Issue with OpenAI specifically',
                type: 'issue',
                providerId: 'openai'
            });
            // Hide one comment
            if (result2.comment) {
                (0, comments_1.updateCommentStatus)(result2.comment.id, 'hidden');
            }
        });
        (0, globals_1.it)('should return correct statistics', () => {
            const stats = (0, comments_1.getCommentStats)();
            (0, globals_1.expect)(stats.total).toBe(3);
            (0, globals_1.expect)(stats.approved).toBe(2); // Two approved (one is pending due to spam)
            (0, globals_1.expect)(stats.pending).toBe(0); // None pending after hiding one
            (0, globals_1.expect)(stats.hidden).toBe(1); // One hidden
            (0, globals_1.expect)(stats.byType.general).toBe(1);
            (0, globals_1.expect)(stats.byType.feedback).toBe(1);
            (0, globals_1.expect)(stats.byType.issue).toBe(1);
            (0, globals_1.expect)(stats.byProvider.openai).toBe(1);
        });
    });
});
//# sourceMappingURL=comments.test.js.map