/**
 * Feed adapter interface.
 *
 * @typedef {Object} FeedAdapter
 * @property {(params?: { selectedGenres?: string[] }) => Promise<Array<Object>>} getFeed
 * @property {(params: { clipId: string, likes: Record<string, boolean> }) => Promise<Record<string, boolean>>} toggleLike
 * @property {(params: { clipId: string, bookmarks: string[] }) => Promise<string[]>} toggleBookmark
 * @property {(params: { clipId: string, shouldLike?: boolean }) => Promise<void>} persistLikeToggle
 * @property {(params: { clipId: string, shouldBookmark?: boolean }) => Promise<void>} persistBookmarkToggle
 * @property {(params: { clipId: string, text: string, comments: Record<string, Array<Object>> }) => Promise<Record<string, Array<Object>>>} createComment
 * @property {(params?: { comments?: Record<string, Array<Object>>, clips?: Array<Object>, blockedUsers?: Record<string, boolean> }) => Promise<Array<Object>>} getAllCommentsForModeration
 * @property {(params: { authorId: string, blockedUsers: Record<string, boolean> }) => Promise<Record<string, boolean>>} blockUserComments
 * @property {(params: { clipId: string, commentId: string, comments: Record<string, Array<Object>> }) => Promise<Record<string, Array<Object>>>} deleteComment
 * @property {(params: { authorId: string, comments: Record<string, Array<Object>> }) => Promise<Record<string, Array<Object>>>} deleteCommentsByUser
 * @property {(params: { bookmarks: string[] }) => Promise<Array<Object>>} getBookmarks
 * @property {() => Promise<Array<Object>>} getCatalog
 * @property {(params?: { user?: Object | null, bookmarks?: string[], likes?: Record<string, boolean> }) => Promise<{
 *   name: string,
 *   email: string,
 *   avatar: string,
 *   bookmarkCount: number,
 *   likeCount: number,
 *   watchedCount?: number,
 *   selectedGenres: string[],
 *   draftPreferences: {
 *     notificationsEnabled: boolean,
 *     autoplayEnabled: boolean,
 *     preferredLanguage: string,
 *   },
 * }>} getProfile
 * @property {() => Promise<Record<string, Array<Object>>>} getInitialComments
 */

export {}
