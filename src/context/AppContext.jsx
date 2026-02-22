import { useState, useCallback, useEffect } from 'react';
import { GENRE_SELECTION_MAX } from '../constants/onboarding';
import { feedService } from '../services/feed-service';

import { AppContext } from './app-context';

const STORAGE_KEY = 'clipflow.app-state';

const DEFAULT_DRAFT_PREFERENCES = {
  notificationsEnabled: true,
  autoplayEnabled: true,
  preferredLanguage: 'en',
};

const DEFAULT_STATE = {
  user: null,
  hasCompletedOnboarding: false,
  selectedGenres: [],
  bookmarks: [],
  likes: {},
  draftPreferences: DEFAULT_DRAFT_PREFERENCES,
};

function sanitizeState(value) {
  if (!value || typeof value !== 'object') {
    return DEFAULT_STATE;
  }

  return {
    user: value.user && typeof value.user === 'object' ? value.user : null,
    hasCompletedOnboarding: Boolean(value.hasCompletedOnboarding),
    selectedGenres: Array.isArray(value.selectedGenres) ? value.selectedGenres : [],
    bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [],
    likes: value.likes && typeof value.likes === 'object' ? value.likes : {},
    draftPreferences:
      value.draftPreferences && typeof value.draftPreferences === 'object'
        ? { ...DEFAULT_DRAFT_PREFERENCES, ...value.draftPreferences }
        : DEFAULT_DRAFT_PREFERENCES,
  };
}

function readPersistedState() {
  if (typeof window === 'undefined') return DEFAULT_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return sanitizeState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

export function AppProvider({ children }) {
  const [persistedState] = useState(() => readPersistedState());

  const [user, setUser] = useState(persistedState.user);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(persistedState.hasCompletedOnboarding);
  const [selectedGenres, setSelectedGenres] = useState(persistedState.selectedGenres);
  const [bookmarks, setBookmarks] = useState(persistedState.bookmarks);
  const [likes, setLikes] = useState(persistedState.likes);
  const [draftPreferences, setDraftPreferences] = useState(persistedState.draftPreferences);
  const [comments, setComments] = useState(feedService.getInitialComments());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user,
        hasCompletedOnboarding,
        selectedGenres,
        bookmarks,
        likes,
        draftPreferences,
      })
    );
  }, [user, hasCompletedOnboarding, selectedGenres, bookmarks, likes, draftPreferences]);

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setHasCompletedOnboarding(false);
    setSelectedGenres([]);
    setBookmarks([]);
    setLikes({});
    setDraftPreferences(DEFAULT_DRAFT_PREFERENCES);
  }, []);

  const toggleGenre = useCallback((genreId) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((g) => g !== genreId);
      }

      if (prev.length >= GENRE_SELECTION_MAX) {
        return prev;
      }

      return [...prev, genreId];
    });
  }, []);

  const toggleBookmark = useCallback(async (clipId) => {
    const prevBookmarks = bookmarks;

    await feedService.optimisticToggleBookmark({
      clipId,
      applyLocal: () => {
        setBookmarks((current) => feedService.toggleBookmark({ clipId, bookmarks: current }));
      },
      rollbackLocal: () => {
        setBookmarks(prevBookmarks);
      },
    });
  }, [bookmarks]);

  const toggleLike = useCallback(async (clipId) => {
    const prevLikes = likes;

    await feedService.optimisticToggleLike({
      clipId,
      applyLocal: () => {
        setLikes((current) => feedService.toggleLike({ clipId, likes: current }));
      },
      rollbackLocal: () => {
        setLikes(prevLikes);
      },
    });
  }, [likes]);

  const addComment = useCallback((clipId, text) => {
    setComments((prev) => feedService.createComment({
      clipId,
      text,
      comments: prev,
      userName: user?.name,
    }));
  }, [user]);

  const updateDraftPreferences = useCallback((patch) => {
    setDraftPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const getFilteredClips = useCallback(() => {
    return feedService.getFeed({ selectedGenres });
  }, [selectedGenres]);

  const getBookmarkedClips = useCallback(() => {
    return feedService.getBookmarks({ bookmarks });
  }, [bookmarks]);

  const getProfile = useCallback(() => {
    return feedService.getProfile({ user, bookmarks, likes });
  }, [bookmarks, likes, user]);

  const value = {
    user,
    hasCompletedOnboarding,
    selectedGenres,
    bookmarks,
    likes,
    comments,
    draftPreferences,
    login,
    logout,
    setHasCompletedOnboarding,
    toggleGenre,
    toggleBookmark,
    toggleLike,
    addComment,
    getFilteredClips,
    getBookmarkedClips,
    getProfile,
    setSelectedGenres,
    setDraftPreferences,
    updateDraftPreferences,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
