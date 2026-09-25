RRAABBIITT MAGIC BOX v0.8.1 — LANGUAGE / SEAT COMPILER
=====================================================

ACTIVE RUNTIME LANGUAGE
-----------------------
The v0.8.1 front door is strict and deterministic after tokenization:

    words / literals / known entities
    -> lexical candidate types
    -> grammar + order + Bag/context
    -> 12-seat canonical frame
    -> capability-shape comparison
    -> Tool / Stamp contract binding

The 12 core semantic seats are declared in seat-schema.json:
    domain, operation, target, target_type, quantifier, predicate,
    relation, name, value, reference, scope, output

`data_types` is capability/request metadata beside the 12 seats.

WORDS DO NOT OWN SEATS
----------------------
type-mapper.json tells the parser what a word/span COULD be: noun, verb,
quantifier, pronoun, preposition, adjective/predicate candidate, etc. It may also
advertise possible senses. Grammar/order/context decide what a particular occurrence
means and which seat it fills.

This is intentional. Example:
    add component TestOne          -> create component
    add container-main to Header   -> attach resource
    add div to Header              -> create child div

The word `add` is not hard-mapped to one seat value.

STRICT UNKNOWN HANDLING
-----------------------
There is no spell correction in v0.8.1. Unknown ordinary words remain visible language
gaps and block execution. Quoted literals, paths, explicit identifiers and verified
project/run entities are typed values and may bypass ordinary vocabulary lookup.

Example that MUST fail:
    nd thwies willll sete tehm all fof

A cloud/local LLM may sit in front of Magic Box later and propose normalized text or
a frame, but the deterministic Box still validates the result. LLM interpretation
never grants execution authority by itself.

WORD INVENTORY
--------------
Active base inventory: language/type-mapper.json
Operator additions:    language/user/type-overrides.json
Coverage probes:       language/coverage-samples.json
Audit tool:            node language/tools/audit_language.mjs verification/language-audit.json

The base mapper is intentionally much larger than the original demo vocabulary, but
it is not claimed to be English-complete. The included audit report records entry,
form, phrase and collision counts. Duplicate forms are allowed when a spelling has
multiple legitimate lexical roles (for example `report` can be noun or verb).

UPDATING THE DECODER WITHOUT EDITING PARSER CODE
------------------------------------------------
Open the Language tab in the workbench and use `Decoder override`, or edit:
    language/user/type-overrides.json

An override supplies lexical candidates only:
    word/form -> possible linguistic type(s) / possible sense(s)

It does NOT directly say `this word fills operation`. The parser still uses sentence
structure, order, known entities and Bag context.

Recommended repair loop:
1. reproduce the failed Turn;
2. inspect unknown word / ambiguous seat evidence;
3. add the smallest reviewed lexical candidate or parser construction;
4. replay the same Turn;
5. add a close contrast test so the fix does not collapse a neighboring meaning.

CAPABILITY SIDE USES THE SAME COMPILER
--------------------------------------
Tool/Stamp descriptions are compiled through the same seat parser. This makes
request-shape <-> capability-shape comparison inspectable instead of raw keyword
matching. `tests/capability-shapes.test.mjs` checks that every packaged capability
description compiles, and that audit Tool descriptions match their declared
expected_shape where supplied.

PRIOR LANGUAGE RESOURCES
------------------------
reference/prior-language/ contains the earlier v0.2 exact role/prefix language map.
It is useful reference and test material, not active runtime authority.

OPTIONAL NLTK / WORDNET LAB
---------------------------
The older language resource bench is preserved beside the active compiler:
- examples/seats.fcfg: original feature-grammar experiment in NLTK format;
- tools/probe_grammar.py: optional NLTK grammar probe;
- tools/export_wordnet.py: optional selected WordNet sense exporter;
- imports/workbench-seed.json: small original review-only sample data.

NLTK/WordNet are NOT required by the runtime and imported review data never silently
changes executable aliases or permissions.

Optional setup:
    python -m pip install -r language/requirements-optional.txt
    python language/tools/probe_grammar.py

Optional WordNet export:
    python -m nltk.downloader -d language/nltk_data wordnet
    python language/tools/export_wordnet.py create build component --data-dir language/nltk_data --output wordnet-review.json

HOUSE LAW
---------
Unknown stays unknown. Broad/fuzzy discovery can propose candidates, but deterministic
execution begins only after language, capability, contract and authority gaps are gone.

SHAPE-1 PROPOSAL GATE (v0.8.1)
------------------------------
Cheap/local/cloud models may help generate candidate lexical coverage, but proposals do
not become live authority automatically.

Directories:
    language/proposed/   raw candidate batches awaiting review
    language/reviewed/   accepted/review reports and promoted batches
    language/rejected/   explicitly rejected or rewritten candidate material

Review a candidate batch:
    node language/tools/review_shape1.mjs language/proposed/<file>.json verification/<report>.json

The review tool checks schema, compares candidate lemmas/forms against the live mapper,
and reports new lexical/phrase type vocabulary, collisions and extensions. Semantic
promotion remains reviewed rather than automatic.

The parser now exposes Shape 1 directly. Shape 1 preserves word/phrase possibilities;
Shape 2 uses grammar/order/context to resolve them. A recognized multi-word phrase may
cover standalone tokens that are not independently in the dictionary, e.g. `spin up`.

See:
    language/SHAPE_PIPELINE.txt
    language/GEMINI_NEXT_ROUND.txt
