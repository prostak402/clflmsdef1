import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_CLIPS, MOCK_COMMENTS } from '../data/mock';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState(MOCK_COMMENTS);

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setSelectedGenres([]);
    setBookmarks([]);
    setLikes({});
  }, []);

  const toggleGenre = useCallback((genreId) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((g) => g !== genreId)
        : [...prev, genreId]
    );
  }, []);

  const toggleBookmark = useCallback((clipId) => {
    setBookmarks((prev) =>
      prev.includes(clipId)
        ? prev.filter((id) => id !== clipId)
        : [...prev, clipId]
    );
  }, []);

  const toggleLike = useCallback((clipId) => {
    setLikes((prev) => ({
      ...prev,
      [clipId]: !prev[clipId],
    }));
  }, []);

  const addComment = useCallback((clipId, text) => {
    const newComment = {
      id: `cm_${Date.now()}`,
      user: user?.name || 'Anonymous',
      avatar: '👤',
      text,
      time: 'Just now',
      likes: 0,
    };
    setComments((prev) => ({
      ...prev,
      [clipId]: [newComment, ...(prev[clipId] || [])],
    }));
  }, [user]);

  const getFilteredClips = useCallback(() => {
    if (selectedGenres.length === 0) return MOCK_CLIPS;
    return MOCK_CLIPS.filter((clip) =>
      clip.genres.some((g) => selectedGenres.includes(g))
    );
  }, [selectedGenres]);

  const getBookmarkedClips = useCallback(() => {
    return MOCK_CLIPS.filter((clip) => bookmarks.includes(clip.id));
  }, [bookmarks]);

  const value = {
    user,
    selectedGenres,
    bookmarks,
    likes,
    comments,
    login,
    logout,
    toggleGenre,
    toggleBookmark,
    toggleLike,
    addComment,
    getFilteredClips,
    getBookmarkedClips,
    setSelectedGenres,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
