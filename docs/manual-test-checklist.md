# Manual QA Checklist

Use this checklist against the local API-only stack from the repository root.

## Preflight

```bash
npm install
cp .env.example .env
npx playwright install chromium
npm run dev:local
```

Verify:

- frontend opens at `http://localhost:5173`
- backend responds at `http://localhost:8787/api/v1/genres`
- demo accounts can sign in

## 1. User auth and onboarding

- Sign in with `Demo Account`.
- On the genre screen, do not select anything.
- Click `Explore clips`.
- Verify the feed opens and clips are visible.
- Open `Profile`, click `Sign Out`, and verify the app returns to auth.

## 2. Admin upload and edit

- Sign in with `Admin Demo`.
- Continue through onboarding with no required genres.
- Open `Admin`.
- Create a clip with:
  - valid `Rating`
  - two or more genres
  - local video file
  - optional poster file
- Verify `Clip uploaded successfully!` appears.
- Edit the new clip.
- Change title, rating, and at least one genre.
- Verify `Clip updated successfully!` appears and the updated clip remains in `Recent Uploads`.

## 3. Feed, rating, comments, and bookmarks

- Sign out and sign back in as `Demo Account`.
- On onboarding, select only a secondary genre from the edited clip.
- Verify the edited clip appears in the feed.
- Verify the top badge shows the expected rating.
- Like the clip.
- Save the clip.
- Open comments and add a new comment.
- Like the new comment, then unlike it.
- Open `Saved` and verify the clip is listed there.

## 4. Admin moderation

- Sign back in as `Admin Demo`.
- Open `Comments Mod`.
- Find the comment created in the previous step.
- Click `Block author` and confirm the dialog.
- Click `Delete all` and confirm the dialog.
- Verify success messages are shown.

## 5. Blocked user behavior

- Sign back in as `Demo Account`.
- Open the moderated clip comments.
- Verify the comment input is disabled.
- Verify the blocked-user message is visible.

## 6. Session expiry regression

- Sign in as `Demo Account` and reach the feed.
- In DevTools, edit `localStorage['auth_session_v1']` so `expiresAt` is in the past and `refreshToken` is invalid.
- Reload the page.
- Verify the app redirects to auth and shows `Session expired. Please sign in again.`.

## Automated verification

Run the merge-blocking CI baseline:

```bash
npm run lint
npm run format:check
npm run test
npm run test:storage
npm run build
npm run smoke:local
npm run test:e2e
```

`npm run smoke:stage` is intentionally excluded from this baseline because it requires external stage credentials and remains a manual operational check.

## 7. Storage appendix

- Local provider sanity check: run `npm run smoke:local` and confirm `POST /admin/clips/upload-url` returns an API `uploadUrl` under `/api/v1/uploads/:uploadId`, then confirm the created clip resolves `videoUrl` through `/api/v1/assets/:uploadId`.
- Stage S3 smoke: export `STAGE_API_BASE_URL` and `STAGE_API_TOKEN`, optionally set `STAGE_SMOKE_CLIP_PREFIX`, then run `npm run smoke:stage`.
- Stage gate policy: treat `smoke:stage` as a manual storage verification step, not as a merge-blocking CI requirement.
- Presigned upload confirmation: in `s3` mode the returned `uploadUrl` must not point at the ClipFlow API `/api/v1/uploads/:uploadId` fallback path.
- Stage artifact convention: each smoke run uses a unique title and requested filename prefix, verifies the returned `videoUrl`, and patches the created clip to `archived` when cleanup succeeds.
- Cleanup boundary: no hard delete is expected in this phase; archive-only cleanup is the intended steady-state behavior.
- Source of truth: keep `README.md` and `docs/api-contract.md` as the canonical references for storage env vars and upload behavior.
