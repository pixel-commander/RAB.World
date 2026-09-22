DATA: GUARD, DEFAULT, PASS ON
===========================

Every receiver assumes input can be absent or invalid. Narrow it before use
and render only valid values. DataKeys supplies shared names; the owner adds
its specific requirements. The key reference is:
  ../../house-keys/data/README.txt

ABSENT IS DIFFERENT FROM FALSE, ZERO OR EMPTY TEXT

Use the owner's actual absence rule. For a key whose default applies only
when undefined, resolve it explicitly:

  const count = input.count === undefined ? defaultCount : input.count;
  const description = input.description === undefined
    ? defaultDescription
    : input.description;

Here input is already narrowed to the owner's record shape. Check its count
is a valid number and description is a string before using them. Supplied
invalid data is a validation problem, not an invitation to silently default.

Avoid input.count || defaultCount: it replaces a valid 0. The ?? operator
also treats null as absent, so use it only when that matches the contract.
false and an allowed empty string must survive the same way.

THE BAG CONTRACT

A component accepts the contract it passes onward. Fill absent keys from
its own defaults and preserve the other supplied fields. Place intentionally
resolved keys last so an earlier invalid or missing key cannot undo them:

  const bag = { ...input, count, description };

Do not rebuild a smaller bag that drops fields a child needs. Own shared
logic once; composite operations call the owner. UI handlers follow this
same inheritance pattern, detailed in ../handlers/README.txt.

IDENTITY AND DATES

Use the existing ID owner when a project supplies one. New record IDs use
Date.now() epoch milliseconds; keep the ID when the record moves or its name
changes. Preserve inherited string IDs where that contract accepts them.
Diagnose a collision instead of hiding duplicate execution with entropy.

Numeric date, date_start, date_added and date_end values in DataKeys use epoch
milliseconds. Validate them and any required ordering before display or use.
Do not assume every project timestamp has this shape: a named field such as
an inventory's meta.scanned_at follows its own contract.

CHECK THE RESULT

Exercise absent input, malformed input, zero, false, empty strings and a valid
record. Verify that supplied fields and identity survive the boundary, that
invalid input cannot reach rendering or mechanics, and that defaults fill only
the keys they own. Test the meaningful behavior rather than a copied version
of the implementation.

SOURCES
  ../../../HouseKeys.types.ts -- DataKeys and EventsKeys
  ../../../ganglion/coding/css/oocss/RULES.txt -- I1, H3-H4, H6-H7
  ../../../RAB.Toolkits/rab-react-kit/RULES.txt -- supplied values and defaults
