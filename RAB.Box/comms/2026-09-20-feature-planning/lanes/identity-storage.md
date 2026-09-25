# Identity and storage: independent planning lane

Date: 2026-09-20. Owner: Activate rraabbiitt. Status: independent draft for comparison, not implementation authorization.
Canonical project: `C:/Users/pixelcommander/Desktop/RRAABBIITT_v0.9.3`.
No in-flight source scope or conflict. Only this lane and its assigned review document are writable in this round.

## Recommendation in one paragraph

Use one versioned descriptor contract with typed extensions, one numeric allocator behind the memory owner, and one writable representation per record. Keep semantic tool addresses distinct from numeric saved-work folders. Add application scope beside project scope, not a pretend project. Initially support one local allocation realm, including cooperating processes; do not promise independent PIXEL/server allocators can merge without collisions. Read old history in place, and explicitly convert only a resumed mutable session when necessary. Do not make folders for every event just to look fractal. Establish these contracts before migrating generators or implementing the viewer.

## Observed owners and consequential gaps

References are relative to the canonical project, inspected this round:

| Owner | Observed behavior | Planning consequence |
| --- | --- | --- |
| `tools/README.txt`, `bridge/tool-house.mjs:54` | Six house keys; `settings` is an array of input declarations; name matches leaf folder; every settings-bearing category is currently treated as a tool | Introduce explicit descriptor role before category descriptors; do not overload settings with runtime state |
| `bridge/tool-house.mjs:109`, `:227` | Recursive discovery, nearest executor, path/meta validation, project tool resolution | One discovery owner; category descriptors must not become runnable; moves need inheritance/authority regression checks |
| `bridge/rab-memory.mjs:46`, `:61`, `:65` | Home and project initialization, project key incorporates path hash except owned projects; openProject updates metadata | Preview cannot call existing mutating open/load helpers; new stable project storage must not derive identity from source path |
| `bridge/rab-memory.mjs:160`, `:251`, `:275` | Sessions are timestamp-random JSON files; listProjects expects string project IDs; session listing uses filename order | Numeric migration includes readers, validation and sorting, not just generators |
| `bridge/session-planner.mjs:119`, `:283`, `:366` | Groups, steps, turns use prefixed counters; project defaults and action seats share bag | Preserve existing group owner; define lifetime/reset policy before exposing New action |
| `bridge/project-conversation.mjs:150` | Project loading resumes saved session; copied turns receive string IDs | Shared activation operation must replace divergent Chat/UI transitions |
| `bridge/tool-tracking.mjs:18` | UUID execution IDs | Allocate before runner starts; track attempted/failed/cancelled runs, including nested executions |
| `bridge/rab-memory.mjs:167` | Full read reports saved for audit-type projects | Persistence eligibility must be capability/output policy, not changing development project type to audit |
| `tools/base/stamp-new-tool/stamp-new-tool.mjs:35` | max(Date.now(), known maximum + 1), not shared reservation | Replace generator internals through allocator; retain existing tool IDs |
| `tools/_stamp-engines.mjs:11`, `tools/audit/stamp-new-project/stamp-new-project.mjs:16` | Prefixed/default random project IDs | Explicit compatibility boundary for source descriptors and saved project references |
| `bridge/rab-memory-lock.mjs:9` | mkdir lock, owner PID/host/token, timeout, no stale stealing | Useful local serialization, not evidence of tested multi-host filesystem safety |

Pipeline participant additionally identified hash-derived evidence identity at `tools/audit/_evidence/records.mjs:13` and re-derivation in `workflow.mjs:60-66`; independently confirmed during cross-review. Numeric evidence must use a new version separating allocated identity from semantic digest; preserve v1 validation unchanged.

## Alternatives and primary-source connections

1. **Shared timestamp high-water allocator, local files** — preferred bounded start. Retains JSON-number IDs and readable files; reuses memory serialization. Requires explicit crash reservation/recovery, coordinator bottleneck and batch allocation. Existing locks alone are not a transaction or power-loss guarantee.
2. **SQLite transactional allocator and storage adapter** — serious alternative if concurrent updates/query volume justify it. A transaction can serialize high-water reservation and record insertion when both live in that database; JSON artifact publication still needs a commit/recovery protocol. SQLite permits one simultaneous writer, and BEGIN IMMEDIATE can report busy. This is a replaceable persistence engine, not a second identity owner. [SQLite transactions](https://www.sqlite.org/lang_transaction.html)
3. **Distributed timestamp/worker/sequence IDs** — useful prior art, not preferred. Snowflake separates time, worker and per-millisecond sequence, but the common 64-bit form cannot safely travel as ordinary JavaScript JSON numbers. X itself recommends strings. A bespoke 53-bit variant adds worker leasing, epoch and clock policy to solve a requirement not yet established. [X ID format](https://docs.x.com/fundamentals/x-ids)

For descriptors: one giant permissive object is easy initially but hides collisions in `type`/`settings`; unrelated schemas per level lose self-similarity. Prefer a common core plus role-specific validation. JSON Schema can describe/validate that shape, but its default annotation does not populate values. Keep inheritance in the house binder, not an external validator's optional mutation feature. No validator package installation is implied. [JSON Schema annotations](https://json-schema.org/understanding-json-schema/reference/annotations)

For history: converting everything gives simpler readers at the price of broken references and costly rollback; perpetual dual writes create competing truth. Prefer versioned readers plus a deliberate, transactional cutover of mutable state, leaving evidence original.

## Proposed descriptor contract (new keys explicitly proposed)

Common existing keys stay: `id`, `name`, `title`, `description`, `settings`, `meta`.
Proposed additions: `version`, `meta.kind`, `meta.parent`, `meta.children`.
The relationship ref is `{kind, id}` within an explicitly selected storage/catalog scope. Cross-scope refs also carry scope; never resolve arbitrary filesystem paths supplied by a browser.

```json
{
  "version": "rab-node/v1",
  "id": 1789920825354,
  "name": "css",
  "title": "CSS",
  "description": "Stylesheet capabilities",
  "settings": [],
  "meta": {
    "kind": "category",
    "parent": {"kind": "category", "id": 1789920825353},
    "children": {"source": "discovery"}
  }
}
```

Tool example: same core, existing numeric id retained, name still actual semantic leaf, `meta.kind: "tool"`; existing authority/domain/operation remain capability metadata. `settings` remains the exact input field array. `meta.children` can be omitted for leaves. A category is never executable even when an ancestor has an executor. Unknown roles fail visibly; old tool descriptors lacking the version/role use the legacy tool adapter.

Session example:

```json
{
  "version": "rab-node/v1",
  "id": 1789920825355,
  "name": "review-styles",
  "title": "Review styles",
  "description": "Saved work context",
  "settings": [],
  "meta": {
    "kind": "session",
    "parent": {"kind": "project", "id": 1789920825352},
    "children": {"source": "state", "collection": "groups"}
  }
}
```

In `sessions/1789920825355/settings.json`, name is a semantic name, not required to equal numeric basename. Limit the existing name=leaf validation to tools/categories. Session `state.json` owns revision, bag, groups, steps, turns and status. Descriptor changes infrequently; runtime history does not live in input declarations.

Project example uses the same core, `meta.kind: "project"`, and retains `type: "react"` and `paths` as typed project extensions. Do not set type="project". A request descriptor uses `meta.kind: "request"` and its requested `type: "feature"`; this type is classified by the request schema, not interpreted as a project platform. Preserve existing type meanings through typed validators rather than pretending every type is interchangeable.

At implemented folder levels use settings.json consistently. Embedded groups/steps can use the same core without forcing individual files; their existing option/status fields remain typed state. Keep group/step/turn reference field spellings through the compatibility adapter; do not simultaneously rename group to task everywhere. Action is the UI name of group.

Child relationship policy: authoritative child parent reference plus the declared collection owner. For small embedded groups the session state is authoritative; for folder children discovery creates a derived paged child list. Do not maintain a second handwritten children array alongside independent directories. Reject cycles, duplicate IDs and parent mismatches. References are not access grants.

Bag rule: apply defaults only for absent/undefined keys according to the existing field contract. Do not use truthiness; false, 0 and valid empty strings survive. Explicit null does not silently become a default; required/missing validation remains a separate binder concern. Reject prototype-polluting keys. Snapshot effective inputs and their provenance on execution. Descriptor inheritance never supplies approval.

## Numeric allocator contract

Proposed memory-owned API: `allocateIds(count, purpose)` returning JSON safe-integer numbers. All new durable identities use it: projects, sessions, groups, steps, turns, executions, requests, mapped folders and new evidence records. Existing numeric tool IDs stay untouched. Timestamp-looking IDs are identities, not precise event times: record created_at separately.

Algorithm under one allocator lock: validate persisted high water H; choose start=max(Date.now(), H+1); reserve [start,start+count-1] durably before returning; fail on unsafe/nonpositive integers. Use Number.isSafeInteger, never truncation, decimal suffix concatenation or 32-bit bitwise arithmetic. Safe integer ceiling is 2^53-1. [ECMAScript Number.MAX_SAFE_INTEGER](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.max_safe_integer)

Repeated millisecond and backward clock: advance H. Forward jump: IDs advance, report measured clock drift, never reset H when time returns. Logical IDs can run ahead of wall time during bulk allocations, another reason not to display ID as creation time. Batch reservation reduces one-lock-per-folder overhead; unused IDs are burned, not reclaimed. Allocation order does not imply execution completion order.

First create must enroll current numeric IDs from the bounded canonical catalogs and adopted memory, not walk source trees. Durable import admission checks collisions against this realm; conflicting existing identities fail rather than overwriting. Imported higher IDs advance H. An independently created realm can collide: no global uniqueness promise outside this allocator. Portable export must retain provenance/scope, not blindly merge numeric keys.

Reservation persistence is the critical part: an append-only reservation journal plus high-water checkpoint, owned by rab-memory, can distinguish reservations from record publication. Flush accepted reservations before acknowledgement; checksum/sequence detect torn records. Any corrupt/missing allocator state with existing records stops allocation for explicit recovery; never assume H=0. A crash after reservation leaves a gap, not a duplicate. A crash between record publication and indexing recovers by inspecting the publication record; indexes are derived. Restoring an old backup while newer allocations exist elsewhere is unsupported without explicit reconciliation.

This adds recovery complexity; compare measured implementation/maintenance cost with the SQLite alternative before committing. A simple atomic rename without a reservation protocol is not enough to claim power-loss durability. The present atomicJson does not fsync, so that claim is not available today.

Allocation realm is initially one configured .rab owner plus enrolled catalog writers. Reserve outside project locks; then perform project mutation. Establish global lock order allocator -> project -> per-run, never acquire allocator while retaining a project lock. Fail/return burned IDs rather than reverse that order. High-volume stream records use execution ID + record sequence, not an allocation per emitted line.

## Storage, scope and filesystem boundary

Proposed layout; names are recommendations, not existing folders:

```text
.rab/
  settings.json
  apps/<app-id>/settings.json
    requests/<request-id>/settings.json
    state.json
  temp/test/<execution-id>/settings.json + output artifacts
  projects/<new-project-id>/settings.json
    sessions/<session-id>/settings.json + state.json
    runs/... existing or versioned artifacts
    indexes/... derived only
```

Use apps rather than base: base already names a Tool House domain. App ID allocated once, not on each launch. Root configuration points to that app identity. Existing project keys stay readable and can remain physical locations through adapters; do not mass rename old memory folders or modify source projects for UI convenience. Numeric paths apply to new records; adopting an old string-ID project needs an explicit alias transaction.

Source settings are current execution authority for external projects; memory stores a snapshot clearly labeled as such. Do not create an independently editable memory copy of external project configuration. The adapter composes the canonical source descriptor and memory state; editing either has one declared owner.

Application scope is a real scope, not project=null secretly converted to host project. Toolbox scratch runs bind their scope once and use normal runner validation/authority. Preview-capable writers return proposed files before writes; arbitrary writers are not made safe merely by redirecting output. Browser storage holds bounded UI refs/preferences, not authoritative large reports or secrets. Explicit Clear test cancels/quiesces a run and deletes only its owned scratch artifacts; not generated source files. Durable request records/evidence are retained by default; automatic retention awaits policy. Clearing display alone is distinct from deleting evidence.

User refinement received during cross-review: code preview is wanted; template copy/rename tools may generate under `.rab/temp/test/[id]`. This supersedes this lane's initial apps/<id>/tests suggestion. Keep request/preferences under apps and temporary generated artifacts under the proposed temp/test scope. Both use the same memory owner. No disposable project is required unless a particular template contract genuinely needs project configuration; then supply a typed scratch context, not a fabricated known-project inventory entry.

Current locks were validated for cooperating local Windows processes, not SMB/NFS or independent hosts. A script read from a UNC share executes on PIXEL unless explicitly remote. Hostname and IP aliases of a share are not guaranteed to normalize to the same lock name; drive letters are host-relative. A mapped drive can conceal a network filesystem. Local-only mode must reject unsupported storage or require verified configuration, not merely reject strings beginning with backslashes.

Node documents that exclusive file flags may fail on network filesystems; its realpath is not a universal unique identity resolver. These limit claims, not proof that this specific SMB share is broken. [Node filesystem notes](https://nodejs.org/api/fs.html#file-system-flags)
SQLite WAL requires same-host access; putting its DB on a share does not solve distributed locking. For actual shared writers, run one persistence/allocation service on the storage host and call it remotely, with authentication/idempotency; that is a future deployment, not authorized setup. [SQLite WAL](https://www.sqlite.org/wal.html), [SQLite network caveats](https://www.sqlite.org/useovernet.html)

Keep existing no-age-based-lock-stealing rule. Crash locks require owner inspection and controlled recovery. Internal lock tokens/temp-file nonces are not domain record IDs; no reason to rewrite them under numeric identity migration. Content integrity hashes also stay separate from identity.

## Lifecycle and concurrency

| Operation | Retains | Changes / must not happen |
| --- | --- | --- |
| Preview | Everything | Read-only inspection; no openProject timestamp, folder creation or activation |
| Resume | Project, chosen session/action/history | Revalidate source/config and prepared approvals; unknown in-flight outcomes require reconciliation, never automatic replay |
| New action | Session history, durable project defaults | New group; remove prior target, answers, promoted action seats, approval, branch-specific temporary context |
| New session | Project defaults/knowledge and older sessions | Fresh bag derived through canonical binder; no inherited pending operation |
| Switch project | Original run's immutable scope | New window selection only; reject stale UI responses by context revision |

Window-selected project/session/action is application UI state keyed per window, not one global current-project flag. Two windows writing one session need revision-checked updates (`expectedRevision`) or explicit edit ownership. Existing serialized whole-file save prevents interleaved writes but cannot detect stale snapshots: reject stale saves rather than silently last-write-wins. Keep result publication independently keyed to original execution context.

## Compatibility and staged implementation proposal

1. **Contract/fixture milestone first:** private descriptor validator/stamp and allocator interface, no default migration. Mixed v1/v2 read fixtures; read-only project inspection; role-aware discovery tests. Candidate owners: identity lane implements `bridge/rab-node.mjs`, `bridge/rab-id.mjs`, `tests/identity-storage/`; rab-memory remains sole filesystem writer. Names are proposals.
2. **Numeric creation and storage:** one assigned owner updates memory, tool tracking, planner and generators together. Add async allocation seam before newExecution; nested runs reuse it. New session folder/state format behind explicit version. Do not release partially updated string-only endpoint/session validators.
3. **Migration adapter:** v1 loads without writes. Continuing an old session explicitly creates its v2 continuation and scoped alias map, not mutation of the old session. Alias key includes old project identity/location, session, kind and full old ID (group-1 repeats). Preserve exact old report paths, receipts and IDs. Durable cutover receipt selects one writable representation; interrupted staging is not exposed. Repeated migration is idempotent. Old v1 loader still works.
4. **Shared activation/UI:** coordinator owns service/Chat/UI wiring after lifecycle API stable. Pipeline owns mapper/streaming using numeric IDs and memory API, no second writer. Development-project audits save reports without altering type. Evidence v2 must separate ID from fact digest; leave v1 verification intact.
5. **Optional later depth:** task/step folders only after actual contention/history size requires them. No nested-folder explosion in first milestone.

Migration aliases/commit receipts are not rebuildable indexes: they preserve historical correspondence. Store/backup them with durable state. Derived address/search caches can be rebuilt. No old-record deletion is part of the plan.

## Falsifiable checks and measurements

- Frozen clock: 8 processes x 1,000 IDs, uniqueness, numeric JSON round-trip, no overwrite; clock forward/backward and MAX_SAFE_INTEGER boundaries.
- Kill between reserve/flush/return/publish/checkpoint; every acknowledged ID remains reserved, incomplete record stays invisible, corrupt journal blocks creation. Distinguish process-crash tests from power-loss guarantees.
- Batch mapping 100k folders: compare allocator batch sizes 1/64/1024, wall time, p95 wait, filesystem operations and peak RSS. No performance number claimed until measured.
- Duplicate tool IDs/import collision fail; moved tool retains ID and behavior; category with executor ancestor never runnable; inherited settings obey false/0/empty-string fixtures.
- v1 source/session/report hashes unchanged after preview and migration; same old reference resolves; colliding old group-1 in two sessions maps distinctly; interrupted/repeated migration does not fork writable state.
- Two windows select different projects; stale response discarded; running tool saves to original scope; stale session revision save rejected.
- New action clears target/approval but not project defaults; resume does not reexecute; new session preserves previous history.
- App requests work with no selected project; scratch clear never removes source outputs; large output is paged; descriptor display cannot authorize execution.
- UNC and mapped-network homes produce explicit unsupported mode in local-only allocation; do not claim distributed support from local test success.

Historical 496/499 suite is not validation of these proposals. No code/tests executed or runtime migration performed in this planning lane.

## Only user-dependent decisions

Resolved by user after comparison: one computer owns each .rab for now. Create `.rab` under the executing Windows user's profile on first run: `C:/Users/<current-user>/.rab`. Cooperating local windows/processes share that owner. It is not the house anchor, audited source or project repo; running a shared script on PIXEL still uses PIXEL's current user home. No shared cross-host production writer is required. Existing explicit RAB_HOME test override can remain, with no silent alternative production home.

Further direct user clarification: this is a local audit tool. Separate computers intentionally have independent storage/history for this scope; laptop work does not automatically appear on another computer. Server/shared storage, synchronization, federation and cross-machine identity coordination are deferred, not implementation requirements or open blockers. Earlier network/distributed comparisons explain the boundary only; do not turn them into engineering work now.

Not blocking this draft: final apps/base label, automatic scratch retention duration and whether deep task folders are desirable. Use apps, explicit clear, and shallow sessions as provisional recommendations rather than asking a long questionnaire.

## Milestone narrowing after user answers

User selected project switching + request page first, after common foundation; prompt button is deferred completely. The broad migration inventory above is NOT a prerequisite to delivering every first-milestone screen. First implement common descriptor validation, allocation for new app/request/session nodes, nonmutating inspection, scoped selection, and lifecycle transitions. Existing numeric tool IDs and v1 project/history records remain supported through adapters. Numeric conversion of all historical evidence, mapper, high-volume streaming and optional deep step folders are not in this milestone.

For resumed v1 work, either keep its existing version-specific writer until an explicit continuation, or cut over to a numeric v2 continuation once; never dual-write. Newly created identities in adopted v2 flows must be numeric, including new actions/steps/turns and attempts created there. If mixed numeric/string execution support cannot be delivered safely in the first slice, expose preview/list/request first rather than claiming v2 execution is complete. One shared allocator API can initially reserve single IDs; batch tuning/journal compaction are scale work, but collision/crash fail-closed behavior is foundational. Identity, recovery and compatibility tests precede any runtime migration, which remains separately authorized work.
