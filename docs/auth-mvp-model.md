# Auth MVP model

ClipFlow now uses a single API-backed auth model in local development.

## Storage

- Auth session is stored in `localStorage` under `auth_session_v1` and is the only canonical source for auth user state.
- The canonical auth user includes `role`, `hasCompletedOnboarding`, `selectedGenres`, and backend-backed `preferences`.
- App UI state is stored separately under `app_state_v1` for non-auth state only.
- `app_state_v1` keeps local UI data such as bookmarks, likes, blocked comment users, and admin-local lists.
- Malformed or partial `auth_session_v1` payloads are discarded and treated as signed-out state during bootstrap.
- Route protection is based on `user !== null`, `user.role`, and `user.hasCompletedOnboarding`.

## Session lifecycle

1. `POST /auth/login` or `POST /auth/signup` returns `accessToken`, `refreshToken`, `expiresAt`, and the canonical `user`.
2. The frontend persists that session in `auth_session_v1`.
3. On app startup, `authService.restoreSession()` reads and validates the stored session.
4. If `expiresAt` is already in the past, the frontend calls `POST /auth/refresh` and then `GET /me`.
5. Completing onboarding, changing saved genres, and saving profile preferences all call `PATCH /me`, then rewrite `auth_session_v1` from the backend response.
6. If refresh fails or returns an invalid payload, the frontend clears the session and emits `auth:session-ended` with reason `expired`.
7. On explicit logout, the frontend calls `POST /auth/logout` on a best-effort basis, clears the session, and emits `auth:session-ended` with reason `logged_out`.

## Route semantics

- Anonymous user: only `/` is allowed.
- Authenticated user without onboarding: `/genres` is allowed, product routes redirect back to `/genres`.
- Authenticated user with onboarding: `/feed`, `/bookmarks`, `/catalog`, and `/profile` are allowed.
- Admin routes require `user.role === 'admin'`.

## Demo accounts

The local backend seeds two users:

- `user@local.dev` / `demo-password`
- `admin@local.dev` / `demo-password`

These accounts go through the same auth endpoints and return the same canonical `User` shape as every other local user.
