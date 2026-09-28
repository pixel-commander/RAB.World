CSS parser pipeline

Inputs: path is the CSS source; paths is the ordered list of token sources.
Each child is callable independently. The parent uses injected runTool when available; standalone calls return results in memory without persistence or timing.
Rules preserve declaration order, importance and enclosing at-rules. Static token resolution covers unconditional root declarations, retains unresolved references and reports missing tokens and cycles. Scoped and conditional CSS is retained for the browser. Imports are not followed automatically; supply token dependencies explicitly.
