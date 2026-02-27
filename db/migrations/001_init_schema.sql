PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  has_completed_onboarding INTEGER NOT NULL CHECK (has_completed_onboarding IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  genre_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_sec INTEGER NOT NULL CHECK (duration_sec BETWEEN 1 AND 600),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_edited INTEGER NOT NULL CHECK (is_edited IN (0, 1)),
  deleted_at TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  moderated_by TEXT,
  moderated_at TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  reports_count INTEGER NOT NULL DEFAULT 0 CHECK (reports_count >= 0),
  FOREIGN KEY (clip_id) REFERENCES clips(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (moderated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  clip_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, clip_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (clip_id) REFERENCES clips(id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  clip_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, clip_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (clip_id) REFERENCES clips(id)
);

CREATE TABLE IF NOT EXISTS seed_meta (
  seed_version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clips_status_genre_created_at ON clips(status, genre_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_clip_created_at ON comments(clip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_moderation_status ON comments(moderation_status, created_at DESC);
