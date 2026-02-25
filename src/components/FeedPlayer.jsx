import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

const PLAYER_STATE = {
  LOADING_METADATA: 'loadingMetadata',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
}

const FeedPlayer = forwardRef(function FeedPlayer(
  {
    clipUrl,
    poster,
    muted,
    shouldAutoplay,
    preload,
    onPlaybackStateChange,
    onMetadata,
    onProgress,
    onLayoutInvalidated,
  },
  ref,
) {
  const videoRef = useRef(null)
  const isMountedRef = useRef(false)
  const [playbackState, setPlaybackState] = useState(PLAYER_STATE.LOADING_METADATA)


  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const updatePlaybackState = useCallback((nextState) => {
    setPlaybackState((prevState) => {
      if (!isMountedRef.current) {
        return prevState
      }
      if (prevState === nextState) {
        return prevState
      }

      onPlaybackStateChange?.(nextState)
      return nextState
    })
  }, [onPlaybackStateChange])

  const emitLayoutResolve = useCallback(() => {
    onLayoutInvalidated?.()
  }, [onLayoutInvalidated])

  const safePlay = useCallback((node) => {
    if (!node || typeof node.play !== 'function') return

    const result = node.play()
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        updatePlaybackState(PLAYER_STATE.ERROR)
      })
    }
  }, [updatePlaybackState])

  useImperativeHandle(ref, () => ({
    togglePlayback() {
      const node = videoRef.current
      if (!node) return

      if (node.paused) {
        safePlay(node)
        return
      }

      node.pause()
    },
    seek(time) {
      const node = videoRef.current
      if (!node) return
      node.currentTime = Number(time)
    },
    getCurrentTime() {
      return videoRef.current?.currentTime || 0
    },
    getDuration() {
      return videoRef.current?.duration || 0
    },
  }), [safePlay])

  useEffect(() => {
    const node = videoRef.current
    if (!node) return

    if (shouldAutoplay) {
      safePlay(node)
      return
    }

    node.pause()
  }, [shouldAutoplay, safePlay])


  useEffect(() => {
    let timer = null

    const handleLayoutInvalidation = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        emitLayoutResolve()
      }, 150)
    }

    window.addEventListener('resize', handleLayoutInvalidation)
    window.addEventListener('orientationchange', handleLayoutInvalidation)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', handleLayoutInvalidation)
      window.removeEventListener('orientationchange', handleLayoutInvalidation)
    }
  }, [emitLayoutResolve])

  const handleRetry = () => {
    const node = videoRef.current
    if (!node) return

    updatePlaybackState(PLAYER_STATE.LOADING_METADATA)
    node.load()
    if (shouldAutoplay) {
      safePlay(node)
    }
  }

  return (
    <>
      <video
        key={clipUrl}
        ref={videoRef}
        src={clipUrl}
        loop
        muted={muted}
        playsInline
        preload={preload}
        className="clip-video"
        poster={poster}
        onLoadStart={() => updatePlaybackState(PLAYER_STATE.LOADING_METADATA)}
        onLoadedMetadata={() => {
          const node = videoRef.current
          if (!node) return

          const metadata = {
            duration: node.duration || 0,
            width: node.videoWidth || null,
            height: node.videoHeight || null,
          }

          onMetadata?.(metadata)
          emitLayoutResolve()
          updatePlaybackState(node.paused ? PLAYER_STATE.READY : PLAYER_STATE.PLAYING)
        }}
        onTimeUpdate={() => {
          const node = videoRef.current
          if (!node) return
          onProgress?.(node.currentTime)
        }}
        onPlay={() => updatePlaybackState(PLAYER_STATE.PLAYING)}
        onPause={() => updatePlaybackState(PLAYER_STATE.PAUSED)}
        onError={() => updatePlaybackState(PLAYER_STATE.ERROR)}
      />

      {playbackState === PLAYER_STATE.ERROR && (
        <div className="clip-error-fallback">
          <img src={poster} alt="Playback fallback" className="clip-error-poster" />
          <button className="clip-error-retry" onClick={handleRetry}>Retry</button>
        </div>
      )}
    </>
  )
})

export { PLAYER_STATE }
export default FeedPlayer
