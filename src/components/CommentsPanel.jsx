import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Heart } from 'lucide-react'
import { useApp } from '../context/useApp'
import { COMMENT_MAX_LENGTH, validateCommentText } from '../services/comment-validation'
import { feedService } from '../services/feed-service'
import DataState from './DataState'
import './CommentsPanel.css'

export default function CommentsPanel({ clipId, onClose }) {
  const { comments, addComment } = useApp()
  const [text, setText] = useState('')
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [submitError, setSubmitError] = useState('')
  const panelRef = useRef(null)
  const inputRef = useRef(null)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadComments = useCallback(async () => {
    if (!isMountedRef.current) {
      return
    }

    setLoadState({ status: 'loading', error: '' })

    try {
      if (!clipId) {
        throw new Error('Missing clip id')
      }

      await feedService.wait(180)
      if (!isMountedRef.current) {
        return
      }
      setLoadState({ status: 'ready', error: '' })
    } catch {
      if (!isMountedRef.current) {
        return
      }
      setLoadState({ status: 'error', error: 'Failed to load comments for this clip.' })
    }
  }, [clipId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadComments()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadComments])

  const clipComments = comments[clipId] || []

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = (e) => {
    e.preventDefault()

    const validation = validateCommentText(text)
    if (!validation.valid) {
      setSubmitError(validation.error)
      inputRef.current?.focus()
      return
    }

    const result = addComment(clipId, validation.normalizedText)
    if (!result?.ok) {
      setSubmitError(result?.error || 'Could not submit comment. Please try again.')
      inputRef.current?.focus()
      return
    }

    setSubmitError('')
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div
        className="comments-panel glass-strong"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
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
          {loadState.status === 'loading' && (
            <DataState
              variant="loading"
              title="Loading comments"
              description="Fetching latest discussion..."
            />
          )}

          {loadState.status === 'error' && (
            <DataState
              variant="error"
              title="Could not load comments"
              description={loadState.error}
              actionLabel="Retry"
              onAction={loadComments}
            />
          )}

          {loadState.status === 'ready' && clipComments.length === 0 && (
            <div className="comments-empty">
              <p>No comments yet</p>
              <p className="comments-empty-sub">Be the first to share your thoughts!</p>
            </div>
          )}

          {loadState.status === 'ready' &&
            clipComments.length > 0 &&
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
            ))}
        </div>

        <form className="comments-input" onSubmit={handleSubmit}>
          <div className="comments-input-field">
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a comment..."
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (submitError) {
                  setSubmitError('')
                }
              }}
              aria-invalid={Boolean(submitError)}
            />
            {submitError && <p className="comments-input-error">{submitError}</p>}
            <p className="comments-input-hint">
              {text.trim().length}/{COMMENT_MAX_LENGTH}
            </p>
          </div>
          <button
            type="submit"
            className={`comments-send ${validateCommentText(text).valid ? 'active' : ''}`}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
