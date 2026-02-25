import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import { feedService } from '../services/feed-service'
import {
  EVENT_NAMES,
  EVENT_SOURCE,
  EVENT_SURFACE,
  VIEW_THRESHOLD,
} from '../services/analytics/events'
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Play,
  Volume2,
  VolumeX,
  Star,
  ExternalLink,
  Info,
} from 'lucide-react'
import { detectViewportType, resolveOverlayLayout } from '../feed/player-layout-rules'
import FeedPlayer, { PLAYER_STATE } from './FeedPlayer'
import './ClipCard.css'

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const THRESHOLDS = [
  { rate: 0.25, value: VIEW_THRESHOLD.P25 },
  { rate: 0.5, value: VIEW_THRESHOLD.P50 },
  { rate: 0.75, value: VIEW_THRESHOLD.P75 },
  { rate: 0.95, value: VIEW_THRESHOLD.P95 },
]

export default function PlayerCard({ clip, isActive, onOpenComments, position, feedRequestId, impressionId }) {
  const { likes, toggleLike, bookmarks, toggleBookmark } = useApp()
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [videoMetadata, setVideoMetadata] = useState({ width: null, height: null })
  const [viewportType, setViewportType] = useState(() => detectViewportType())
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [isInViewport, setIsInViewport] = useState(false)
  const playerRef = useRef(null)
  const videoWrapRef = useRef(null)
  const cardRef = useRef(null)
  const playSequenceRef = useRef(0)
  const thresholdsSentRef = useRef(new Set())
  const wasAutoplayingRef = useRef(false)

  const isLiked = likes[clip.id]
  const isBookmarked = bookmarks.includes(clip.id)
  const shouldAutoplay = isActive && isInViewport

  const trackEvent = useCallback((event, payload) => {
    if (!feedRequestId || !impressionId) {
      return
    }

    feedService.trackEvent(event, {
      ...payload,
      clipId: clip.id,
      impressionId,
      position,
      feedRequestId,
      source: EVENT_SOURCE.CLIENT,
      surface: EVENT_SURFACE.FEED,
    })
  }, [clip.id, feedRequestId, impressionId, position])

  const getDurationMs = useCallback(() => {
    const mediaDuration = Number(playerRef.current?.getDuration() || duration || 0)
    return Math.max(0, Math.round(mediaDuration * 1000))
  }, [duration])

  const getWatchStats = useCallback(() => {
    const watchMs = Math.max(0, Math.round((playerRef.current?.getCurrentTime() || progress || 0) * 1000))
    const clipDurationMs = Math.max(getDurationMs(), 1)
    const completionRate = Math.min(1, watchMs / clipDurationMs)

    return {
      watchMs,
      clipDurationMs,
      completionRate,
    }
  }, [getDurationMs, progress])

  const emitViewEnded = useCallback((reason) => {
    if (!feedRequestId || !impressionId || playSequenceRef.current === 0) {
      return
    }

    const { watchMs, clipDurationMs, completionRate } = getWatchStats()

    trackEvent(EVENT_NAMES.CLIP_VIEW_ENDED, {
      watchMs,
      clipDurationMs,
      completionRate,
      playSequence: playSequenceRef.current,
      endReason: reason,
    })
  }, [feedRequestId, getWatchStats, impressionId, trackEvent])

  useEffect(() => {
    if (wasAutoplayingRef.current && !shouldAutoplay && progress > 0) {
      emitViewEnded('scrolled_away')
    }

    wasAutoplayingRef.current = shouldAutoplay
  }, [emitViewEnded, progress, shouldAutoplay])

  useEffect(() => {
    return () => {
      emitViewEnded('swiped_away')
    }
  }, [emitViewEnded])

  useEffect(() => {
    thresholdsSentRef.current = new Set()
  }, [impressionId])

  useEffect(() => {
    const handleResize = () => {
      setViewportType(detectViewportType())
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!videoWrapRef.current) {
      return
    }

    const node = videoWrapRef.current
    const updateRect = () => {
      const rect = node.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }

    updateRect()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(node)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!cardRef.current) return

    const node = cardRef.current
    if (typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting && entry.intersectionRatio > 0.6)
      },
      { threshold: [0.6] },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const overlayLayout = resolveOverlayLayout({
    viewportType,
    videoWidth: videoMetadata.width,
    videoHeight: videoMetadata.height,
    containerWidth: containerSize.width,
    containerHeight: containerSize.height,
    layoutVersion,
  })
  const playerLayout = overlayLayout.playerLayout

  const overlayStyle = {
    '--content-left': `${overlayLayout.contentRect.x}px`,
    '--content-top': `${overlayLayout.contentRect.y}px`,
    '--content-width': `${overlayLayout.contentRect.width}px`,
    '--content-height': `${overlayLayout.contentRect.height}px`,
    '--content-right': `${Math.max(0, containerSize.width - (overlayLayout.contentRect.x + overlayLayout.contentRect.width))}px`,
    '--content-bottom': `${Math.max(0, containerSize.height - (overlayLayout.contentRect.y + overlayLayout.contentRect.height))}px`,
    '--overlay-inset-top': `${overlayLayout.overlaySafeInsets.top}px`,
    '--overlay-inset-right': `${overlayLayout.overlaySafeInsets.right}px`,
    '--overlay-inset-bottom': `${overlayLayout.overlaySafeInsets.bottom}px`,
    '--overlay-inset-left': `${overlayLayout.overlaySafeInsets.left}px`,
    '--bar-top': `${overlayLayout.contentRect.bars.top}px`,
    '--bar-bottom': `${overlayLayout.contentRect.bars.bottom}px`,
  }

  const handleSeek = (event) => {
    const newTime = Number(event.target.value)
    playerRef.current?.seek(newTime)
    setProgress(newTime)
  }

  const togglePlay = () => {
    playerRef.current?.togglePlayback()
  }

  const handleShare = async () => {
    const shareData = {
      title: clip.title,
      text: `Check out "${clip.title}" on ClipFlow!`,
      url: clip.watchUrl,
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(clip.watchUrl)
        setShareToast(true)
        setTimeout(() => setShareToast(false), 2000)
      }
    } catch {
      await navigator.clipboard.writeText(clip.watchUrl)
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2000)
    }
  }

  const handleWatch = () => {
    window.open(clip.watchUrl, '_blank', 'noopener')
  }

  const handleToggleLike = () => {
    const value = !isLiked
    toggleLike(clip.id)
    trackEvent(EVENT_NAMES.LIKE_SET, { value })
  }

  const handleToggleBookmark = () => {
    const value = !isBookmarked
    toggleBookmark(clip.id)
    trackEvent(EVENT_NAMES.BOOKMARK_SET, { value })
  }

  return (
    <div
      className={`clip-card clip-card--overlay-${overlayLayout.overlayAnchor}`}
      style={overlayStyle}
      ref={cardRef}
    >
      <div
        className={`clip-video-wrap clip-video-wrap--${playerLayout.container}`}
        ref={videoWrapRef}
        onClick={togglePlay}
      >
        <FeedPlayer
          ref={playerRef}
          clipUrl={clip.clipUrl}
          poster={clip.poster}
          muted={muted}
          preload={isActive ? 'auto' : 'none'}
          shouldAutoplay={shouldAutoplay}
          onMetadata={({ duration: nextDuration, width, height }) => {
            setDuration(nextDuration)
            setVideoMetadata({ width, height })
          }}
          onProgress={(currentProgress) => {
            setProgress(currentProgress)
            const watchMs = Math.max(0, Math.round(currentProgress * 1000))
            const clipDurationMs = Math.max(getDurationMs(), 1)
            const completionRate = Math.min(1, watchMs / clipDurationMs)

            THRESHOLDS.forEach(({ rate, value }) => {
              const dedupeKey = `${impressionId}:${value}`
              if (completionRate < rate || thresholdsSentRef.current.has(dedupeKey)) {
                return
              }

              thresholdsSentRef.current.add(dedupeKey)
              trackEvent(EVENT_NAMES.CLIP_VIEW_THRESHOLD, {
                watchMs,
                clipDurationMs,
                completionRate,
                threshold: value,
              })
            })
          }}
          onLayoutInvalidated={() => {
            setViewportType(detectViewportType())
            setLayoutVersion((prev) => prev + 1)
          }}
          onPlaybackStateChange={(state) => {
            setPlaying(state === PLAYER_STATE.PLAYING)

            if (state === PLAYER_STATE.PLAYING) {
              playSequenceRef.current += 1
              trackEvent(EVENT_NAMES.CLIP_PLAY_STARTED, {
                clipDurationMs: getDurationMs(),
                playSequence: playSequenceRef.current,
              })
            }
          }}
        />

        {!playing && (
          <div className="clip-play-overlay">
            <div className="clip-play-btn">
              <Play size={48} fill="white" />
            </div>
          </div>
        )}

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

      <div className="clip-top-bar">
        <div className="clip-badge glass">
          <Star size={12} fill="#f59e0b" color="#f59e0b" />
          <span>{clip.rating}</span>
        </div>
        <button
          className="clip-mute-btn glass"
          onClick={(e) => {
            e.stopPropagation()
            setMuted(!muted)
          }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="clip-actions">
        <button className={`clip-action-btn ${isLiked ? 'liked' : ''}`} onClick={handleToggleLike}>
          <div className="clip-action-icon">
            <Heart
              size={26}
              fill={isLiked ? '#ec4899' : 'none'}
              color={isLiked ? '#ec4899' : 'white'}
            />
          </div>
          <span className="clip-action-count">{formatCount(clip.likes + (isLiked ? 1 : 0))}</span>
        </button>

        <button
          className="clip-action-btn"
          onClick={() => onOpenComments({ clipId: clip.id, impressionId, position })}
        >
          <div className="clip-action-icon">
            <MessageCircle size={26} />
          </div>
          <span className="clip-action-count">{formatCount(clip.comments)}</span>
        </button>

        <button
          className={`clip-action-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleToggleBookmark}
        >
          <div className="clip-action-icon">
            <Bookmark
              size={26}
              fill={isBookmarked ? '#f59e0b' : 'none'}
              color={isBookmarked ? '#f59e0b' : 'white'}
            />
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

      <div className="clip-info">
        <h2 className="clip-movie-title" title={clip.title}>{clip.title}</h2>
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

      {showInfo && (
        <div className="clip-detail-panel glass-strong" onClick={() => setShowInfo(false)}>
          <div className="clip-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="clip-detail-header">
              <img src={clip.poster} alt={clip.title} className="clip-detail-poster" />
              <div className="clip-detail-info">
                <h3>{clip.title}</h3>
                <p className="clip-detail-meta">
                  {clip.year} • {clip.duration} • {clip.rating}/10
                </p>
                <p className="clip-detail-director">Directed by {clip.director}</p>
                <div className="clip-detail-genres">
                  {clip.genres.map((g) => (
                    <span key={g} className="clip-detail-genre">
                      {g}
                    </span>
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
                onClick={handleToggleBookmark}
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

      {shareToast && <div className="clip-toast glass-strong">Link copied to clipboard!</div>}
    </div>
  )
}
