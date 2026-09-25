# RRAABBIITT terminology legend

This legend keeps project-specific language mapped to common engineering language. The RRAABBIITT term may remain in code/docs when it has a precise project meaning; the engineering term is the preferred translation when talking outside the project.

| RRAABBIITT term | Preferred engineering term | Project-specific meaning |
| --- | --- | --- |
| Tool | Tool / capability / operation | Any invokable capability in the House. |
| Stamp | Template-backed generator / scaffolder | A Tool subtype that owns `template/` and materializes a known artifact shape. |
| Seat | Typed slot / binding / parameter | A named value position that may be resolved, returned, or remain unresolved. |
| Scoped seat | Scoped binding | A seat whose identity includes its task/owner so same-label seats cannot collide accidentally. |
| Bag | Scoped execution context / state | Persistent/session context carried between legal boundaries. |
| Shape | Typed intermediate representation (IR) | Inspectable runtime representation reduced toward a normal form. |
| Runner | Executor / orchestration runtime | Owns child invocation, continuation, returned-seat binding, trace, and receipts. |
| Flow | Workflow / pipeline | Inspectable data describing ordered/graph execution. |
| House | Capability registry / Tool registry | Registered Tool/Stamp address space. |
| Straw | Explicit return channel / return path | Shorthand for an intentional path by which a child result crosses a scope boundary. Prefer “return channel” in external discussion. |
| Scaffolding Cleanup Pass | Cleanup/finalization pass | Strip-only Tool that removes RRAABBIITT construction markers from an already-built artifact. It does not resolve or infer values. |
| Pressing | Fine-tuning | Historical shorthand; use “fine-tuning” externally. |

## Preferred phrasing examples

Instead of: “the Stamp has a straw back to the Bag”

Use: “the template-backed generator exposes an explicit return channel into the scoped execution context.”

Instead of: “close the doors when the page is done”

Use: “run the Scaffolding Cleanup Pass after construction to remove build-time markers.”
