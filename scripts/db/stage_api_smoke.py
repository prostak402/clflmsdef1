#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

base_url = os.environ.get('STAGE_API_BASE_URL', '').rstrip('/')
if not base_url:
    print('STAGE_API_BASE_URL is not set; skipping stage API smoke.')
    sys.exit(0)

safe_mode = os.environ.get('STAGE_SMOKE_SAFE_MODE', 'true').lower() not in {'0', 'false', 'no'}
request_timeout = int(os.environ.get('STAGE_API_TIMEOUT_SEC', '20'))

headers = {'Accept': 'application/json'}
if os.environ.get('STAGE_API_TOKEN'):
    headers['Authorization'] = f"Bearer {os.environ['STAGE_API_TOKEN']}"


def request_json(path: str, method: str = 'GET', payload: dict | None = None):
    body = None
    req_headers = dict(headers)
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')
        req_headers['Content-Type'] = 'application/json'

    req = urllib.request.Request(f"{base_url}/api/v1{path}", data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=request_timeout) as response:
            raw = response.read().decode('utf-8')
            parsed = json.loads(raw) if raw else None
            return response.status, parsed
    except urllib.error.HTTPError as err:
        raw = err.read().decode('utf-8')
        parsed = None
        if raw:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
        raise RuntimeError(f'HTTP {err.code} for {method} {path}: {parsed}') from err


def run_check(path: str, description: str, validator, method: str = 'GET', payload: dict | None = None):
    endpoint = f'{method} {path}'
    print(f'→ {description}: {endpoint}')
    try:
        status, body = request_json(path, method=method, payload=payload)
        if not validator(status, body):
            raise RuntimeError(f'Unexpected response: status={status}, body={body}')
        print(f'✓ SUCCESS {endpoint}')
        return body
    except Exception as err:
        print(f'✗ ERROR {endpoint}: {err}')
        raise


print(f'Stage API smoke started: base_url={base_url}, safe_mode={safe_mode}')

run_check(
    '/genres?limit=1&page=1',
    'genres read',
    lambda status, body: status == 200 and isinstance(body, dict),
)

feed_payload = run_check(
    '/feed/clips?limit=1',
    'feed read',
    lambda status, body: status == 200 and isinstance(body, dict) and isinstance(body.get('items'), list),
)

run_check(
    '/me',
    'profile read',
    lambda status, body: status == 200 and isinstance(body, dict) and bool(body.get('id')),
)

bookmarks_payload = run_check(
    '/me/bookmarks',
    'bookmarks read',
    lambda status, body: status == 200 and isinstance(body, dict) and isinstance(body.get('items'), list),
)

run_check(
    '/comments',
    'comments read',
    lambda status, body: status == 200 and isinstance(body, dict) and isinstance(body.get('items'), list),
)

run_check(
    '/moderation/comments',
    'moderation comments read (safe)',
    lambda status, body: status == 200 and isinstance(body, dict) and isinstance(body.get('items'), list),
)

bookmark_ids = {item.get('id') for item in bookmarks_payload.get('items', []) if isinstance(item, dict)}
feed_items = feed_payload.get('items') or []
default_clip_id = feed_items[0].get('id') if feed_items and isinstance(feed_items[0], dict) else None
clip_id = os.environ.get('STAGE_SMOKE_CLIP_ID', default_clip_id or '').strip()
if not clip_id:
    raise RuntimeError('Unable to resolve clip id for write-path smoke check. Set STAGE_SMOKE_CLIP_ID.')

run_check(
    f'/clips/{clip_id}/bookmark',
    'bookmark write path',
    lambda status, body: status == 200 and isinstance(body, dict) and clip_id in (body.get('bookmarks') or []),
    method='POST',
)

if safe_mode and clip_id not in bookmark_ids:
    run_check(
        f'/clips/{clip_id}/bookmark',
        'bookmark rollback (safe mode)',
        lambda status, body: status == 200 and isinstance(body, dict) and clip_id not in (body.get('bookmarks') or []),
        method='DELETE',
    )

print('Stage API smoke completed.')
