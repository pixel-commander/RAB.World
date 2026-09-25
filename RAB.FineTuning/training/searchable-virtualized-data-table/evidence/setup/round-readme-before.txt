TRAINING ROUND
==============
settings.json identifies this round, its focus and parent session.
Read session_settings relative to this round to find the untouched original source.
summary.json holds derived findings, direction, outcome, scope, lesson and checks.
turns/ holds ordered exact messages and code blocks. turn-001.json starts blank.

Fill the first turn, then create turn-002.json, turn-003.json, etc. Never overwrite
a captured turn; preserve later corrections as new turns. Turn numbering restarts
within each round. reply_to is a turn number in this round, or null.

In a turn, message holds the entire original message, including fenced code in its
original position. code_blocks is an ordered extracted view, not a replacement.
Each block has file (relative source path or null), language (string or null),
purpose (before, proposed_fix, accepted_fix, or context), and code (exact text).
Example field names only: {file, language, purpose, code}. Do not invent filenames.
Use JSON escaping to preserve quotes, newlines and backslashes; a serializer is best.
Large original files stay in the external source folder; only relevant turn code
belongs here. Do not silently truncate code blocks or claim a full-file snapshot.

speaker is user, assistant or tool. recorded_at is an ISO timestamp when captured;
leave null until captured. status is draft or captured. These are evidence records,
not model-specific chat payloads. Tool claims need actual execution evidence.

summary.source_turns lists local turn files supporting its claims. verification.status
is not_tested, passed or failed, with evidence paths or exact results. approval remains
null until explicit human approval; then record by, at, exact message and source turn.
Accepting an implementation is distinct from approving a lesson for training.
No stamp invents approval, verification, findings, or a reusable lesson.
