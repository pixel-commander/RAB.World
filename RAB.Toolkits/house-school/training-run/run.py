import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import argparse
import json
import traceback
from pathlib import Path
from events import event, file_hash, save
from data import validate, encode

parser = argparse.ArgumentParser()
parser.add_argument('--config', required=True)
parser.add_argument('--preflight-only', action='store_true')
args = parser.parse_args()
config = json.loads(Path(args.config).read_text(encoding='utf-8'))
root = Path(config['output'])
root.mkdir(exist_ok=True)

try:
    assert config['model_family'] == 'Qwen3-32B'
    assert config['authorization']['by'] == 'Gauge' and config['authorization']['training_authorized'] is True
    assert not (root / 'candidate-adapter').exists(), 'Never overwrite a candidate'
    if not args.preflight_only:
        with (root / 'training-started.lock').open('x') as stream:
            stream.write(str(os.getpid()))
    train_rows, held = validate(config)
    source_hash = file_hash(Path(config['parent']) / 'adapter_model.safetensors')
    assert source_hash == config['parent_sha256'], 'Parent changed'
    parent_config = json.loads((Path(config['parent']) / 'adapter_config.json').read_text())
    assert parent_config['base_model_name_or_path'] == 'unsloth/qwen3-32b-bnb-4bit'
    # Import Unsloth before Transformers as required by this installed training stack.
    from unsloth import FastLanguageModel
    import torch
    from transformers import AutoTokenizer
    torch.manual_seed(config['seed'])
    tokenizer = AutoTokenizer.from_pretrained(config['parent'], local_files_only=True)
    encoded = encode(tokenizer, train_rows, config['max_sequence'])
    event(root, 'preflight_passed', train=len(encoded), clean=400, repair=600, held_out=len(held),
          max_tokens=max(len(r['input_ids']) for r in encoded), parent_sha256=source_hash)
    save(root, 'run.json', config)
    if not args.preflight_only:
        from engine import load, train
        from evaluate import evaluate
        event(root, 'loading_cached_32b')
        model, trainable = load(config, tokenizer)
        train(config, model, trainable, tokenizer, encoded)
        assert file_hash(Path(config['parent']) / 'adapter_model.safetensors') == source_hash
        evaluate(config, model, tokenizer, held)
except Exception as error:
    event(root, 'error', message=str(error), traceback=traceback.format_exc())
    raise
