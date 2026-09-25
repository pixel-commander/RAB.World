import random
from pathlib import Path
from events import event, save


def load(config, tokenizer):
    from unsloth import FastLanguageModel
    from peft import PeftModel
    model, base_tokenizer = FastLanguageModel.from_pretrained(
        model_name=config['base'], max_seq_length=config['max_sequence'],
        load_in_4bit=True, local_files_only=True)
    assert tokenizer.get_vocab() == base_tokenizer.get_vocab(), 'Tokenizer mismatch'
    model = PeftModel.from_pretrained(model, config['parent'], is_trainable=True, local_files_only=True)
    FastLanguageModel.for_training(model, use_gradient_checkpointing='unsloth')
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={'use_reentrant': False})
    trainable = [(name, p) for name, p in model.named_parameters() if p.requires_grad]
    assert trainable and all('lora_' in name for name, _ in trainable), 'Base must stay frozen'
    save(config['output'], 'trainable.json', {name: list(p.shape) for name, p in trainable})
    model.config.use_cache = False
    return model, trainable


def train(config, model, trainable, tokenizer, encoded):
    import torch
    import bitsandbytes as bnb
    root = Path(config['output'])
    optimizer = bnb.optim.AdamW8bit([p for _, p in trainable], lr=config['learning_rate'])
    order = list(range(len(encoded)))
    random.Random(config['seed']).shuffle(order)
    optimizer.zero_grad(set_to_none=True)
    model.train()
    torch.cuda.reset_peak_memory_stats()
    event(root, 'training_started', planned=len(order), trainable_parameters=sum(p.numel() for _, p in trainable))
    for step, index in enumerate(order, 1):
        row = encoded[index]
        ids = torch.tensor([row['input_ids']], device='cuda')
        labels = torch.tensor([row['labels']], device='cuda')
        with torch.autocast('cuda', dtype=torch.bfloat16):
            loss = model(input_ids=ids, attention_mask=torch.ones_like(ids), labels=labels).loss
        assert torch.isfinite(loss), 'Nonfinite loss'
        group = min(4, len(order) - ((step - 1) // 4) * 4)
        (loss / group).backward()
        if step % 4 == 0 or step == len(order):
            torch.nn.utils.clip_grad_norm_([p for _, p in trainable], 1.0, error_if_nonfinite=True)
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
        if step % 250 == 0:
            checkpoint = root / f'checkpoint-{step}'
            assert not checkpoint.exists()
            model.save_pretrained(checkpoint, safe_serialization=True)
        event(root, 'training', examples_seen=step, planned=len(order), loss=loss.item(),
              optimizer_steps=(step + 3) // 4 if step == len(order) else step // 4,
              peak_memory_bytes=torch.cuda.max_memory_allocated())
    destination = root / 'candidate-adapter'
    assert not destination.exists()
    model.save_pretrained(destination, safe_serialization=True)
    tokenizer.save_pretrained(destination)
    del optimizer
    model.zero_grad(set_to_none=True)
    torch.cuda.empty_cache()
    event(root, 'adapter_saved', path=str(destination), promoted=False)
