import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { createGenreLookup, toClipViewModel } from '../services/clip-view-model'
import { EVENT_NAMES, EVENT_SOURCE, EVENT_SURFACE } from '../services/analytics/events'
import { feedService } from '../services/feed-service'
import ClipCard from '../components/ClipCard'
import CommentsPanel from '../components/CommentsPanel'
import GenrePickerFloat from '../components/GenrePickerFloat'
import DataState from '../components/DataState'
import './FeedPage.css'

function createTrackingId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const MAX_ACTIVE_CLIP_ASPECT_RATIO = 1.5777777777777777

export default function FeedPage() {
  const { getFilteredClips, selectedGenres, genres = [] } = useApp()
  const genreLookup = useMemo(() => createGenreLookup(genres), [genres])
  const [clips, setClips] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [activeClipId, setActiveClipId] = useState(null)
  const [feedRequestId, setFeedRequestId] = useState('')
  const [impressionMap, setImpressionMap] = useState({})
  const [clipAspectRatios, setClipAspectRatios] = useState({})
  const containerRef = useRef(null)
  const isScrolling = useRef(false)

  const loadFeed = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      await feedService.wait(350)
      const rawClips = await getFilteredClips()
      const nextClips = (Array.isArray(rawClips) ? rawClips : []).map((clip) =>
        toClipViewModel(clip, genreLookup)
      )
      const nextFeedRequestId = createTrackingId('feed')
      const nextImpressionMap = nextClips.reduce((acc, clip) => {
        acc[clip.id] = createTrackingId('impr')
        return acc
      }, {})

      setClips(nextClips)
      setFeedRequestId(nextFeedRequestId)
      setImpressionMap(nextImpressionMap)
      setLoadState({ status: 'ready', error: '' })
      setCurrentIndex(0)

      feedService.trackEvent(EVENT_NAMES.FEED_OPENED, {
        feedRequestId: nextFeedRequestId,
        source: EVENT_SOURCE.CLIENT,
        surface: EVENT_SURFACE.FEED,
        selectedGenresCount: selectedGenres.length,
      })
    } catch {
      setLoadState({ status: 'error', error: 'Failed to load feed. Please try again.' })
    }
  }, [genreLookup, getFilteredClips, selectedGenres.length])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFeed()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadFeed])

  useEffect(() => {
    const activeClip = clips[currentIndex]
    if (!activeClip || !feedRequestId) {
      return
    }

    const impressionId = impressionMap[activeClip.id]
    if (!impressionId) {
      return
    }

    feedService.trackEvent(EVENT_NAMES.CLIP_IMPRESSION, {
      clipId: activeClip.id,
      impressionId,
      position: currentIndex,
      feedRequestId,
      source: EVENT_SOURCE.CLIENT,
      surface: EVENT_SURFACE.FEED,
    })
  }, [clips, currentIndex, feedRequestId, impressionMap])

  const scrollToIndex = useCallback((index) => {
    if (containerRef.current && !isScrolling.current) {
      isScrolling.current = true
      const target = containerRef.current.children[index]
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setCurrentIndex(index)
        setTimeout(() => {
          isScrolling.current = false
        }, 600)
      }
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || clips.length === 0 || loadState.status !== 'ready') {
      return undefined
    }

    let touchStartY = 0
    let touchStartTime = 0

    const handleWheel = (event) => {
      event.preventDefault()
      if (isScrolling.current) {
        return
      }

      if (event.deltaY > 30 && currentIndex < clips.length - 1) {
        scrollToIndex(currentIndex + 1)
      } else if (event.deltaY < -30 && currentIndex > 0) {
        scrollToIndex(currentIndex - 1)
      }
    }

    const handleTouchStart = (event) => {
      touchStartY = event.touches[0].clientY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = (event) => {
      if (isScrolling.current) {
        return
      }

      const deltaY = touchStartY - event.changedTouches[0].clientY
      const deltaTime = Date.now() - touchStartTime
      const velocity = Math.abs(deltaY) / deltaTime

      if (Math.abs(deltaY) > 50 || velocity > 0.5) {
        if (deltaY > 0 && currentIndex < clips.length - 1) {
          scrollToIndex(currentIndex + 1)
        } else if (deltaY < 0 && currentIndex > 0) {
          scrollToIndex(currentIndex - 1)
        }
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'ArrowDown' && currentIndex < clips.length - 1) {
        event.preventDefault()
        scrollToIndex(currentIndex + 1)
      } else if (event.key === 'ArrowUp' && currentIndex > 0) {
        event.preventDefault()
        scrollToIndex(currentIndex - 1)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [clips.length, currentIndex, loadState.status, scrollToIndex])

  const openComments = ({ clipId, position, impressionId }) => {
    setActiveClipId(clipId)
    setCurrentIndex(position)
    setImpressionMap((prev) => {
      if (!impressionId || prev[clipId] === impressionId) {
        return prev
      }

      return {
        ...prev,
        [clipId]: impressionId,
      }
    })
    setCommentsOpen(true)
  }

  const activeClipPosition = clips.findIndex((clip) => clip.id === activeClipId)
  const currentClipId = clips[currentIndex]?.id
  const activeAspectRatio = currentClipId ? clipAspectRatios[currentClipId] : undefined
  const visibleAspectRatio = activeAspectRatio
    ? Math.min(activeAspectRatio, MAX_ACTIVE_CLIP_ASPECT_RATIO)
    : undefined

  const handleAspectRatioDetected = useCallback((clipId, aspectRatio) => {
    if (!clipId || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      return
    }

    setClipAspectRatios((prev) => {
      if (prev[clipId] === aspectRatio) {
        return prev
      }

      return {
        ...prev,
        [clipId]: aspectRatio,
      }
    })
  }, [])

  return (
    <div className="feed-page">
      <GenrePickerFloat />

      {loadState.status === 'loading' && (
        <DataState
          variant="loading"
          title="Loading clips"
          description="Preparing your personalized feed..."
        />
      )}

      {loadState.status === 'error' && (
        <DataState
          variant="error"
          title="Could not load clips"
          description={loadState.error}
          actionLabel="Retry"
          onAction={loadFeed}
        />
      )}

      {loadState.status === 'ready' && clips.length === 0 && (
        <DataState
          title="No clips found"
          description="No clips match your selected genres. Try changing preferences."
        />
      )}

      {loadState.status === 'ready' && clips.length > 0 && (
        <>
          <div
            className="feed-container"
            ref={containerRef}
            style={
              visibleAspectRatio
                ? {
                    '--active-clip-aspect-ratio': visibleAspectRatio,
                  }
                : undefined
            }
          >
            {clips.map((clip, index) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                position={index}
                isActive={index === currentIndex}
                feedRequestId={feedRequestId}
                impressionId={impressionMap[clip.id]}
                onOpenComments={openComments}
                onAspectRatioDetected={handleAspectRatioDetected}
              />
            ))}
          </div>

          {commentsOpen && (
            <CommentsPanel
              clipId={activeClipId}
              position={activeClipPosition}
              feedRequestId={feedRequestId}
              impressionId={activeClipId ? impressionMap[activeClipId] : null}
              onClose={() => setCommentsOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
