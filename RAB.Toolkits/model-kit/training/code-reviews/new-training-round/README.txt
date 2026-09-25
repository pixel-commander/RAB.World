NEW TRAINING ROUND STAMP
========================
Inputs: session (existing absolute session folder), title (optional), focus (optional).
Validates the parent session and the shape of its source reference, then chooses the next
round number above the maximum under rounds/. Gaps are preserved, not reused.
Existing destinations are never overwritten. Concurrent creators may collide; one
fails safely with EEXIST. Retry deliberately to request the next round.
Malformed round entries, source/session overlap and links/junctions are refused.
The shared artifact-plan helper owns writes, failure receipts, and byte verification.
Outputs the new round folder, numeric ID, settings, verified files and seats.
The parent run.mjs round command invokes this tool through the shared Box runner.

Round creation never opens or requires the external original source directory.
All generated work stays under the existing local session folder.
