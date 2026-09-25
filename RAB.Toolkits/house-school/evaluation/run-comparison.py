"""Offline evaluation only. Store model output as data; never execute it."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import argparse
import hashlib
import json
import time
import traceback
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--source-run', default='C:/Users/gauge/.rab/temp/test/1790225264065/lora')
parser.add_argument('--preflight-only', action='store_true')
args = parser.parse_args()
root = Path(args.output)
source = Path(args.source_run)
config = json.loads((source / 'run.json').read_text())
adapters = {'parent': Path(config['parent']), 'candidate': source / 'candidate-adapter'}
css_path = Path('C:/Users/gauge/Documents/Codex/2026-09-23/r-boot-seqs-txt/outputs/lora-v2-round2-data/held-out/pairs.jsonl')
house_system = 'Follow the supplied House contract. Repair only actual violations and preserve valid code. Return complete files with FILE labels, without explanation or reasoning.'
css_system = ('Repair the supplied code if necessary; preserve already-correct code and all content. '
              'Return the complete specimen using CSS: and MARKUP: sections, with no explanation. '
              'Use the same simple CSS and HTML syntax as the input. You have no tools.')

def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def save(name, value):
    temp = root / (name + '.tmp')
    temp.write_text(json.dumps(value, indent=2), encoding='utf-8')
    temp.replace(root / name)

def event(phase, **values):
    value = {'phase': phase, 'time': time.time(), **values}
    save('status.json', value)
    with (root / 'events.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(value) + '\n')
    print(json.dumps(value), flush=True)

def read_rows(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line]

def run():
    fresh = read_rows(root / 'fresh.jsonl')
    css = read_rows(css_path)
    assert len(fresh) == 50 and len(css) == 30
    assert sum(r['kind'] == 'identity' for r in fresh) == 20
    hashes = {name: digest(path / 'adapter_model.safetensors') for name, path in adapters.items()}
    assert hashes['parent'] == config['parent_sha256']
    rows = [dict(r, suite='fresh-house') for r in fresh] + [dict(r, suite='css-regression') for r in css]
    assert len({r['id'] for r in rows}) == 80
    if args.preflight_only:
        print(json.dumps({'cases': 80, 'generations': 160, 'adapter_hashes': hashes, 'execution': 'none'}))
        return
    with (root / 'started.lock').open('x') as stream:
        stream.write(str(os.getpid()))
    save('run.json', {'adapters': {k: str(v) for k, v in adapters.items()}, 'hashes_before': hashes,
                     'fresh_sha256': digest(root / 'fresh.jsonl'), 'css_sha256': digest(css_path),
                     'script_sha256': digest(__file__), 'seed': 20260924, 'max_new_tokens': 2048,
                     'house_system': house_system, 'css_system': css_system,
                     'source_run': str(source),
                     'scope': 'Evaluation only. Exact bytes, not semantic PASS. Fixed House holdout and historical CSS replay; repeated evaluation is not a new blind test.'})
    event('loading', cases=80, generations=160)
    from unsloth import FastLanguageModel
    import torch
    from peft import PeftModel
    from transformers import AutoTokenizer
    torch.manual_seed(20260924)
    tokenizer = AutoTokenizer.from_pretrained(adapters['parent'], local_files_only=True)
    prompts = []
    for row in rows:
        system = house_system if row['suite'] == 'fresh-house' else css_system
        prompt = tokenizer.apply_chat_template([{'role': 'system', 'content': system},
                    {'role': 'user', 'content': row['problem']}], tokenize=False,
                    add_generation_prompt=True, enable_thinking=False)
        ids = tokenizer(prompt, add_special_tokens=False)['input_ids']
        assert len(ids) + 2048 <= 8192, 'No truncation'
        prompts.append(prompt)
    model, base_tokenizer = FastLanguageModel.from_pretrained(model_name=config['base'],
                        max_seq_length=8192, load_in_4bit=True, local_files_only=True)
    assert tokenizer.get_vocab() == base_tokenizer.get_vocab()
    model = PeftModel.from_pretrained(model, adapters['parent'], adapter_name='parent',
                                     is_trainable=False, local_files_only=True)
    model.load_adapter(adapters['candidate'], adapter_name='candidate', is_trainable=False, local_files_only=True)
    FastLanguageModel.for_inference(model)
    results = []
    for row, prompt in zip(rows, prompts):
        result = {k: row[k] for k in ['id', 'kind', 'suite']}
        result['family'] = row.get('family', 'css-grid')
        for name in adapters:
            model.set_adapter(name)
            model.requires_grad_(False)
            model.eval()
            inputs = tokenizer(prompt, return_tensors='pt', add_special_tokens=False).to('cuda')
            with torch.inference_mode():
                output = model.generate(**inputs, max_new_tokens=2048, do_sample=False, use_cache=True,
                                        pad_token_id=tokenizer.pad_token_id, eos_token_id=tokenizer.eos_token_id)
            tokens = output[0, inputs['input_ids'].shape[1]:]
            answer = tokenizer.decode(tokens, skip_special_tokens=True)
            result[name] = {'answer': answer, 'exactFix': answer == row['solution'],
                            'generated_tokens': len(tokens), 'token_limit_reached': len(tokens) == 2048,
                            'invalid_empty_output': not answer.strip()}
        results.append(result)
        save('comparison-cases.json', results)
        event('evaluating', completed=len(results), planned=len(rows), suite=row['suite'])
    after = {name: digest(path / 'adapter_model.safetensors') for name, path in adapters.items()}
    assert hashes == after, 'Adapter file changed during evaluation'
    metrics = {}
    for suite in ['fresh-house', 'css-regression']:
        metrics[suite] = {name: {kind: {'count': len(subset), 'exact': sum(r[name]['exactFix'] for r in subset)}
            for kind in ['identity', 'repair']
            for subset in [[r for r in results if r['suite'] == suite and r['kind'] == kind]]} for name in adapters}
    save('comparison.json', {'metrics': metrics, 'hashes_after': after, 'semanticReviewPending': True, 'promoted': False})
    event('complete', metrics=metrics, adapters_unchanged=True, semantic_review_pending=True)

try:
    run()
except Exception as error:
    event('error', message=str(error), traceback=traceback.format_exc())
    raise
