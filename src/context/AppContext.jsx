import { useState, useCallback } from 'react';
import { GENRE_SELECTION_MAX } from '../constants/onboarding';
import { feedService } from '../services/feed-service';

import { AppContext } from './app-context';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState(feedService.getInitialComments());

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setHasCompletedOnboarding(false);
    setSelectedGenres([]);
    setBookmarks([]);
    setLikes({});
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

  const toggleBookmark = useCallback((clipId) => {
    setBookmarks((prev) => feedService.toggleBookmark({ clipId, bookmarks: prev }));
  }, []);

  const toggleLike = useCallback((clipId) => {
    setLikes((prev) => feedService.toggleLike({ clipId, likes: prev }));
  }, []);

  const addComment = useCallback((clipId, text) => {
    setComments((prev) => feedService.createComment({
      clipId,
      text,
      comments: prev,
      userName: user?.name,
    }));
  }, [user]);

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
