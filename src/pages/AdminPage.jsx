import { useState } from 'react'
import { useApp } from '../context/useApp'
import { Link, useNavigate } from 'react-router-dom'
import {
  Upload,
  Film,
  Plus,
  Trash2,
  X,
  Save,
  AlertTriangle,
  Check,
  Link as LinkIcon,
  Pencil,
} from 'lucide-react'
import { contentService } from '../services/content-service'
import './AdminPage.css'

export default function AdminPage() {
  const { user, adminUploads, addAdminClip, updateAdminClip, removeAdminUpload } = useApp()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveAction, setSaveAction] = useState('create')
  const [editingClipId, setEditingClipId] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  const emptyForm = {
    title: '',
    description: '',
    clipDescription: '',
    genres: [],
    year: '',
    director: '',
    duration: '',
    kinopoiskId: '',
    watchUrl: '',
    poster: '',
    clipFile: null,
    posterFile: null,
  }

  const [form, setForm] = useState({
    title: '',
    description: '',
    clipDescription: '',
    genres: [],
    year: '',
    director: '',
    duration: '',
    kinopoiskId: '',
    watchUrl: '',
    poster: '',
    clipFile: null,
    posterFile: null,
  })

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

  const handleGenreToggle = (genreId) => {
    setForm((prev) => ({
      ...prev,
      genres: prev.genres.includes(genreId)
        ? prev.genres.filter((g) => g !== genreId)
        : [...prev.genres, genreId],
    }))
  }

  const resetFormState = () => {
    setForm(emptyForm)
    setEditingClipId('')
    setIsEditMode(false)
  }

  const handleStartEdit = (upload) => {
    const clipId = typeof upload.movieId === 'string' && upload.movieId.trim() ? upload.movieId : upload.id

    setShowForm(true)
    setIsEditMode(true)
    setEditingClipId(clipId)
    setForm({
      title: upload.title || '',
      description: upload.description || '',
      clipDescription: upload.clipDescription || '',
      genres: upload.genres || [],
      year: upload.year || '',
      director: upload.director || '',
      duration: upload.duration || '',
      kinopoiskId: upload.kinopoiskId || '',
      watchUrl: upload.watchUrl || '',
      poster: upload.poster || '',
      clipFile: null,
      posterFile: null,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (isEditMode) {
      const updated = updateAdminClip(editingClipId, form)
      if (!updated) {
        return
      }
      setSaveAction('edit')
    } else {
      addAdminClip(form)
      setSaveAction('create')
    }

    resetFormState()
    setShowForm(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

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
        <form className="admin-form glass-strong" onSubmit={handleSubmit}>
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
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="admin-field">
              <label>Year</label>
              <input
                type="number"
                placeholder="2024"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                required
              />
            </div>

            <div className="admin-field">
              <label>Duration</label>
              <input
                type="text"
                placeholder="2h 30m"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </div>

            <div className="admin-field full">
              <label>Director</label>
              <input
                type="text"
                placeholder="Director name"
                value={form.director}
                onChange={(e) => setForm({ ...form, director: e.target.value })}
              />
            </div>

            <div className="admin-field full">
              <label>Movie Description</label>
              <textarea
                placeholder="Full movie description..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="admin-field full">
              <label>Clip Description</label>
              <textarea
                placeholder="What happens in this clip..."
                value={form.clipDescription}
                onChange={(e) => setForm({ ...form, clipDescription: e.target.value })}
                rows={2}
              />
            </div>

            <div className="admin-field full">
              <label>Kinopoisk ID</label>
              <div className="admin-kinopoisk-row">
                <input
                  type="text"
                  placeholder="Например: 435"
                  value={form.kinopoiskId}
                  onChange={(e) => setForm({ ...form, kinopoiskId: e.target.value })}
                />
                <button type="button" className="admin-update-btn">
                  Update
                </button>
              </div>
            </div>

            <div className="admin-field full">
              <label>
                <LinkIcon size={14} />
                Watch URL (your cinema site)
              </label>
              <input
                type="url"
                placeholder="https://your-cinema-site.com/watch/movie"
                value={form.watchUrl}
                onChange={(e) => setForm({ ...form, watchUrl: e.target.value })}
                required
              />
            </div>

            <div className="admin-field full">
              <label>Genres</label>
              <div className="admin-genres">
                {contentService.getGenres().map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    className={`admin-genre-chip ${form.genres.includes(genre.id) ? 'active' : ''}`}
                    onClick={() => handleGenreToggle(genre.id)}
                    style={{ '--g-color': genre.color }}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-field">
              <label>Video Clip</label>
              <div className="admin-upload-zone">
                <Upload size={24} />
                <span>Choose video file</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setForm({ ...form, clipFile: e.target.files[0] })}
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
                  accept="image/*"
                  onChange={(e) => setForm({ ...form, posterFile: e.target.files[0] })}
                />
              </div>
              {form.posterFile && <p className="admin-file-name">{form.posterFile.name}</p>}
            </div>
          </div>

          <button type="submit" className="admin-submit">
            <Save size={18} />
            {isEditMode ? 'Save Changes' : 'Upload Clip'}
          </button>
        </form>
      )}

      {/* Upload list */}
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
              <div key={upload.id} className="admin-upload-item glass">
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
                  <span>{upload.status === 'processing' ? 'Processing' : 'Ready'}</span>
                </div>
                <div className="admin-upload-actions">
                  <button
                    type="button"
                    className="admin-upload-edit"
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
