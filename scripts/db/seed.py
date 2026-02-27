#!/usr/bin/env python3
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / 'db' / 'clipflow.sqlite3'
SEED_VERSION = '2026-epic9-task020-v1'
SEED_TS = '2026-02-22T10:20:30Z'

USERS = [
    {
        'id': '9f84c445-5d89-47fd-9f8f-c2d0ecbcf941',
        'email': 'admin@local.dev',
        'display_name': 'Admin Local',
        'avatar_url': None,
        'role': 'admin',
        'has_completed_onboarding': 1,
    },
    {
        'id': '293e149c-c39c-4a7b-80bf-d63b5c8583f6',
        'email': 'user@local.dev',
        'display_name': 'User Local',
        'avatar_url': None,
        'role': 'user',
        'has_completed_onboarding': 1,
    },
    {
        'id': 'c4e2ff47-8ce4-4553-a7be-b4f37777d445',
        'email': 'new-user@local.dev',
        'display_name': 'New User',
        'avatar_url': None,
        'role': 'user',
        'has_completed_onboarding': 0,
    },
]

GENRES = [
    ('a71ad514-2440-410f-8f17-eeba5f7be102', 'action', 'Action', 1),
    ('0394eb2e-1172-4fd0-a9b9-522cbfd5a24f', 'comedy', 'Comedy', 1),
    ('c1ceceec-20cb-4b2b-8deb-c60f93a6c4cd', 'drama', 'Drama', 1),
    ('1ff9da59-3cb7-4e6f-bec7-c54fc3061b2c', 'horror', 'Horror', 1),
    ('d776b4df-5f04-4f4c-bc40-a7e0f3a14185', 'scifi', 'Sci-Fi', 1),
    ('267c5dc8-6fb1-4271-a6af-b74452ea5acc', 'romance', 'Romance', 1),
    ('67bd2df0-b3d5-429d-ab3c-8ff3072efd1e', 'thriller', 'Thriller', 1),
    ('9f34df0c-9c0b-470d-ac97-c03d4574b03a', 'animation', 'Animation', 1),
    ('99747d92-2bb4-4dcf-b34b-36481bb9d804', 'documentary', 'Documentary', 1),
    ('f50a3502-9968-4395-8ab2-3698f8fb846c', 'fantasy', 'Fantasy', 1),
    ('2feb628c-c15a-4e0c-9f97-291fcfc34ed0', 'crime', 'Crime', 1),
    ('fb49d2c2-4cde-42c0-a31c-6da891f29e6c', 'adventure', 'Adventure', 1),
    ('96f46713-bb8a-4de8-b9ea-f2ba4f6ee1f6', 'experimental', 'Experimental', 0),
]

CLIPS = [
    ('16c90f2b-678f-4c90-9523-56d643ec8db6', 'Interstellar', 'Cooper leads a team of explorers through a wormhole in space to ensure humanity\'s survival.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=400&h=600&fit=crop', 169, 'published', 24500, 2, 64000, 'd776b4df-5f04-4f4c-bc40-a7e0f3a14185'),
    ('77f4f222-d369-45a0-b1cf-e1ffcaea67d3', 'The Dark Knight', 'Batman raises the stakes in his war on crime.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop', 152, 'published', 31200, 1, 82000, 'a71ad514-2440-410f-8f17-eeba5f7be102'),
    ('3285f977-c0e8-4435-8f68-a7f36cab6108', 'Spirited Away', 'Chihiro wanders into a world ruled by gods, witches, and spirits.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop', 125, 'published', 18700, 3, 53000, '9f34df0c-9c0b-470d-ac97-c03d4574b03a'),
    ('e6ecf09f-c228-44c2-8f9b-4174eb59443d', 'Inception', 'A thief using dream-sharing technology is given an impossible task.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop', 148, 'published', 27800, 0, 71000, 'd776b4df-5f04-4f4c-bc40-a7e0f3a14185'),
    ('2ee8e57d-4ca1-489e-bf8e-e0f0317fd1d7', 'Parasite', 'Class discrimination threatens a fragile family arrangement.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=600&fit=crop', 132, 'published', 21300, 0, 58000, 'c1ceceec-20cb-4b2b-8deb-c60f93a6c4cd'),
    ('f10f5e0d-18d1-4ce6-8ba3-6401372cd2a8', 'The Shining', 'A sinister presence in an isolated hotel influences a father into violence.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&h=600&fit=crop', 146, 'published', 19800, 0, 47000, '1ff9da59-3cb7-4e6f-bec7-c54fc3061b2c'),
    ('6f8be2e0-3bc3-468e-ab65-708d0c1d7ea4', 'La La Land', 'A pianist and actress fall in love while navigating their careers.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://images.unsplash.com/photo-1518676590747-1e3dcf5a3aaf?w=400&h=600&fit=crop', 128, 'published', 16200, 0, 35000, '267c5dc8-6fb1-4271-a6af-b74452ea5acc'),
    ('309866fc-a350-4dfd-a3f3-9c44e6d70e2e', 'Blade Runner 2049', 'Young Blade Runner K uncovers a long-buried secret.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop', 164, 'published', 22100, 0, 49000, 'd776b4df-5f04-4f4c-bc40-a7e0f3a14185'),
    ('cb4d0ea2-5cdc-4630-a67d-e2cbb2cdfc02', 'Dune: Prophecy Teaser', 'Draft teaser clip for internal review.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=400&h=600&fit=crop', 95, 'draft', 0, 0, 0, 'fb49d2c2-4cde-42c0-a31c-6da891f29e6c'),
    ('2f8c7f6e-5229-4df4-8ff3-1b47ea877677', 'Noir Cut', 'Draft crime clip for moderation checks.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&h=600&fit=crop', 103, 'draft', 0, 0, 0, '2feb628c-c15a-4e0c-9f97-291fcfc34ed0'),
    ('0f43232f-8488-4cb4-a76e-8d9ba8459f71', 'Archive: Classic Trailer', 'Archived trailer preserved for history.', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop', 88, 'archived', 4200, 0, 12000, '99747d92-2bb4-4dcf-b34b-36481bb9d804'),
]

COMMENTS = [
    ('7cf8b4d9-61f0-44f8-aee2-7f7a55fc43be', '16c90f2b-678f-4c90-9523-56d643ec8db6', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', 'This scene gives me chills every time!', 'approved', 0),
    ('f58c6ec7-792e-4f68-aaec-e8f4692f9a9d', '16c90f2b-678f-4c90-9523-56d643ec8db6', '9f84c445-5d89-47fd-9f8f-c2d0ecbcf941', 'One of Nolan\'s strongest moments.', 'approved', 0),
    ('ffbcd16e-3e13-4aa9-90f6-2508d5f4e497', '77f4f222-d369-45a0-b1cf-e1ffcaea67d3', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', 'Legendary acting from Ledger.', 'approved', 0),
    ('8939f5ac-5ca9-4182-9eca-e75106d6f0b4', '3285f977-c0e8-4435-8f68-a7f36cab6108', 'c4e2ff47-8ce4-4553-a7be-b4f37777d445', 'Beautiful animation and pacing.', 'pending', 1),
    ('1658d418-2fcc-46ee-b1c4-22c17ede1528', '3285f977-c0e8-4435-8f68-a7f36cab6108', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', 'Miyazaki masterpiece.', 'approved', 0),
    ('4b22d6c3-8a29-45a0-b4e6-20e2bf76921f', '3285f977-c0e8-4435-8f68-a7f36cab6108', '9f84c445-5d89-47fd-9f8f-c2d0ecbcf941', 'Timeless story.', 'rejected', 1),
]

LIKES = [
    ('37f93b18-43ec-4f8f-9568-28674067112a', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', '16c90f2b-678f-4c90-9523-56d643ec8db6'),
    ('8c9040da-0829-4072-b3d2-4129a93e86ff', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', '77f4f222-d369-45a0-b1cf-e1ffcaea67d3'),
    ('12f5e388-bff9-4ce7-bca6-5de801ee4a47', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', '3285f977-c0e8-4435-8f68-a7f36cab6108'),
    ('19bde505-e268-4ebc-a4b0-8567e54e00af', '9f84c445-5d89-47fd-9f8f-c2d0ecbcf941', 'e6ecf09f-c228-44c2-8f9b-4174eb59443d'),
]

BOOKMARKS = [
    ('0f1f4fb9-c6b0-46dd-b39f-f3e09fc918ab', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', '16c90f2b-678f-4c90-9523-56d643ec8db6'),
    ('56dc43a0-6d23-4ec2-b797-f12366c17d7d', '293e149c-c39c-4a7b-80bf-d63b5c8583f6', '309866fc-a350-4dfd-a3f3-9c44e6d70e2e'),
    ('2a89044f-ab3a-46e9-9b77-f95cf105727a', '9f84c445-5d89-47fd-9f8f-c2d0ecbcf941', '2ee8e57d-4ca1-489e-bf8e-e0f0317fd1d7'),
]


def main() -> None:
    db_path = Path(os.environ.get('DB_PATH', DEFAULT_DB))
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA foreign_keys = ON;')

    for user in USERS:
        conn.execute(
            '''
            INSERT INTO users(id, email, display_name, avatar_url, role, has_completed_onboarding, created_at, updated_at, deleted_at)
            VALUES (:id, :email, :display_name, :avatar_url, :role, :has_completed_onboarding, :created_at, :updated_at, NULL)
            ON CONFLICT(id) DO UPDATE SET
              email=excluded.email,
              display_name=excluded.display_name,
              avatar_url=excluded.avatar_url,
              role=excluded.role,
              has_completed_onboarding=excluded.has_completed_onboarding,
              updated_at=excluded.updated_at,
              deleted_at=NULL;
            ''',
            {**user, 'created_at': SEED_TS, 'updated_at': SEED_TS},
        )

    for genre_id, slug, name, is_active in GENRES:
        conn.execute(
            '''
            INSERT INTO genres(id, slug, name, is_active, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(id) DO UPDATE SET
              slug=excluded.slug,
              name=excluded.name,
              is_active=excluded.is_active,
              updated_at=excluded.updated_at,
              deleted_at=NULL;
            ''',
            (genre_id, slug, name, is_active, SEED_TS, SEED_TS),
        )

    for clip in CLIPS:
        (clip_id, title, description, video_url, thumbnail_url, duration_sec, status, likes_count, comments_count, views_count, genre_id) = clip
        published_at = SEED_TS if status == 'published' else None
        conn.execute(
            '''
            INSERT INTO clips(id, author_id, genre_id, title, description, video_url, thumbnail_url, duration_sec, status, views_count, likes_count, comments_count, created_at, updated_at, published_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(id) DO UPDATE SET
              author_id=excluded.author_id,
              genre_id=excluded.genre_id,
              title=excluded.title,
              description=excluded.description,
              video_url=excluded.video_url,
              thumbnail_url=excluded.thumbnail_url,
              duration_sec=excluded.duration_sec,
              status=excluded.status,
              views_count=excluded.views_count,
              likes_count=excluded.likes_count,
              comments_count=excluded.comments_count,
              updated_at=excluded.updated_at,
              published_at=excluded.published_at,
              deleted_at=NULL;
            ''',
            (clip_id, USERS[0]['id'], genre_id, title, description, video_url, thumbnail_url, duration_sec, status, views_count, likes_count, comments_count, SEED_TS, SEED_TS, published_at),
        )

    for comment_id, clip_id, author_id, body, moderation_status, is_hidden in COMMENTS:
        moderated_by = USERS[0]['id'] if moderation_status in ('approved', 'rejected') else None
        moderated_at = SEED_TS if moderated_by else None
        moderation_reason = 'Policy violation' if moderation_status == 'rejected' else None
        conn.execute(
            '''
            INSERT INTO comments(id, clip_id, author_id, body, created_at, updated_at, is_edited, deleted_at, moderation_status, moderation_reason, moderated_by, moderated_at, is_hidden, reports_count)
            VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              clip_id=excluded.clip_id,
              author_id=excluded.author_id,
              body=excluded.body,
              updated_at=excluded.updated_at,
              is_edited=excluded.is_edited,
              deleted_at=NULL,
              moderation_status=excluded.moderation_status,
              moderation_reason=excluded.moderation_reason,
              moderated_by=excluded.moderated_by,
              moderated_at=excluded.moderated_at,
              is_hidden=excluded.is_hidden,
              reports_count=excluded.reports_count;
            ''',
            (comment_id, clip_id, author_id, body, SEED_TS, SEED_TS, moderation_status, moderation_reason, moderated_by, moderated_at, is_hidden, 2 if is_hidden else 0),
        )

    for like_id, user_id, clip_id in LIKES:
        conn.execute(
            '''
            INSERT INTO likes(id, user_id, clip_id, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              user_id=excluded.user_id,
              clip_id=excluded.clip_id,
              created_at=excluded.created_at;
            ''',
            (like_id, user_id, clip_id, SEED_TS),
        )

    for bookmark_id, user_id, clip_id in BOOKMARKS:
        conn.execute(
            '''
            INSERT INTO bookmarks(id, user_id, clip_id, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              user_id=excluded.user_id,
              clip_id=excluded.clip_id,
              created_at=excluded.created_at;
            ''',
            (bookmark_id, user_id, clip_id, SEED_TS),
        )

    conn.execute(
        '''
        INSERT INTO seed_meta(seed_version, applied_at)
        VALUES (?, ?)
        ON CONFLICT(seed_version) DO UPDATE SET applied_at=excluded.applied_at;
        ''',
        (SEED_VERSION, SEED_TS),
    )

    conn.commit()
    conn.close()
    print(f'Seed applied: {SEED_VERSION}')


if __name__ == '__main__':
    main()
