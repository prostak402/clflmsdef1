import { useApp } from '../context/useApp';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ExternalLink, Trash2, Share2, Star } from 'lucide-react';
import './BookmarksPage.css';

export default function BookmarksPage() {
  const { getBookmarkedClips, toggleBookmark } = useApp();
  const navigate = useNavigate();
  const clips = getBookmarkedClips();

  const handleShare = async (clip) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: clip.title, url: clip.watchUrl });
      } else {
        await navigator.clipboard.writeText(clip.watchUrl);
      }
    } catch {
      // user cancelled share
    }
  };

  return (
    <div className="bookmarks-page">
      <div className="bookmarks-header">
        <h1 className="bookmarks-title">
          <Bookmark size={24} />
          Saved Movies
        </h1>
        <p className="bookmarks-subtitle">{clips.length} movie{clips.length !== 1 ? 's' : ''} saved</p>
      </div>

      {clips.length === 0 ? (
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
      ) : (
        <div className="bookmarks-grid">
          {clips.map((clip, index) => (
            <div
              key={clip.id}
              className="bookmark-card glass"
              style={{ '--card-delay': `${index * 80}ms` }}
            >
              <div className="bookmark-poster">
                <img src={clip.poster} alt={clip.title} />
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
                  <span className="bookmark-year">{clip.year}</span>
                  <span className="bookmark-rating">
                    <Star size={12} fill="#f59e0b" color="#f59e0b" />
                    {clip.rating}
                  </span>
                </div>
                <p className="bookmark-desc">{clip.description}</p>
                <div className="bookmark-genres">
                  {clip.genres.slice(0, 3).map((g) => (
                    <span key={g} className="bookmark-genre">{g}</span>
                  ))}
                </div>
                <div className="bookmark-actions">
                  <button
                    className="bookmark-action-btn watch"
                    onClick={() => window.open(clip.watchUrl, '_blank')}
                  >
                    <ExternalLink size={14} />
                    Watch
                  </button>
                  <button
                    className="bookmark-action-btn share"
                    onClick={() => handleShare(clip)}
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    className="bookmark-action-btn remove"
                    onClick={() => toggleBookmark(clip.id)}
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
  );
}
