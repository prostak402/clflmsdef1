import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, ExternalLink, Trash2, Share2 } from 'lucide-react'
import { useApp } from '../context/useApp'
import { createGenreLookup, toClipViewModel } from '../services/clip-view-model'
import { feedService } from '../services/feed-service'
import DataState from '../components/DataState'
import './BookmarksPage.css'

export default function BookmarksPage() {
  const { getBookmarkedClips, toggleBookmark, genres = [] } = useApp()
  const genreLookup = useMemo(() => createGenreLookup(genres), [genres])
  const navigate = useNavigate()
  const [clips, setClips] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })

  const loadBookmarks = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      await feedService.wait(250)
      const items = await getBookmarkedClips()
      setClips(
        (Array.isArray(items) ? items : []).map((clip) => toClipViewModel(clip, genreLookup))
      )
      setLoadState({ status: 'ready', error: '' })
    } catch {
      setLoadState({ status: 'error', error: 'Failed to load bookmarks.' })
    }
  }, [genreLookup, getBookmarkedClips])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookmarks()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadBookmarks])

  const handleShare = async (clip) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title, url: clip.watchUrl })
      } else {
        await navigator.clipboard.writeText(clip.watchUrl)
      }
    } catch {
      // user cancelled share
    }
  }

  const handleRemoveBookmark = async (clipId) => {
    await toggleBookmark(clipId)
    const items = await getBookmarkedClips()
    setClips((Array.isArray(items) ? items : []).map((clip) => toClipViewModel(clip, genreLookup)))
  }

  return (
    <div className="bookmarks-page">
      <div className="bookmarks-header">
        <h1 className="bookmarks-title">
          <Bookmark size={24} />
          Saved Movies
        </h1>
        <p className="bookmarks-subtitle">
          {clips.length} movie{clips.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {loadState.status === 'loading' && (
        <DataState
          variant="loading"
          title="Loading bookmarks"
          description="Collecting your saved clips..."
        />
      )}

      {loadState.status === 'error' && (
        <DataState
          variant="error"
          title="Could not load bookmarks"
          description={loadState.error}
          actionLabel="Retry"
          onAction={loadBookmarks}
        />
      )}

      {loadState.status === 'ready' && clips.length === 0 && (
        <div className="bookmarks-empty">
          <div className="bookmarks-empty-icon">
            <Bookmark size={48} />
          </div>
          <h3>No saved movies yet</h3>
          <p>Bookmark movies from the feed to find them here later</p>
          <button className="bookmarks-explore" onClick={() => navigate('/feed')}>
            Explore Feed
          </button>
        </div>
      )}

      {loadState.status === 'ready' && clips.length > 0 && (
        <div className="bookmarks-grid">
          {clips.map((clip, index) => (
            <div
              key={clip.id}
              className="bookmark-card glass"
              style={{ '--card-delay': `${index * 80}ms` }}
            >
              <div className="bookmark-poster">
                <img src={clip.thumbnailUrl} alt={clip.title} />
                <div className="bookmark-poster-overlay">
                  <button
                    className="bookmark-play"
                    onClick={() => window.open(clip.watchUrl, '_blank')}
                  >
                    <ExternalLink size={20} />
                  </button>
                </div>
              </div>
              <div className="bookmark-info">
                <h3 className="bookmark-title">{clip.title}</h3>
                <div className="bookmark-meta">
                  <span className="bookmark-year">{clip.genreLabel || clip.genreName}</span>
                  <span className="bookmark-rating">{clip.durationLabel}</span>
                </div>
                <p className="bookmark-desc">{clip.description}</p>
                <div className="bookmark-genres">
                  <span className="bookmark-genre">{clip.genreLabel || clip.genreName}</span>
                </div>
                <div className="bookmark-actions">
                  <button
                    className="bookmark-action-btn watch"
                    onClick={() => window.open(clip.watchUrl, '_blank')}
                  >
                    <ExternalLink size={14} />
                    Watch
                  </button>
                  <button className="bookmark-action-btn share" onClick={() => handleShare(clip)}>
                    <Share2 size={14} />
                  </button>
                  <button
                    className="bookmark-action-btn remove"
                    onClick={() => handleRemoveBookmark(clip.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
