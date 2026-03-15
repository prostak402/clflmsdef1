import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Film, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react'

import { useApp } from '../context/useApp'
import {
  updateClipMetadata,
  uploadClipWithMetadata,
  validateClipFile,
} from '../services/admin-upload-service'
import './AdminPage.css'

const EMPTY_FORM = {
  title: '',
  description: '',
  clipDescription: '',
  watchUrl: '',
  genreIds: [],
  duration: '',
  rating: '',
  kinopoiskId: '',
  poster: '',
  clipFile: null,
  posterFile: null,
}

const UPLOAD_STATUS_LABELS = {
  idle: '',
  uploading: 'Uploading file to storage...',
  finalizing: 'Saving clip metadata...',
  retrying: 'Retrying upload after temporary failure...',
  done: 'Upload completed successfully.',
  failed: 'Upload failed.',
}

function toDurationSeconds(durationValue) {
  const durationMatch = String(durationValue || '').match(/\d+/)
  return Number(durationMatch?.[0]) > 0 ? Number(durationMatch[0]) * 60 : 0
}

function normalizeRatingInput(value) {
  const parsed = Number(String(value ?? '').trim())

  if (!Number.isFinite(parsed)) {
    return null
  }

  const rounded = Math.round(parsed * 10) / 10
  return rounded >= 0 && rounded <= 10 ? rounded : null
}

function normalizeGenreId(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }

  return normalized === 'sci-fi' ? 'scifi' : normalized
}

function normalizeGenreIds(...values) {
  const normalized = []
  const seen = new Set()

  values.flat(Infinity).forEach((value) => {
    const genreId = normalizeGenreId(value)

    if (!genreId || seen.has(genreId)) {
      return
    }

    seen.add(genreId)
    normalized.push(genreId)
  })

  return normalized
}

function resolveFormGenreIds(upload) {
  return normalizeGenreIds(upload?.genreIds)
}

export default function AdminPage() {
  const {
    user,
    genres = [],
    adminUploads,
    addAdminClip,
    updateAdminClip,
    removeAdminUpload,
  } = useApp()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastFailedPayload, setLastFailedPayload] = useState(null)
  const [saveAction, setSaveAction] = useState('create')
  const [editingClipId, setEditingClipId] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [uploadStage, setUploadStage] = useState('idle')
  const [uploadAttempts, setUploadAttempts] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)

  const normalizedFormPayload = useMemo(() => {
    const genreIds = normalizeGenreIds(form.genreIds)

    return {
      title: form.title,
      description: form.description,
      clipDescription: form.clipDescription,
      watchUrl: form.watchUrl,
      genreIds,
      durationSec: toDurationSeconds(form.duration),
      rating: normalizeRatingInput(form.rating),
      videoUrl: '',
      thumbnailUrl: form.poster || '',
      status: 'draft',
    }
  }, [form])

  if (user?.role !== 'admin') {
    return (
      <div className="admin-restricted">
        <AlertTriangle size={48} />
        <h2>Access Denied</h2>
        <p>You need admin privileges to access this page.</p>
        <button onClick={() => navigate('/feed')}>Go to Feed</button>
      </div>
    )
  }

  const handleGenreToggle = (genreId) => {
    setForm((prev) => ({
      ...prev,
      genreIds: prev.genreIds.includes(genreId)
        ? prev.genreIds.filter((currentGenreId) => currentGenreId !== genreId)
        : [...prev.genreIds, genreId],
    }))
  }

  const resetFormState = () => {
    setForm(EMPTY_FORM)
    setEditingClipId('')
    setIsEditMode(false)
    setUploadStage('idle')
    setUploadAttempts('')
  }

  const handleStartEdit = (upload) => {
    const clipId =
      typeof upload.movieId === 'string' && upload.movieId.trim() ? upload.movieId : upload.id

    setShowForm(true)
    setIsEditMode(true)
    setEditingClipId(clipId)
    setForm({
      title: upload.title || '',
      description: upload.description || '',
      clipDescription: upload.clipDescription || upload.description || '',
      watchUrl: upload.watchUrl || '',
      genreIds: resolveFormGenreIds(upload),
      duration: upload.duration || '',
      rating:
        upload.rating === null || upload.rating === undefined || upload.rating === ''
          ? ''
          : String(upload.rating),
      kinopoiskId: upload.kinopoiskId || '',
      poster: upload.poster || '',
      clipFile: null,
      posterFile: null,
    })
  }

  const submitForm = async (payload, { allowRetryStore = true } = {}) => {
    setSubmitError('')
    setIsSubmitting(true)
    setUploadAttempts('')

    try {
      if (!Array.isArray(payload.genreIds) || payload.genreIds.length === 0) {
        setSubmitError('Please select at least one genre.')
        return
      }

      if (payload.rating === null) {
        setSubmitError('Please provide a valid rating between 0 and 10.')
        return
      }

      if (isEditMode) {
        const nextPersistedPayload =
          typeof editingClipId === 'string' &&
          editingClipId.trim() &&
          !editingClipId.startsWith('admin_')
            ? await updateClipMetadata(editingClipId, payload)
            : payload

        const updated = updateAdminClip(editingClipId, nextPersistedPayload || payload)
        if (!updated) {
          setSubmitError('Failed to update clip metadata.')
          return
        }
        setSaveAction('edit')
      } else {
        const clipValidationError = validateClipFile(payload.clipFile)
        if (clipValidationError) {
          setSubmitError(clipValidationError)
          return
        }

        const uploadResult = await uploadClipWithMetadata({
          file: payload.clipFile,
          metadata: {
            title: payload.title,
            description: payload.description,
            clipDescription: payload.clipDescription,
            watchUrl: payload.watchUrl,
            genreIds: payload.genreIds,
            durationSec: payload.durationSec,
            rating: payload.rating,
            videoUrl: payload.videoUrl,
            thumbnailUrl: payload.thumbnailUrl,
            status: payload.status,
            onUploadProgress: ({ stage, attempt, maxAttempts }) => {
              setUploadStage(stage)
              if (Number(maxAttempts) > 1) {
                setUploadAttempts(`Attempt ${attempt}/${maxAttempts}`)
              }
            },
          },
        })

        addAdminClip({
          ...payload,
          id: uploadResult?.clip?.id || payload.id,
          status: 'ready',
        })
        setUploadStage('done')
        setSaveAction('create')
      }

      resetFormState()
      setLastFailedPayload(null)
      setShowForm(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      const nextError = error instanceof Error ? error.message : 'Upload failed. Please try again.'

      setUploadStage('failed')
      setSubmitError(nextError)

      if (allowRetryStore) {
        setLastFailedPayload(payload)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await submitForm({ ...form, ...normalizedFormPayload })
  }

  const uploadStatusLabel = UPLOAD_STATUS_LABELS[uploadStage] || ''

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Admin Panel</h1>
          <p className="admin-subtitle">Manage movie clips</p>
          <Link className="admin-comments-link" to="/admin/comments">
            Go to comments moderation
          </Link>
        </div>
        <button
          type="button"
          data-testid="admin-add-clip"
          className="admin-add-btn"
          onClick={() => {
            if (showForm) {
              resetFormState()
            }
            setShowForm(!showForm)
          }}
        >
          {showForm ? <X size={20} /> : <Plus size={20} />}
          <span>{showForm ? 'Cancel' : 'Add Clip'}</span>
        </button>
      </div>

      {showForm && (
        <form
          className="admin-form glass-strong"
          data-testid="admin-clip-form"
          onSubmit={handleSubmit}
        >
          <h3 className="admin-form-title">
            <Upload size={20} />
            {isEditMode ? 'Edit Clip' : 'Upload New Clip'}
          </h3>

          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Movie Title</label>
              <input
                type="text"
                placeholder="Enter movie title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </div>

            <div className="admin-field">
              <label>Duration</label>
              <input
                type="text"
                placeholder="2h 30m"
                value={form.duration}
                onChange={(event) => setForm({ ...form, duration: event.target.value })}
              />
            </div>

            <div className="admin-field">
              <label>Rating</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                placeholder="8.5"
                value={form.rating}
                onChange={(event) => setForm({ ...form, rating: event.target.value })}
                required
              />
            </div>

            <div className="admin-field full">
              <label>Movie Description</label>
              <textarea
                placeholder="Full movie description..."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                required
              />
            </div>

            <div className="admin-field full">
              <label>Clip Description</label>
              <textarea
                placeholder="Short clip description..."
                value={form.clipDescription}
                onChange={(event) => setForm({ ...form, clipDescription: event.target.value })}
                rows={2}
                required
              />
            </div>

            <div className="admin-field full">
              <label>Watch URL</label>
              <input
                type="url"
                placeholder="https://example.com/watch"
                value={form.watchUrl}
                onChange={(event) => setForm({ ...form, watchUrl: event.target.value })}
                required
              />
            </div>

            <div className="admin-field full">
              <label>Kinopoisk ID</label>
              <div className="admin-kinopoisk-row">
                <input
                  type="text"
                  placeholder="For example: 435"
                  value={form.kinopoiskId}
                  onChange={(event) => setForm({ ...form, kinopoiskId: event.target.value })}
                />
                <button type="button" className="admin-update-btn">
                  Update
                </button>
              </div>
            </div>

            <div className="admin-field full">
              <label>Genres</label>
              <div className="admin-genres">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    className={`admin-genre-chip ${form.genreIds.includes(genre.id) ? 'active' : ''}`}
                    onClick={() => handleGenreToggle(genre.id)}
                    style={{ '--g-color': genre.color }}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
              {genres.length === 0 && <p className="admin-file-name">Genres are loading...</p>}
            </div>

            <div className="admin-field">
              <label>Video Clip</label>
              <div className="admin-upload-zone">
                <Upload size={24} />
                <span>Choose video file</span>
                <input
                  type="file"
                  data-testid="admin-video-file"
                  accept="video/*"
                  onChange={(event) =>
                    setForm({ ...form, clipFile: event.target.files?.[0] || null })
                  }
                />
              </div>
              {form.clipFile && <p className="admin-file-name">{form.clipFile.name}</p>}
            </div>

            <div className="admin-field">
              <label>Poster Image</label>
              <div className="admin-upload-zone">
                <Upload size={24} />
                <span>Choose image</span>
                <input
                  type="file"
                  data-testid="admin-poster-file"
                  accept="image/*"
                  onChange={(event) =>
                    setForm({ ...form, posterFile: event.target.files?.[0] || null })
                  }
                />
              </div>
              {form.posterFile && <p className="admin-file-name">{form.posterFile.name}</p>}
            </div>
          </div>

          <button
            type="submit"
            data-testid="admin-submit-clip"
            className="admin-submit"
            disabled={isSubmitting}
          >
            <Save size={18} />
            {isSubmitting ? 'Uploading...' : isEditMode ? 'Save Changes' : 'Upload Clip'}
          </button>

          {uploadStatusLabel && (
            <p className={`admin-upload-flow-status ${uploadStage}`} role="status">
              <span>{uploadStatusLabel}</span>
              {uploadAttempts && <em>{uploadAttempts}</em>}
            </p>
          )}

          {submitError && (
            <div className="admin-submit-error" role="alert">
              <p>{submitError}</p>
              {lastFailedPayload && !isSubmitting && (
                <button
                  type="button"
                  className="admin-upload-retry"
                  onClick={() => submitForm(lastFailedPayload, { allowRetryStore: false })}
                >
                  Retry upload
                </button>
              )}
            </div>
          )}
        </form>
      )}

      <div className="admin-uploads">
        <h3 className="admin-section-title">Recent Uploads</h3>
        {adminUploads.length === 0 ? (
          <div className="admin-uploads-empty glass">
            <Film size={32} />
            <p>No clips uploaded yet</p>
          </div>
        ) : (
          <div className="admin-upload-list">
            {adminUploads.map((upload) => (
              <div
                key={upload.id}
                className="admin-upload-item glass"
                data-testid={`admin-upload-${upload.id}`}
              >
                <div className="admin-upload-info">
                  <h4>{upload.title}</h4>
                  <p>{upload.createdAt}</p>
                </div>
                <div className={`admin-upload-status ${upload.status}`}>
                  {upload.status === 'processing' ? (
                    <div className="admin-upload-spinner" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>
                    {upload.status === 'processing'
                      ? 'Processing'
                      : upload.status === 'failed'
                        ? 'Failed'
                        : 'Ready'}
                  </span>
                </div>
                <div className="admin-upload-actions">
                  <button
                    type="button"
                    className="admin-upload-edit"
                    data-testid={`admin-edit-${upload.id}`}
                    aria-label={`Edit ${upload.title}`}
                    onClick={() => handleStartEdit(upload)}
                  >
                    <Pencil size={16} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="admin-upload-delete"
                    onClick={() => removeAdminUpload(upload.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {saved && (
        <div className="admin-toast glass-strong">
          <Check size={18} />
          {saveAction === 'edit' ? 'Clip updated successfully!' : 'Clip uploaded successfully!'}
        </div>
      )}
    </div>
  )
}
