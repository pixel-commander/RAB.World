RRAABBIITT MAGIC BOX v0.9.3 — START HERE
========================================

PURPOSE
-------
README RULE: WE DO NOT INDEX OR COUNT SHIT IN THE README. EVER.
Duplicated inventories and counters cause drift and wobbles. READMEs explain
contracts, storage, and workflows. Link to authoritative generated indexes and
their rescan tools; keep dated verification totals in reports, not READMEs.
This applies to every README in this project, including historical release totals.

v0.9.3 adds the missing construction composition layer above the verified v0.9.2
nested-seat / construction-seat foundation.

LAUNCH
------
Windows:
  RUN_UI.cmd

Any platform with Node >= 22:
  node server.mjs --open

VERIFY
------
  npm test
  npm run language:audit

Optional UI receipts:
  python tests/browser_interaction.py
  python tests/browser_turn_checker_v085.py

RECORDED RELEASE CATALOG
-------------
249 public capabilities
  17 Stamps
  232 Tools
  0 unavailable

RECORDED RELEASE RECEIPT
---------------------
389 / 389 Node tests passing.
Language audit PASS.
Main browser: 18 checks, 0 JS errors.
Turn Checker: 3 checks, 0 JS errors.

RECOVERY REVIEW HARDENING
-------------------------
- exact import-source collision guard for component insertion
- nested seat/area targeting for Apply Grid Layout
- live Hand terminology cleanup
- normal single-folder release packaging

NEW CONSTRUCTION CAPABILITIES
-----------------------------
- New Page Stamp
- New Dashboard Stamp
- Apply Grid Layout Tool
- Insert Component Into Area Tool
- Set Scroll Y Tool
- Add Scroll Wrapper Tool

CONFLUENCE
----------
Page-first and component-first construction orders converge to the same final page.
The Dashboard Stamp also converges with the equivalent primitive construction sequence.

SCAFFOLDING
-----------
Build-time data-rab-seat markers remain machine addresses only.
The Scaffolding Cleanup Pass strips them after construction and has no semantic authority.

NEXT READING
------------
README.md
docs/CHANGES_v0.9.3.txt
docs/GLOSSARY.md
docs/CONSTRUCTION_SEATS.md
TEST_REPORT.txt
