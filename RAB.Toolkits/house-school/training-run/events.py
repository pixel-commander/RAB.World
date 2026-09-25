import hashlib
import json
import time
from pathlib import Path


def file_hash(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def save(root, name, value):
    target = Path(root) / name
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2), encoding='utf-8')
    temporary.replace(target)


def event(root, phase, **values):
    row = {'phase': phase, 'time': time.time(), **values}
    save(root, 'status.json', row)
    with (Path(root) / 'events.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(row) + '\n')
    print(json.dumps(row), flush=True)
