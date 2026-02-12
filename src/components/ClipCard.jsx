import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Heart, MessageCircle, Share2, Bookmark, Play, Pause,
  Volume2, VolumeX, Star, ExternalLink, Info
} from 'lucide-react';
import './ClipCard.css';

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function ClipCard({ clip, isActive, onOpenComments }) {
  const { likes, toggleLike, bookmarks, toggleBookmark } = useApp();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  const isLiked = likes[clip.id];
  const isBookmarked = bookmarks.includes(clip.id);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setPlaying(false);
      setProgress(0);
    }
  }, [isActive]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setProgress(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  const handleSeek = (event) => {
    if (!videoRef.current) return;
    const newTime = Number(event.target.value);
    videoRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const handleShare = async () => {
    const shareData = {
      title: clip.title,
      text: `Check out "${clip.title}" on ClipFlow!`,
      url: clip.watchUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(clip.watchUrl);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(clip.watchUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  const handleWatch = () => {
    window.open(clip.watchUrl, '_blank', 'noopener');
  };

  return (
    <div className="clip-card">
      {/* Video */}
      <div className="clip-video-wrap" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={clip.clipUrl}
          loop
          muted={muted}
          playsInline
          preload={isActive ? 'auto' : 'none'}
          className="clip-video"
          poster={clip.poster}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />

        {/* Play/Pause overlay */}
        {!playing && (
          <div className="clip-play-overlay">
            <div className="clip-play-btn">
              <Play size={48} fill="white" />
            </div>
          </div>
        )}

        {/* Gradient overlays */}
        <div className="clip-gradient-top" />
        <div className="clip-gradient-bottom" />
      </div>

      <div className="clip-progress-wrap">
        <input
          type="range"
          className="clip-progress"
          min="0"
          max={duration || 0}
          step="0.01"
          value={Math.min(progress, duration || 0)}
          onClick={(e) => e.stopPropagation()}
          onChange={handleSeek}
          style={{ '--clip-progress': duration ? `${(progress / duration) * 100}%` : '0%' }}
          aria-label={`Seek ${clip.title}`}
        />
      </div>

      {/* Top bar */}
      <div className="clip-top-bar">
        <div className="clip-badge glass">
          <Star size={12} fill="#f59e0b" color="#f59e0b" />
          <span>{clip.rating}</span>
        </div>
        <button
          className="clip-mute-btn glass"
          onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Right action bar */}
      <div className="clip-actions">
        <button
          className={`clip-action-btn ${isLiked ? 'liked' : ''}`}
          onClick={() => toggleLike(clip.id)}
        >
          <div className="clip-action-icon">
            <Heart size={26} fill={isLiked ? '#ec4899' : 'none'} color={isLiked ? '#ec4899' : 'white'} />
          </div>
          <span className="clip-action-count">{formatCount(clip.likes + (isLiked ? 1 : 0))}</span>
        </button>

        <button className="clip-action-btn" onClick={onOpenComments}>
          <div className="clip-action-icon">
            <MessageCircle size={26} />
          </div>
          <span className="clip-action-count">{formatCount(clip.comments)}</span>
        </button>

        <button
          className={`clip-action-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={() => toggleBookmark(clip.id)}
        >
          <div className="clip-action-icon">
            <Bookmark size={26} fill={isBookmarked ? '#f59e0b' : 'none'} color={isBookmarked ? '#f59e0b' : 'white'} />
          </div>
          <span className="clip-action-count">{formatCount(clip.bookmarks)}</span>
        </button>

        <button className="clip-action-btn" onClick={handleShare}>
          <div className="clip-action-icon">
            <Share2 size={24} />
          </div>
          <span className="clip-action-count">{formatCount(clip.shares)}</span>
        </button>

        <button className="clip-action-btn" onClick={() => setShowInfo(!showInfo)}>
          <div className="clip-action-icon">
            <Info size={24} />
          </div>
        </button>
      </div>

      {/* Bottom info */}
      <div className="clip-info">
        <h2 className="clip-movie-title">{clip.title}</h2>
        <p className="clip-movie-desc">{clip.clipDescription}</p>
        <div className="clip-meta">
          <span className="clip-year">{clip.year}</span>
          <span className="clip-separator">•</span>
          <span className="clip-director">{clip.director}</span>
          <span className="clip-separator">•</span>
          <span className="clip-duration">{clip.duration}</span>
        </div>

        <button className="clip-watch-btn" onClick={handleWatch}>
          <ExternalLink size={16} />
          <span>Watch Full Movie</span>
        </button>
      </div>

      {/* Movie detail panel */}
      {showInfo && (
        <div className="clip-detail-panel glass-strong" onClick={() => setShowInfo(false)}>
          <div className="clip-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="clip-detail-header">
              <img src={clip.poster} alt={clip.title} className="clip-detail-poster" />
              <div className="clip-detail-info">
                <h3>{clip.title}</h3>
                <p className="clip-detail-meta">{clip.year} • {clip.duration} • {clip.rating}/10</p>
                <p className="clip-detail-director">Directed by {clip.director}</p>
                <div className="clip-detail-genres">
                  {clip.genres.map((g) => (
                    <span key={g} className="clip-detail-genre">{g}</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="clip-detail-desc">{clip.description}</p>
            <div className="clip-detail-actions">
              <button className="clip-detail-watch" onClick={handleWatch}>
                <ExternalLink size={18} />
                Watch Full Movie
              </button>
              <button
                className={`clip-detail-bookmark ${isBookmarked ? 'active' : ''}`}
                onClick={() => toggleBookmark(clip.id)}
              >
                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
                {isBookmarked ? 'Saved' : 'Save'}
              </button>
              <button className="clip-detail-share" onClick={handleShare}>
                <Share2 size={18} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share toast */}
      {shareToast && (
        <div className="clip-toast glass-strong">
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
}
