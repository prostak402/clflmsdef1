# ClipFlow

ClipFlow is organized as a single local API-only MVP. The frontend always talks to the Node backend from this repository, and the local happy-path no longer depends on mock runtime switches or Python tooling.

## Local stack

- Frontend: `Vite + React`
- Backend: `backend-server.mjs` (Node HTTP server)
- Storage: `STORAGE_PROVIDER=local` by default, with a filesystem-backed upload flow under `.clipflow-storage/`
- Optional media backend: `STORAGE_PROVIDER=s3` for presigned uploads to an S3-compatible bucket
- API base URL: `http://localhost:8787/api/v1`
- Demo accounts:
  - `user@local.dev` / `demo-password`
  - `admin@local.dev` / `demo-password`

## Quick start

```bash
npm install
cp .env.example .env
npm run dev:local
```

If you want to run the processes separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Storage providers

Local development defaults to `STORAGE_PROVIDER=local`.

For an S3-compatible media pipeline, configure these backend env vars before starting `backend-server.mjs`:

- `STORAGE_PROVIDER=s3`
- `STORAGE_UPLOAD_EXPIRES_IN=900`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT` for non-AWS providers such as MinIO or R2
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_SESSION_TOKEN` when required
- `S3_FORCE_PATH_STYLE=true|false`
- `S3_PUBLIC_BASE_URL` for the clip `videoUrl` returned after metadata finalization

See `.env.dev.example` for local filesystem defaults and `.env.stage.example` for an S3-oriented stage template.

## Browser e2e setup

Install Chromium for Playwright once per machine:

```bash
npx playwright install chromium
```

Run the browser suite:

```bash
npm run test:e2e
npm run test:e2e:headed
```

## Local verification

```bash
npm run test:storage
npm run smoke:local
npm run test:e2e
```

`test:storage` is the focused regression gate for the local filesystem adapter, the S3-compatible adapter, and the backend S3 smoke contract.

`smoke:local` starts the backend with the local storage provider, exercises auth, genres, clips, feed, comments, bookmarks, moderation, and the admin upload/create flow, then exits non-zero on any contract drift.

## Stage smoke

Run the manual stage smoke against the deployed API base URL when you have stage credentials available:

```bash
STAGE_API_BASE_URL=https://stage.example.com/api/v1 \
STAGE_API_TOKEN=<admin-bearer-token> \
STAGE_SMOKE_CLIP_PREFIX=codex-stage-smoke \
npm run smoke:stage
```

`smoke:stage` requests a presigned upload URL, uploads bytes directly to object storage, finalizes the clip through `POST /admin/clips`, verifies the returned `videoUrl`, and archives the created smoke clip with `PATCH /admin/clips/:id`. The smoke title and requested filename are unique per run, and cleanup is archive-only in this phase. This remains a manual operational check and is not part of the merge-blocking CI path.

## Quality checks

```bash
npm run lint
npm run format:check
npm run test
npm run test:storage
npm run build
npm run smoke:local
npm run test:e2e
```

## Runtime conventions

- Runtime is API-only. `VITE_DATA_SOURCE` is not used anymore.
- `role` is the only canonical user authorization field.
- `watchUrl` is the only canonical clip link field.
- Genre identifiers use slug format such as `action`, `drama`, `scifi`.
- Admin upload flow is:
  - `POST /admin/clips/upload-url`
  - `PUT <uploadUrl>`
  - `POST /admin/clips`
- `PUT /uploads/:uploadId` is only the local filesystem fallback path. In `s3` mode, `uploadUrl` is a presigned storage URL.

## Scripts

- `npm run dev:frontend` starts Vite.
- `npm run dev:backend` starts the local Node API on `PORT` or `8787`.
- `npm run dev:local` starts frontend and backend together.
- `npm run smoke:local` runs the local API smoke scenario.
- `npm run smoke:stage` runs the manual stage storage smoke against a deployed API with S3-compatible uploads.
- `npm run test:storage` runs the focused storage adapter and backend S3 smoke tests.
- `npm run test:e2e` runs Playwright against the real local stack.
- `npm run test:e2e:headed` runs the same browser suite with a visible browser.
- `npm run legacy:db:migrate`, `npm run legacy:db:seed`, and `npm run legacy:smoke:stage` are kept only for manual legacy workflows.

## Manual QA

- Reproducible checklist: [docs/manual-test-checklist.md](./docs/manual-test-checklist.md)

## CI

The main CI path is now:

1. `npm run lint`
2. `npm run format:check`
3. `npm run test`
4. `npm run test:storage`
5. `npm run build`
6. `npm run smoke:local`
7. `npm run test:e2e`

The stage smoke workflow remains a manual Node-based storage smoke that runs `npm run smoke:stage` with external stage credentials. It is operational verification, not a merge-blocking CI gate. Legacy Python/SQLite smoke assets remain on disk for reference only.
