import { useMemo } from 'react'
import { useApp } from '../context/useApp'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Ban, MessageSquareX, Trash2 } from 'lucide-react'
import './AdminPage.css'

function formatCommentDate(value) {
  if (!value) {
    return 'Unknown date'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminPage() {
  const { user, comments, blockedCommentUsers, blockUserFromComments, deleteComment, deleteAllCommentsByUser } =
    useApp()
  const navigate = useNavigate()

  const commentsList = useMemo(() => {
    return Object.entries(comments)
      .flatMap(([clipId, clipComments]) =>
        clipComments.map((comment) => ({
          ...comment,
          clipId,
          createdAt: comment.createdAt || null,
        }))
      )
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateB - dateA
      })
  }, [comments])

  if (!user?.isAdmin) {
    return (
      <div className="admin-restricted">
        <AlertTriangle size={48} />
        <h2>Access Denied</h2>
        <p>You need admin privileges to access this page.</p>
        <button onClick={() => navigate('/feed')}>Go to Feed</button>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">Admin Panel</h1>
        <p className="admin-subtitle">
          Модерация комментариев: список отсортирован по дате (сначала новые). Всего: {commentsList.length}
        </p>
      </div>

      {commentsList.length === 0 ? (
        <div className="admin-empty">Комментариев пока нет.</div>
      ) : (
        <div className="admin-comments-list">
          {commentsList.map((comment) => {
            const isBlocked = Boolean(blockedCommentUsers[comment.user])

            return (
              <article key={comment.id} className="admin-comment-card glass-strong">
                <div className="admin-comment-head">
                  <div>
                    <p className="admin-comment-user">
                      {comment.avatar} {comment.user}
                    </p>
                    <p className="admin-comment-meta">
                      Clip ID: {comment.clipId} · {formatCommentDate(comment.createdAt)}
                    </p>
                  </div>
                  {isBlocked && <span className="admin-badge">Пользователь заблокирован</span>}
                </div>

                <p className="admin-comment-text">{comment.text}</p>

                <div className="admin-actions">
                  <button
                    className="admin-action danger"
                    type="button"
                    onClick={() => deleteComment(comment.clipId, comment.id)}
                  >
                    <Trash2 size={16} />
                    Удалить комментарий
                  </button>

                  <button
                    className="admin-action warning"
                    type="button"
                    disabled={isBlocked}
                    onClick={() => blockUserFromComments(comment.user)}
                  >
                    <Ban size={16} />
                    Заблокировать пользователя
                  </button>

                  <button
                    className="admin-action"
                    type="button"
                    onClick={() => deleteAllCommentsByUser(comment.user)}
                  >
                    <MessageSquareX size={16} />
                    Удалить все комментарии пользователя
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
