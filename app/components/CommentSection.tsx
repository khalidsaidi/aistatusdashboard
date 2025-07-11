'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserComment } from '../../lib/types';
import { getApiUrl } from '../../lib/utils';

interface CommentSectionProps {
  providerId?: string;
  title?: string;
  className?: string;
}

export default function CommentSection({ providerId, title = "Comments", className = "" }: CommentSectionProps) {
  const [comments, setComments] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form state
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentType, setCommentType] = useState<'general' | 'feedback' | 'issue'>('general');
  
  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  const fetchComments = useCallback(async (loadMore = false) => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: loadMore ? offset.toString() : '0',
        ...(providerId && { providerId }),
      });
      
      const response = await fetch(`${getApiUrl('comments')}?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        // Ensure data is an array
        const commentsData = Array.isArray(data) ? data : (data.comments && Array.isArray(data.comments) ? data.comments : []);
        
        if (loadMore) {
          setComments(prev => [...prev, ...commentsData]);
        } else {
          setComments(commentsData);
          setOffset(0);
        }
        
        setHasMore(commentsData.length === limit);
        if (loadMore) {
          setOffset(prev => prev + limit);
        }
      } else {
        setMessage(`❌ Error: ${data.error}`);
        setComments([]); // Ensure comments is always an array
      }
    } catch (error) {
      setMessage('❌ Failed to load comments');
      setComments([]); // Ensure comments is always an array
    } finally {
      setLoading(false);
    }
  }, [providerId, offset]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(getApiUrl('comments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          content: commentMessage,
          provider: providerId
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ Comment posted successfully`);
        setAuthor('');
        setEmail('');
        setCommentMessage('');
        setCommentType('general');
        
        // Refresh comments to show new comment (if approved)
        await fetchComments();
      } else {
        setMessage(`❌ Error: ${data.error}`);
        if (data.details) {
          setMessage(`❌ ${data.details.join(', ')}`);
        }
      }
    } catch (error) {
      setMessage('❌ Failed to post comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentAction = async (commentId: string, action: string) => {
    try {
      const response = await fetch(`${getApiUrl('comments')}/${commentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update the comment in the list
        setComments(prev => 
          prev.map(comment => 
            comment.id === commentId ? data.comment : comment
          )
        );
        
        if (action === 'like') {
          setMessage('👍 Thanks for your feedback!');
        } else if (action === 'report') {
          setMessage('🚨 Comment reported for review');
        }
        
        // Clear message after 3 seconds
        const timer = setTimeout(() => setMessage(''), 3000);
        return () => clearTimeout(timer);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Action failed. Please try again.');
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'feedback': return '💬';
      case 'issue': return '🐛';
      case 'provider': return '🔧';
      default: return '💭';
    }
  };

  const CommentItem = ({ comment }: { comment: UserComment }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-900 dark:text-white">
            {comment.author}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getTypeIcon(comment.type || 'general')} {formatDate(comment.createdAt)}
          </span>
        </div>
        
        {((comment.status === 'pending') || (comment.approved === false)) && (
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
            Pending Review
          </span>
        )}
      </div>
      
      <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
        {comment.content || comment.message}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleCommentAction(comment.id, 'like')}
            className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2 px-3 min-h-[44px] min-w-[44px] rounded"
          >
            <span>👍</span>
            <span>{comment.likes || 0}</span>
          </button>
          
          <button
            onClick={() => handleCommentAction(comment.id, 'report')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors py-2 px-3 min-h-[44px] min-w-[44px] rounded flex items-center justify-center"
          >
            🚨 Report
          </button>
        </div>
      </div>
      
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-600 space-y-3">
          {comment.replies.map(reply => (
            <div key={reply.id} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {reply.author}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(reply.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {reply.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title} ({comments.length})
        </h3>
        
        <button
          onClick={() => fetchComments()}
          disabled={loading}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Your name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Comment Type
          </label>
          <select
            value={commentType}
            onChange={(e) => setCommentType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="general">💭 General Comment</option>
            <option value="feedback">💬 Feedback</option>
            <option value="issue">🐛 Report Issue</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Message *
          </label>
          <textarea
            value={commentMessage}
            onChange={(e) => setCommentMessage(e.target.value)}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Share your thoughts..."
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {commentMessage.length}/1000 characters
          </div>
        </div>
        
        <button
          type="submit"
          disabled={submitting || !author.trim() || commentMessage.trim().length < 10}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors min-h-[44px]"
        >
          {submitting ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      {/* Message Display */}
      {message && (
        <div className={`p-3 rounded-md ${
          message.includes('✅') || message.includes('👍')
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            : message.includes('🚨')
            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {loading && comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading comments...
          </div>
        ) : !Array.isArray(comments) || comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          <>
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
            
            {hasMore && (
              <button
                onClick={() => fetchComments(true)}
                disabled={loading}
                className="w-full py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
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