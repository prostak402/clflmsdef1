# Auth to onboarding flow

The canonical local flow is:

1. User opens `/`.
2. User signs in or signs up through the API.
3. Authenticated users land on `/genres` until onboarding is complete.
4. On `/genres`, the user picks a saved default genre set locally.
5. Pressing `Explore clips` calls `PATCH /me` with both `hasCompletedOnboarding: true` and the current `selectedGenres`.
6. Only after a successful `PATCH /me` response does the app update `auth_session_v1` and route to `/feed`.
7. After onboarding, the saved feed filter stays canonical in `auth_session_v1.user.selectedGenres` and is restored on reload/login.
8. Later changes from the feed quick filter or the profile preferences card use the same `PATCH /me` write path.
9. Signed-in users with completed onboarding can open `/feed`, `/bookmarks`, `/catalog`, and `/profile`.
10. Admin users with completed onboarding can also open `/admin` and `/admin/comments`.

## Guard expectations

- Visiting `/` with an active session redirects to `/genres` or `/feed`.
- Visiting protected routes without a session redirects to `/`.
- Visiting `/admin` or `/admin/comments` without `role=admin` redirects to `/feed`.
- Malformed stored sessions are discarded before route resolution and behave the same as a signed-out state.
- If refresh fails during app bootstrap, the app returns to `/` and shows `Session expired. Please sign in again.`.
