RRAABBIITT tools/audit
======================
Audit-domain Tools are read-only inspection capabilities unless explicitly stated otherwise.

Public paths carry semantic truth: audit/find/*, audit/count/*, audit/inspect/*.
Mechanical scanner type is intentionally private under tools/audit/_engines/.

The audit/theme expansion adds semantic Tools while keeping the law:
  MANY SEMANTIC TOOLS, FEW ENGINES.

Theme/front-end coverage includes:
  - CSS custom property declarations and var(--token) usage
  - theme.* / tokens.* property-reference candidates
  - className/class usage in TS/TSX/JS/JSX/MJS/CJS/HTML
  - CSS-family class selector candidates
  - React component declaration candidates
  - JSX component usage + aggregate counts
  - composite inspect-theme child-Tool report

See ../../AUDIT_THEME_EXPANSION.txt for the full capability list and verification receipt.
