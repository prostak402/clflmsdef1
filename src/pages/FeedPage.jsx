import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/useApp';
import { feedService } from '../services/feed-service';
import ClipCard from '../components/ClipCard';
import CommentsPanel from '../components/CommentsPanel';
import GenrePickerFloat from '../components/GenrePickerFloat';
import DataState from '../components/DataState';
import './FeedPage.css';

export default function FeedPage() {
  const { getFilteredClips } = useApp();
  const [clips, setClips] = useState([]);
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeClipId, setActiveClipId] = useState(null);
  const containerRef = useRef(null);
  const isScrolling = useRef(false);

  const loadFeed = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' });

    try {
      await feedService.wait(350);
      const nextClips = getFilteredClips();
      setClips(nextClips);
      setLoadState({ status: 'ready', error: '' });
      setCurrentIndex(0);
    } catch {
      setLoadState({ status: 'error', error: 'Failed to load feed. Please try again.' });
    }
  }, [getFilteredClips]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFeed();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  const scrollToIndex = useCallback((index) => {
    if (containerRef.current && !isScrolling.current) {
      isScrolling.current = true;
      const target = containerRef.current.children[index];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setCurrentIndex(index);
        setTimeout(() => {
          isScrolling.current = false;
        }, 600);
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || clips.length === 0 || loadState.status !== 'ready') return;

    let touchStartY = 0;
    let touchStartTime = 0;

    const handleWheel = (e) => {
      e.preventDefault();
      if (isScrolling.current) return;

      if (e.deltaY > 30 && currentIndex < clips.length - 1) {
        scrollToIndex(currentIndex + 1);
      } else if (e.deltaY < -30 && currentIndex > 0) {
        scrollToIndex(currentIndex - 1);
      }
    };

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e) => {
      if (isScrolling.current) return;
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      const deltaTime = Date.now() - touchStartTime;
      const velocity = Math.abs(deltaY) / deltaTime;

      if (Math.abs(deltaY) > 50 || velocity > 0.5) {
        if (deltaY > 0 && currentIndex < clips.length - 1) {
          scrollToIndex(currentIndex + 1);
        } else if (deltaY < 0 && currentIndex > 0) {
          scrollToIndex(currentIndex - 1);
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' && currentIndex < clips.length - 1) {
        e.preventDefault();
        scrollToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        scrollToIndex(currentIndex - 1);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [clips.length, currentIndex, loadState.status, scrollToIndex]);

  const openComments = (clipId) => {
    setActiveClipId(clipId);
    setCommentsOpen(true);
  };

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
              <ClipCard
                key={clip.id}
                clip={clip}
                isActive={index === currentIndex}
                onOpenComments={() => openComments(clip.id)}
              />
            ))}
          </div>

          {commentsOpen && (
            <CommentsPanel clipId={activeClipId} onClose={() => setCommentsOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}
