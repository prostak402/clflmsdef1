import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

const PLAYER_STATE = {
  LOADING_METADATA: 'loadingMetadata',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
}

const ORIENTATION_RESTORE_DELAY = 120

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
  ref
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

  const updatePlaybackState = useCallback(
    (nextState) => {
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
    },
    [onPlaybackStateChange]
  )

  const emitLayoutResolve = useCallback(
    (snapshot) => {
      onLayoutInvalidated?.(snapshot)
    },
    [onLayoutInvalidated]
  )

  const safePlay = useCallback(
    (node) => {
      if (!node || typeof node.play !== 'function') return

      const result = node.play()
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          updatePlaybackState(PLAYER_STATE.ERROR)
        })
      }
    },
    [updatePlaybackState]
  )

  const pauseAndDispose = useCallback(() => {
    const node = videoRef.current
    if (!node) {
      return
    }

    node.pause()
    node.removeAttribute('src')
    node.load()
    updatePlaybackState(PLAYER_STATE.PAUSED)
  }, [updatePlaybackState])

  useImperativeHandle(
    ref,
    () => ({
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
      pauseAndDispose,
    }),
    [pauseAndDispose, safePlay]
  )

  const shouldHydrate = shouldAutoplay || preload !== 'none'

  useEffect(() => {
    if (!shouldHydrate) {
      pauseAndDispose()
      return
    }

    updatePlaybackState(PLAYER_STATE.LOADING_METADATA)
  }, [pauseAndDispose, shouldHydrate, updatePlaybackState])

  useEffect(() => {
    const node = videoRef.current
    if (!node || !shouldHydrate) return

    if (shouldAutoplay) {
      safePlay(node)
      return
    }

    node.pause()
  }, [shouldAutoplay, shouldHydrate, safePlay])

  useEffect(() => {
    let timer = null

    const handleLayoutInvalidation = (isOrientationChange = false) => {
      const node = videoRef.current
      const snapshot = {
        currentTime: node?.currentTime || 0,
        wasPlaying: Boolean(node && !node.paused),
        isOrientationChange,
      }

      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        emitLayoutResolve(snapshot)

        if (!isOrientationChange || !node) {
          return
        }

        const restoreAt = snapshot.currentTime
        const shouldResume = snapshot.wasPlaying
        window.setTimeout(() => {
          if (!videoRef.current || !shouldHydrate) {
            return
          }

          videoRef.current.currentTime = restoreAt
          if (shouldResume) {
            safePlay(videoRef.current)
          }
        }, ORIENTATION_RESTORE_DELAY)
      }, 120)
    }

    const onResize = () => handleLayoutInvalidation(false)
    const onOrientation = () => handleLayoutInvalidation(true)

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
    }
  }, [emitLayoutResolve, safePlay, shouldHydrate])

  const handleRetry = () => {
    const node = videoRef.current
    if (!node) return

    updatePlaybackState(PLAYER_STATE.LOADING_METADATA)
    node.load()
    if (shouldAutoplay) {
      safePlay(node)
    }
  }

  const effectiveSrc = shouldHydrate ? clipUrl : undefined

  return (
    <>
      <video
        key={clipUrl}
        ref={videoRef}
        src={effectiveSrc}
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
          <p className="clip-error-message">
            Не удалось воспроизвести ролик. Проверьте сеть и попробуйте снова.
          </p>
          <button className="clip-error-retry" onClick={handleRetry}>
            Повторить загрузку
          </button>
        </div>
      )}
    </>
  )
})

export { PLAYER_STATE }
export default FeedPlayer
