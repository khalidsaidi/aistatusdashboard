'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
// import { UserComment } from '../../lib/types';
import type { Comment as UserComment } from '@/lib/types';
// import { getApiUrl } from '../../lib/utils';

interface CommentSectionProps {
  providerId?: string;
  title?: string;
  className?: string;
}

export default function CommentSection({
  providerId,
  title = 'Comments',
  className = '',
}: CommentSectionProps) {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [localPending, setLocalPending] = useState<UserComment[]>([]);
  const localPendingRef = useRef<UserComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: 'success' | 'warning' | 'error' | 'info';
  } | null>(null);

  // Form state
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentType, setCommentType] = useState<'general' | 'feedback' | 'issue'>('general');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  useEffect(() => {
    localPendingRef.current = localPending;
  }, [localPending]);

  const showMessage = (text: string, tone: 'success' | 'warning' | 'error' | 'info') => {
    setMessage({ text, tone });
  };

  const mergeComments = useCallback((primary: UserComment[], secondary: UserComment[]) => {
    const merged = new Map<string, UserComment>();
    primary.forEach((comment) => {
      if (!merged.has(comment.id)) {
        merged.set(comment.id, comment);
      }
    });
    secondary.forEach((comment) => {
      if (!merged.has(comment.id)) {
        merged.set(comment.id, comment);
      }
    });
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, []);

  const fetchComments = useCallback(
    async (loadMore = false) => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: loadMore ? offset.toString() : '0',
          ...(providerId && { providerId }),
        });

        const response = await fetch(`/api/comments?${params}`);
        const data = await response.json();

        if (response.ok) {
          const pending = localPendingRef.current;
          // Ensure data is an array
          const commentsData: UserComment[] = Array.isArray(data)
            ? data
            : data.comments && Array.isArray(data.comments)
              ? data.comments
              : [];

          if (loadMore) {
            setComments((prev) => mergeComments(prev, commentsData));
          } else {
            setComments(mergeComments(pending, commentsData));
            setOffset(0);
          }

          setHasMore(commentsData.length === limit);
          if (pending.length > 0) {
            const serverIds = new Set(commentsData.map((comment: UserComment) => comment.id));
            setLocalPending((prev) => prev.filter((comment) => !serverIds.has(comment.id)));
          }
          if (loadMore) {
            setOffset((prev) => prev + limit);
          }
        } else {
          showMessage(`Error: ${data.error}`, 'error');
          setComments([]); // Ensure comments is always an array
        }
      } catch (error) {
        showMessage('Failed to load comments.', 'error');
        setComments([]); // Ensure comments is always an array
      } finally {
        setLoading(false);
      }
    },
    [providerId, offset, mergeComments]
  );

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          content: commentMessage,
          provider: providerId,
          type: commentType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage('Comment posted successfully.', 'success');
        setAuthor('');
        setEmail('');
        setCommentMessage('');
        setCommentType('general');

        const newComment: UserComment = {
          id: data.id || `local-${Date.now()}`,
          author,
          content: commentMessage,
          provider: providerId || null,
          createdAt: new Date().toISOString(),
          approved: false,
          likes: 0,
          type: commentType,
          status: 'pending',
        };
        const mergedPending = mergeComments([newComment], localPendingRef.current);
        localPendingRef.current = mergedPending;
        setLocalPending(mergedPending);
        setComments((prev) => mergeComments([newComment], prev));

        // Refresh comments to sync with server (pending comments stay visible)
        await fetchComments();
      } else {
        showMessage(`Error: ${data.error}`, 'error');
        if (data.details) {
          showMessage(data.details.join(', '), 'error');
        }
      }
    } catch (error) {
      showMessage('Failed to post comment. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentAction = async (commentId: string, action: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the comment in the list
        setComments((prev) =>
          prev.map((comment) => (comment.id === commentId ? data.comment : comment))
        );

        if (action === 'like') {
          showMessage('Thanks for your feedback!', 'success');
        } else if (action === 'report') {
          showMessage('Comment reported for review.', 'warning');
        }

        // Clear message after 3 seconds
        const timer = setTimeout(() => setMessage(null), 3000);
        return () => clearTimeout(timer);
      } else {
        showMessage(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showMessage('Action failed. Please try again.', 'error');
    }
  };

  const formatDate = (dateString: string | { _seconds: number; _nanoseconds: number }) => {
    let date: Date;

    if (typeof dateString === 'string') {
      date = new Date(dateString);
    } else {
      // Handle Firestore timestamp format
      date = new Date(dateString._seconds * 1000);
    }

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'feedback':
        return 'Feedback';
      case 'issue':
        return 'Issue';
      case 'provider':
        return 'Provider';
      default:
        return 'General';
    }
  };

  const CommentItem = ({ comment }: { comment: UserComment }) => (
    <div
      className="surface-card p-4"
      data-comment-id={comment.id}
      data-comment-text={comment.content || comment.message || ''}
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">{comment.author}</span>
            <span className="pill text-[0.65rem] uppercase tracking-[0.2em]">
              {getTypeLabel(comment.type)}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatDate(comment.createdAt)}
          </span>
        </div>

        {(comment.status === 'pending' || comment.approved === false) && (
          <span className="text-xs bg-amber-100/70 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-1 rounded-full">
            Pending Review
          </span>
        )}
      </div>

      <p className="text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">
        {comment.content || comment.message}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleCommentAction(comment.id, 'like')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors py-2 px-3 min-h-[36px] rounded-full border border-slate-200/70 dark:border-slate-700/70"
            aria-label="Like"
          >
            Like
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {comment.likes || 0}
            </span>
          </button>

          <button
            onClick={() => handleCommentAction(comment.id, 'report')}
            className="text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 transition-colors py-2 px-3 min-h-[36px] rounded-full border border-slate-200/70 dark:border-slate-700/70"
            aria-label="Report"
          >
            Report
          </button>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 pl-4 border-l-2 border-slate-200/70 dark:border-slate-700/70 space-y-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="bg-slate-50/80 dark:bg-slate-800/70 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {reply.author}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(reply.createdAt)}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{reply.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`} data-tour="comments-section">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Community
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
            {title} ({comments.length})
          </h3>
        </div>

        <button
          onClick={() => fetchComments()}
          disabled={loading}
          className="cta-secondary disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Comment Form */}
      <form
        onSubmit={handleSubmit}
        className="surface-card p-4 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Comment Type
          </label>
          <select
            value={commentType}
            onChange={(e) => setCommentType(e.target.value as any)}
            className="w-full px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
          >
            <option value="general">General Comment</option>
            <option value="feedback">Feedback</option>
            <option value="issue">Report Issue</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Message *
          </label>
          <textarea
            value={commentMessage}
            onChange={(e) => setCommentMessage(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-xl bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
            placeholder="Share your thoughts..."
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {commentMessage.length}/1000 characters
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !author.trim() || commentMessage.trim().length < 10}
          className="w-full cta-primary disabled:opacity-60"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      {/* Message Display */}
      {message && (
        <div
          className={`p-3 rounded-xl text-sm ${
            message.tone === 'success'
              ? 'bg-emerald-50/80 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
              : message.tone === 'warning'
                ? 'bg-amber-50/80 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200'
                : message.tone === 'info'
                  ? 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                  : 'bg-rose-50/80 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {loading && comments.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            Loading comments...
          </div>
        ) : !Array.isArray(comments) || comments.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}

            {hasMore && (
              <button
                onClick={() => fetchComments(true)}
                disabled={loading}
                className="w-full py-3 px-4 border border-slate-200/70 dark:border-slate-700/70 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-50/80 dark:hover:bg-slate-800/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
              >
                {loading ? 'Loading...' : 'Load More Comments'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
