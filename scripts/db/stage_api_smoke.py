#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.request

base_url = os.environ.get('STAGE_API_BASE_URL', '').rstrip('/')
if not base_url:
    print('STAGE_API_BASE_URL is not set; skipping stage API smoke.')
    sys.exit(0)

headers = {'Accept': 'application/json'}
if os.environ.get('STAGE_API_TOKEN'):
    headers['Authorization'] = f"Bearer {os.environ['STAGE_API_TOKEN']}"


def get(path: str):
    req = urllib.request.Request(f"{base_url}/api/v1{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=20) as response:
        data = response.read().decode('utf-8')
        return response.status, json.loads(data)


checks = [
    ('/genres?limit=1&page=1', lambda body: isinstance(body, dict)),
    ('/clips/feed?limit=1', lambda body: isinstance(body, dict)),
]

for path, validator in checks:
    status, body = get(path)
    if status != 200 or not validator(body):
        raise RuntimeError(f'Smoke check failed for {path}: status={status}, body={body}')
    print(f'OK {path}')

print('Stage API smoke completed.')
