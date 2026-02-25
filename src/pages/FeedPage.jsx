import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/useApp'
import { feedService } from '../services/feed-service'
import { EVENT_NAMES, EVENT_SOURCE, EVENT_SURFACE } from '../services/analytics/events'
import PlayerCard from '../components/PlayerCard'
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

export default function FeedPage() {
  const { getFilteredClips, selectedGenres } = useApp()
  const [clips, setClips] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [activeClipId, setActiveClipId] = useState(null)
  const [feedRequestId, setFeedRequestId] = useState('')
  const [impressionMap, setImpressionMap] = useState({})
  const containerRef = useRef(null)
  const isScrolling = useRef(false)

  const loadFeed = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      await feedService.wait(350)
      const nextClips = getFilteredClips()
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
  }, [getFilteredClips, selectedGenres.length])

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
    if (!container || clips.length === 0 || loadState.status !== 'ready') return

    let touchStartY = 0
    let touchStartTime = 0

    const handleWheel = (e) => {
      e.preventDefault()
      if (isScrolling.current) return

      if (e.deltaY > 30 && currentIndex < clips.length - 1) {
        scrollToIndex(currentIndex + 1)
      } else if (e.deltaY < -30 && currentIndex > 0) {
        scrollToIndex(currentIndex - 1)
      }
    }

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = (e) => {
      if (isScrolling.current) return
      const deltaY = touchStartY - e.changedTouches[0].clientY
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

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' && currentIndex < clips.length - 1) {
        e.preventDefault()
        scrollToIndex(currentIndex + 1)
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault()
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
          <div className="feed-container" ref={containerRef}>
            {clips.map((clip, index) => (
              <PlayerCard
                key={clip.id}
                clip={clip}
                position={index}
                isActive={index === currentIndex}
                isNearActive={Math.abs(index - currentIndex) <= 1}
                feedRequestId={feedRequestId}
                impressionId={impressionMap[clip.id]}
                onOpenComments={openComments}
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
