/**
 * Feed adapter interface.
 *
 * @typedef {Object} FeedAdapter
 * @property {(params?: { selectedGenres?: string[] }) => Array<Object>} getFeed
 * @property {(params: { clipId: string, likes: Record<string, boolean> }) => Record<string, boolean>} toggleLike
 * @property {(params: { clipId: string, bookmarks: string[] }) => string[]} toggleBookmark
 * @property {(params: { clipId: string }) => Promise<void>} persistLikeToggle
 * @property {(params: { clipId: string }) => Promise<void>} persistBookmarkToggle
 * @property {(params: { clipId: string, text: string, comments: Record<string, Array<Object>>, userName?: string }) => Record<string, Array<Object>>} createComment
 * @property {(params: { bookmarks: string[] }) => Array<Object>} getBookmarks
 * @property {(params: { user: Object | null, bookmarks: string[], likes: Record<string, boolean> }) => {
 *   name: string,
 *   email: string,
 *   avatar: string,
 *   bookmarkCount: number,
 *   likeCount: number,
 * }} getProfile
 */

export {};
