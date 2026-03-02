import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useApp } from '../context/useApp'
import { feedService } from '../services/feed-service'
import './AdminCommentsPage.css'

function isValidDate(value) {
  return typeof value === 'string' && value.trim() && !Number.isNaN(Date.parse(value))
}

function formatDate(value) {
  if (!isValidDate(value)) {
    return 'Legacy (no date)'
  }

  return new Date(value).toLocaleString()
}

export default function AdminCommentsPage() {
  const {
    user,
    comments,
    blockedCommentUsers,
    blockUserComments,
    deleteComment,
    deleteCommentsByUser,
  } = useApp()
  const navigate = useNavigate()
  const [operationState, setOperationState] = useState({ status: 'idle', message: '' })
  const [busyCommentId, setBusyCommentId] = useState('')
  const [rowStatusById, setRowStatusById] = useState({})
  const [moderationState, setModerationState] = useState({
    status: 'loading',
    rows: [],
    message: '',
  })

  const loadModerationList = useCallback(async () => {
    setModerationState({ status: 'loading', rows: [], message: '' })

    try {
      const clips = feedService.getFeed({ selectedGenres: [] })
      const rows = await feedService.getAllCommentsForModeration({
        comments,
        clips,
        blockedUsers: blockedCommentUsers,
      })

      setModerationState({ status: 'success', rows, message: '' })
    } catch {
      setModerationState({
        status: 'error',
        rows: [],
        message: 'Could not load moderation list. Try again.',
      })
    }
  }, [blockedCommentUsers, comments])

  useEffect(() => {
    loadModerationList()
  }, [loadModerationList])

  const flattenedComments = useMemo(() => moderationState.rows || [], [moderationState.rows])

  if (!user?.isAdmin) {
    return (
      <div className="admin-comments-restricted">
        <AlertTriangle size={48} />
        <h2>Access Denied</h2>
        <p>You need admin privileges to access comment moderation.</p>
        <button onClick={() => navigate('/feed')}>Go to Feed</button>
      </div>
    )
  }

  const runAction = async ({ action, pendingLabel, successLabel, errorLabel, commentId }) => {
    setOperationState({ status: 'pending', message: pendingLabel })
    setBusyCommentId(commentId || '')
    setRowStatusById((prev) => ({ ...prev, [commentId]: 'pending' }))

    try {
      const ok = await action()
      if (!ok) {
        setOperationState({ status: 'error', message: errorLabel })
        setRowStatusById((prev) => ({ ...prev, [commentId]: 'error' }))
        return
      }

      setOperationState({ status: 'success', message: successLabel })
      setRowStatusById((prev) => ({ ...prev, [commentId]: 'success' }))
    } catch {
      setOperationState({ status: 'error', message: errorLabel })
      setRowStatusById((prev) => ({ ...prev, [commentId]: 'error' }))
    } finally {
      setBusyCommentId('')
    }
  }

  const handleDeleteComment = (row) => {
    if (!window.confirm(`Delete this comment by ${row.authorName || 'Anonymous'}?`)) {
      return
    }

    runAction({
      action: () => deleteComment({ clipId: row.clipId, commentId: row.id }),
      pendingLabel: 'Deleting comment...',
      successLabel: 'Comment deleted.',
      errorLabel: 'Could not delete comment.',
      commentId: row.id,
    })
  }

  const handleBlockAuthor = (row) => {
    if (!window.confirm(`Block comments from ${row.authorName || 'this author'}?`)) {
      return
    }

    runAction({
      action: () => blockUserComments(row.authorId),
      pendingLabel: 'Blocking author...',
      successLabel: 'Author has been blocked.',
      errorLabel: 'Could not block author.',
      commentId: row.id,
    })
  }

  const handleDeleteAuthorComments = (row) => {
    if (!window.confirm(`Delete all comments by ${row.authorName || 'this author'}?`)) {
      return
    }

    runAction({
      action: () => deleteCommentsByUser({ authorId: row.authorId }),
      pendingLabel: 'Deleting all comments by author...',
      successLabel: 'All author comments deleted.',
      errorLabel: 'Could not delete author comments.',
      commentId: row.id,
    })
  }

  return (
    <div className="admin-comments-page">
      <header className="admin-comments-header">
        <h1>Comment Moderation</h1>
        <p>Total comments: {flattenedComments.length}</p>
      </header>

      <div className="admin-comments-status" data-status={operationState.status}>
        {operationState.message || 'No moderation actions yet.'}
      </div>

      {moderationState.status === 'error' && (
        <div className="admin-comments-status" data-status="error">
          <span>{moderationState.message}</span>
          <button type="button" onClick={loadModerationList}>
            Retry
          </button>
        </div>
      )}

      <div className="admin-comments-table-wrap glass-strong">
        <table className="admin-comments-table">
          <thead>
            <tr>
              <th>Author</th>
              <th>Text</th>
              <th>Clip</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {moderationState.status === 'loading' && (
              <tr>
                <td colSpan={5} className="admin-comments-empty">
                  Loading moderation list...
                </td>
              </tr>
            )}

            {moderationState.status === 'success' && flattenedComments.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-comments-empty">
                  No comments found.
                </td>
              </tr>
            )}

            {moderationState.status === 'success' &&
              flattenedComments.map((row) => {
                const isBlocked = Boolean(row.isBlockedAuthor)
                const isBusy = busyCommentId === row.id && operationState.status === 'pending'
                const rowStatus = rowStatusById[row.id]
                const rowStatusLabel =
                  rowStatus === 'pending'
                    ? 'In progress'
                    : rowStatus === 'success'
                      ? 'Done'
                      : rowStatus === 'error'
                        ? 'Failed'
                        : ''

                return (
                  <tr key={row.id}>
                    <td>
                      <div className="admin-comments-author">
                        <span>{row.authorName || 'Anonymous'}</span>
                        <small>{row.authorId}</small>
                        {isBlocked && <span className="admin-comments-badge">Blocked</span>}
                      </div>
                    </td>
                    <td className="admin-comments-text">{row.text || '—'}</td>
                    <td>
                      <div className="admin-comments-clip">
                        <span>{row.clipTitle}</span>
                        <small>{row.clipId}</small>
                      </div>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="admin-comments-actions">
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(row)}
                          disabled={isBusy}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBlockAuthor(row)}
                          disabled={isBusy || isBlocked}
                        >
                          Block author
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAuthorComments(row)}
                          disabled={isBusy}
                        >
                          Delete all
                        </button>
                        {rowStatusLabel && (
                          <small className="admin-comments-row-status">{rowStatusLabel}</small>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
