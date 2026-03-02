import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Send, Heart } from 'lucide-react'
import { useApp } from '../context/useApp'
import { COMMENT_MAX_LENGTH, validateCommentText } from '../services/comment-validation'
import { feedService } from '../services/feed-service'
import { EVENT_NAMES, EVENT_SOURCE, EVENT_SURFACE } from '../services/analytics/events'
import DataState from './DataState'
import './CommentsPanel.css'

export default function CommentsPanel({ clipId, onClose, position, feedRequestId, impressionId }) {
  const { comments, addComment, user, isUserCommentBlocked } = useApp()
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
  const currentAuthorId = user?.id || user?.email
  const isCommentBlocked = isUserCommentBlocked(currentAuthorId)
  const isSubmitAllowed = validateCommentText(text).valid && !isCommentBlocked

  useEffect(() => {
    if (isCommentBlocked) {
      setSubmitError('Вам запрещено публиковать комментарии')
      return
    }

    setSubmitError((prev) => (prev === 'Вам запрещено публиковать комментарии' ? '' : prev))
  }, [isCommentBlocked])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isCommentBlocked) {
      setSubmitError('Вам запрещено публиковать комментарии')
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
        setSubmitError('Вам запрещено публиковать комментарии')
      } else if (result?.error === 'comment_unauthorized') {
        setSubmitError('Сессия истекла. Войдите снова, чтобы оставить комментарий')
      } else if (result?.error === 'auth_required') {
        setSubmitError('Войдите, чтобы оставить комментарий')
      } else {
        setSubmitError(result?.error || 'Не удалось отправить комментарий')
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
                    <span className="comment-user">{comment.authorName}</span>
                    <span className="comment-time">{comment.timeLabel}</span>
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
