from pathlib import Path
from data import prompt
from events import event, save


def evaluate(config, model, tokenizer, held):
    import torch
    from unsloth import FastLanguageModel
    root = Path(config['output'])
    model.load_adapter(config['parent'], adapter_name='parent', is_trainable=False, local_files_only=True)
    FastLanguageModel.for_inference(model)
    results = []
    for row in held:
        result = {'id': row['id'], 'family': row['family'], 'kind': row['kind']}
        for name in ['parent', 'default']:
            model.set_adapter(name)
            model.eval()
            inputs = tokenizer(prompt(tokenizer, row['problem']), return_tensors='pt', add_special_tokens=False).to('cuda')
            with torch.inference_mode():
                generated = model.generate(**inputs, max_new_tokens=config['max_new_tokens'], do_sample=False,
                                           use_cache=True, pad_token_id=tokenizer.pad_token_id, eos_token_id=tokenizer.eos_token_id)
            answer = tokenizer.decode(generated[0, inputs['input_ids'].shape[1]:], skip_special_tokens=True)
            result[name] = {'answer': answer, 'exactFix': answer == row['solution'],
                            'generated_tokens': int(generated.shape[1] - inputs['input_ids'].shape[1]),
                            'scope': 'Exact bytes only; alternative repairs are NOT declared incorrect or reviewer-PASS.'}
        results.append(result)
        save(root, 'comparison-cases.json', results)
        event(root, 'evaluating', completed=len(results), planned=len(held))
    metrics = {name: {kind: {'count': len(subset), 'exact': sum(r[name]['exactFix'] for r in subset)}
                     for kind in ['repair', 'identity'] for subset in [[r for r in results if r['kind'] == kind]]}
               for name in ['parent', 'default']}
    save(root, 'comparison.json', {'metrics': metrics, 'promoted': False, 'reviewerPassNotMeasured': True})
    event(root, 'complete', metrics=metrics, promoted=False)
