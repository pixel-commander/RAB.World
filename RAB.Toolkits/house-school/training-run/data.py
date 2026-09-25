import json
import sys
from pathlib import Path
from events import file_hash

SYSTEM = 'Follow the supplied House contract. Repair only actual violations and preserve valid code. Return complete files with FILE labels, without explanation or reasoning.'


def rows(path):
    return [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line]


def validate(config):
    root = Path(config['dataset'])
    summary = json.loads((root / 'summary.json').read_text())
    assert summary['passed'] and summary['canonicalTypecheck']
    assert file_hash(root / 'pairs.jsonl') == config['source_sha256'] == summary['source_sha256']
    train, held = rows(root / 'pairs.jsonl'), rows(root / 'held-out.jsonl')
    assert len(train) == 1000 and len(held) == 50
    assert sum(row['kind'] == 'identity' for row in train) == 400
    assert sum(row['kind'] == 'repair' for row in train) == 600
    sys.path.insert(0, 'L:/rraabbiitt-v2/src/school')
    import lessons
    approved = lessons.collection(Path(config['approved']))
    assert len(approved) == 1000 and all(r['status'] == 'approved' for r in approved)
    assert {(r['messages'][0]['content'], r['messages'][1]['content']) for r in approved} == {(r['problem'], r['solution']) for r in train}
    approval = lessons.load(Path(config['approved']) / 'authorization.json')
    assert approval['source_sha256'] == config['source_sha256']
    for field in ['problem', 'solution']:
        assert len({r[field] for r in train}) == len(train), f'Duplicate {field}'
        assert not {r[field] for r in train} & {r[field] for r in held}, f'Leaked {field}'
    return train, held


def prompt(tokenizer, problem):
    return tokenizer.apply_chat_template([
        {'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': problem},
    ], tokenize=False, add_generation_prompt=True, enable_thinking=False)


def encode(tokenizer, train, limit):
    encoded = []
    for row in train:
        prefix = tokenizer.encode(prompt(tokenizer, row['problem']), add_special_tokens=False)
        answer = tokenizer.encode(row['solution'], add_special_tokens=False)
        assert tokenizer.decode(answer) == row['solution'], 'Target token roundtrip changed bytes'
        target = answer + [tokenizer.eos_token_id]
        assert len(prefix) + len(target) <= limit, 'Refusing truncation'
        encoded.append({'input_ids': prefix + target, 'labels': [-100] * len(prefix) + target})
    return encoded
