import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, Heart } from 'lucide-react';
import './CommentsPanel.css';

export default function CommentsPanel({ clipId, onClose }) {
  const { comments, addComment } = useApp();
  const [text, setText] = useState('');
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const clipComments = comments[clipId] || [];

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(clipId, text.trim());
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div className="comments-panel glass-strong" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="comments-header">
          <h3 className="comments-title">
            Comments
            <span className="comments-count">{clipComments.length}</span>
          </h3>
          <button className="comments-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="comments-list">
          {clipComments.length === 0 ? (
            <div className="comments-empty">
              <p>No comments yet</p>
              <p className="comments-empty-sub">Be the first to share your thoughts!</p>
            </div>
          ) : (
            clipComments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar">{comment.avatar}</div>
                <div className="comment-body">
                  <div className="comment-header">
                    <span className="comment-user">{comment.user}</span>
                    <span className="comment-time">{comment.time}</span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                  <button className="comment-like">
                    <Heart size={14} />
                    <span>{comment.likes}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="comments-input" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className={`comments-send ${text.trim() ? 'active' : ''}`}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
