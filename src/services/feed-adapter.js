/**
 * Feed adapter interface.
 *
 * @typedef {Object} FeedAdapter
 * @property {(params?: { selectedGenres?: string[] }) => Array<Object>} getFeed
 * @property {(params: { clipId: string, likes: Record<string, boolean> }) => Record<string, boolean>} toggleLike
 * @property {(params: { clipId: string, bookmarks: string[] }) => string[]} toggleBookmark
 * @property {(params: { clipId: string, shouldLike?: boolean }) => Promise<void>} persistLikeToggle
 * @property {(params: { clipId: string, shouldBookmark?: boolean }) => Promise<void>} persistBookmarkToggle
 * @property {(params: { clipId: string, text: string, comments: Record<string, Array<Object>>, userName?: string, authorId?: string }) => Record<string, Array<Object>>} createComment
 * @property {(params?: { comments?: Record<string, Array<Object>>, clips?: Array<Object>, blockedUsers?: Record<string, boolean> }) => Array<Object>} getAllCommentsForModeration
 * @property {(params: { authorId: string, blockedUsers: Record<string, boolean> }) => Record<string, boolean>} blockUserComments
 * @property {(params: { clipId: string, commentId: string, comments: Record<string, Array<Object>> }) => Record<string, Array<Object>>} deleteComment
 * @property {(params: { authorId: string, comments: Record<string, Array<Object>> }) => Record<string, Array<Object>>} deleteCommentsByUser
 * @property {(params: { bookmarks: string[] }) => Array<Object>} getBookmarks
 * @property {() => Array<Object>} getCatalog
 * @property {(params?: { user?: Object | null, bookmarks?: string[], likes?: Record<string, boolean> }) => {
 *   name: string,
 *   email: string,
 *   avatar: string,
 *   bookmarkCount: number,
 *   likeCount: number,
 *   watchedCount?: number,
 * }} getProfile
 * @property {() => Record<string, Array<Object>>} getInitialComments
 */

export {}
