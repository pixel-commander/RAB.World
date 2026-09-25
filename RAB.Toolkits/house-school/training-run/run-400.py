"""Explicitly authorized 400-example continuation; no promotion or base updates."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import argparse
import json
import traceback
from pathlib import Path
from events import event, save, file_hash
from data import SYSTEM

parser = argparse.ArgumentParser()
parser.add_argument('--dataset', required=True)
parser.add_argument('--previous-run', default='C:/Users/gauge/.rab/temp/test/1790225264065/lora')
parser.add_argument('--expected-parent-hash', default='71e0496a87de6357739559c9fccfa04535fc770e8793996bc3160f2f3af0245f')
parser.add_argument('--clean-count', type=int, default=160)
args = parser.parse_args()
dataset = Path(args.dataset)
root = dataset / 'lora'
root.mkdir(exist_ok=True)
css_system = ('Repair the supplied code if necessary; preserve already-correct code and all content. '
              'Return the complete specimen using CSS: and MARKUP: sections, with no explanation. '
              'Use the same simple CSS and HTML syntax as the input. You have no tools.')

try:
    with (root / 'started.lock').open('x') as stream:
        stream.write(str(os.getpid()))
    rows = [json.loads(line) for line in (dataset / 'pairs.jsonl').read_text(encoding='utf-8').splitlines()]
    authorization = json.loads((dataset / 'authorization.json').read_text())
    summary = json.loads((dataset / 'summary.json').read_text())
    assert len(rows) == 400 and sum(r['kind'] == 'identity' for r in rows) == args.clean_count == summary['clean']
    assert authorization['by'] == 'Gauge' and summary['passed']
    assert file_hash(dataset / 'pairs.jsonl') == authorization['sha256'] == summary['source_sha256']
    previous = Path(args.previous_run)
    config = json.loads((previous / 'run.json').read_text())
    config.update(parent=str(previous / 'candidate-adapter'), output=str(root), seed=20260924,
                  learning_rate=0.00002, epochs=1, max_sequence=4096, authorization=authorization,
                  dataset=str(dataset), source_sha256=authorization['sha256'])
    parent_hash = file_hash(Path(config['parent']) / 'adapter_model.safetensors')
    assert parent_hash == args.expected_parent_hash
    config['parent_sha256'] = parent_hash
    config['systems'] = {'house': SYSTEM, 'css': css_system}
    config['script_sha256'] = file_hash(__file__)
    save(root, 'run.json', config)
    event(root, 'preflight', count=400, clean=args.clean_count, repair=400-args.clean_count)
    from unsloth import FastLanguageModel
    import torch
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(config['parent'], local_files_only=True)
    encoded = []
    for row in rows:
        system = css_system if row['suite'] == 'css' else SYSTEM
        prefix = tokenizer.apply_chat_template([{'role': 'system', 'content': system},
                  {'role': 'user', 'content': row['problem']}], tokenize=False,
                  add_generation_prompt=True, enable_thinking=False)
        ids = tokenizer.encode(prefix, add_special_tokens=False)
        target = tokenizer.encode(row['solution'], add_special_tokens=False)
        assert tokenizer.decode(target) == row['solution'], 'Target roundtrip mismatch'
        target += [tokenizer.eos_token_id]
        assert len(ids) + len(target) <= config['max_sequence'], 'Refusing truncation'
        encoded.append({'input_ids': ids + target, 'labels': [-100] * len(ids) + target})
    torch.manual_seed(config['seed'])
    event(root, 'loading', maximum_tokens=max(len(r['input_ids']) for r in encoded))
    from engine import load, train
    model, trainable = load(config, tokenizer)
    train(config, model, trainable, tokenizer, encoded)
    assert file_hash(Path(config['parent']) / 'adapter_model.safetensors') == parent_hash
    event(root, 'complete', trained=400, parent_unchanged=True, promoted=False, evaluation_pending=True)
except Exception as error:
    event(root, 'error', message=str(error), traceback=traceback.format_exc())
    raise
