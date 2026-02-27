#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / 'db' / 'migrations'
DEFAULT_DB = ROOT / 'db' / 'clipflow.sqlite3'


def main() -> None:
    db_path = Path(os.environ.get('DB_PATH', DEFAULT_DB))
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA foreign_keys = ON;')
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        '''
    )

    migration_files = sorted(MIGRATIONS_DIR.glob('*.sql'))
    for migration_file in migration_files:
        version = migration_file.name
        already = conn.execute(
            'SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1;', (version,)
        ).fetchone()
        if already:
            continue

        sql = migration_file.read_text(encoding='utf-8')
        conn.executescript(sql)
        conn.execute('INSERT INTO schema_migrations(version) VALUES (?);', (version,))
        conn.commit()
        print(f'Applied migration: {version}')

    conn.close()


if __name__ == '__main__':
    main()
