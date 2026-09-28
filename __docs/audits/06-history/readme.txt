EXECUTION HISTORY
Owner: audit-runner/history.mjs (appendHistory and trackExecution).
Destination: <rab_home>/worlds/<world>/audits/history.jsonl
One compact JSON object per line. Append, never rewrite earlier records.

Example expanded for readability (illustrative, not a real run):
{
  "id": "execution-uuid",
  "name": "folder-details",
  "world": "laptop",
  "options": {"ids": [2,3], "recursive": false},
  "date_start": 1790526000000,
  "date_end": 1790526001250,
  "duration_ms": 1250,
  "status": "completed",
  "errors": []
}

Dates are epoch milliseconds; duration uses monotonic performance timer.
Status completed, partial (returned errors), or failed (exception).
History name identifies tool/action; id identifies this execution, NOT the tool registration ID.
Registered runner options record resolved inputs/defaults; UI actions record folder IDs.
Runner history id matches execution.id and report.execution_id.
History logs outcomes, not a duplicate of folder counts/descriptions.

CONCURRENCY / FAILURE
Writer serializes appends per resolved file within this Node process.
There is no cross-process locking or durable start-event journal.
Final records are written in finally; process termination can leave no record.
History-write failure propagates; data may already have changed. No cross-file/DB transaction exists.
Never silently retry a mutating operation just because history writing failed.

COMPATIBILITY
Runner retains latest portable audits/report.json because tool/import workflows still consume a report.
Direct tool calls still default to audits/<tool-name>/report.json.
Old reports and a legacy runs directory were not deleted or migrated.
Historical runs SQL table remains for map membership; new detail/ignore actions log JSONL but are not inserted into SQL runs.
These compatibility outputs are still part of current behavior.
