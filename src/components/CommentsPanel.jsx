import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Heart } from 'lucide-react'
import { useApp } from '../context/useApp'
import { COMMENT_MAX_LENGTH, validateCommentText } from '../services/comment-validation'
import { feedService } from '../services/feed-service'
import { EVENT_NAMES, EVENT_SOURCE, EVENT_SURFACE } from '../services/analytics/events'
import DataState from './DataState'
import './CommentsPanel.css'

const COMMENT_BLOCKED_MESSAGE = 'Commenting is disabled for this account.'
const SESSION_EXPIRED_MESSAGE = 'Session expired. Sign in again to leave a comment.'
const AUTH_REQUIRED_MESSAGE = 'Sign in to leave a comment.'
const COMMENT_SUBMIT_FAILED_MESSAGE = 'Could not submit comment.'
const COMMENT_LIKE_FAILED_MESSAGE = 'Could not update comment like.'

export default function CommentsPanel({ clipId, onClose, position, feedRequestId, impressionId }) {
  const { comments, addComment, toggleCommentLike, user, isUserCommentBlocked } = useApp()
  const [text, setText] = useState('')
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [submitError, setSubmitError] = useState('')
  const [pendingCommentLikes, setPendingCommentLikes] = useState({})
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
  const currentAuthorId = user?.id || user?.email
  const isCommentBlocked = isUserCommentBlocked(currentAuthorId)
  const isSubmitAllowed = validateCommentText(text).valid && !isCommentBlocked

  useEffect(() => {
    if (isCommentBlocked) {
      setSubmitError(COMMENT_BLOCKED_MESSAGE)
      return
    }

    setSubmitError((prev) => (prev === COMMENT_BLOCKED_MESSAGE ? '' : prev))
  }, [isCommentBlocked])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleToggleCommentLike = async (commentId) => {
    if (!user) {
      setSubmitError(AUTH_REQUIRED_MESSAGE)
      return
    }

    setPendingCommentLikes((prev) => ({
      ...prev,
      [commentId]: true,
    }))

    try {
      const didToggle = await toggleCommentLike(clipId, commentId)
      if (!didToggle) {
        setSubmitError(COMMENT_LIKE_FAILED_MESSAGE)
      }
    } finally {
      setPendingCommentLikes((prev) => ({
        ...prev,
        [commentId]: false,
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isCommentBlocked) {
      setSubmitError(COMMENT_BLOCKED_MESSAGE)
      inputRef.current?.focus()
      return
    }

    const validation = validateCommentText(text)
    if (!validation.valid) {
      setSubmitError(validation.error)
      inputRef.current?.focus()
      return
    }

    const result = await addComment(clipId, validation.normalizedText)
    if (!result?.ok) {
      if (result?.error === 'comment_blocked') {
        setSubmitError(COMMENT_BLOCKED_MESSAGE)
      } else if (result?.error === 'comment_unauthorized') {
        setSubmitError(SESSION_EXPIRED_MESSAGE)
      } else if (result?.error === 'auth_required') {
        setSubmitError(AUTH_REQUIRED_MESSAGE)
      } else {
        setSubmitError(result?.error || COMMENT_SUBMIT_FAILED_MESSAGE)
      }
      inputRef.current?.focus()
      return
    }

    setSubmitError('')
    if (impressionId && feedRequestId) {
      feedService.trackEvent(EVENT_NAMES.COMMENT_CREATED, {
        clipId,
        impressionId,
        position,
        feedRequestId,
        source: EVENT_SOURCE.CLIENT,
        surface: EVENT_SURFACE.FEED,
      })
    }
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div
        className="comments-panel glass-strong"
        data-testid="comments-panel"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="comments-header">
          <h3 className="comments-title">
            Comments
            <span className="comments-count">{clipComments.length}</span>
          </h3>
          <button
            type="button"
            className="comments-close"
            data-testid="comments-close"
            aria-label="Close comments"
            onClick={onClose}
          >
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
              <div key={comment.id} className="comment-item" data-testid={`comment-${comment.id}`}>
                <div className="comment-avatar">{comment.avatar}</div>
                <div className="comment-body">
                  <div className="comment-header">
                    <span className="comment-user">{comment.authorName}</span>
                    <span className="comment-time">{comment.timeLabel}</span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                  <button
                    type="button"
                    className={`comment-like ${comment.likedByViewer ? 'liked' : ''}`}
                    aria-label={
                      comment.likedByViewer
                        ? `Unlike comment by ${comment.authorName}`
                        : `Like comment by ${comment.authorName}`
                    }
                    disabled={Boolean(pendingCommentLikes[comment.id])}
                    onClick={() => handleToggleCommentLike(comment.id)}
                  >
                    <Heart size={14} fill={comment.likedByViewer ? 'currentColor' : 'none'} />
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
              data-testid="comment-input"
              type="text"
              placeholder="Add a comment..."
              value={text}
              disabled={isCommentBlocked}
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
            data-testid="comments-send"
            aria-label="Send comment"
            disabled={isCommentBlocked}
            className={`comments-send ${isSubmitAllowed ? 'active' : ''}`}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
