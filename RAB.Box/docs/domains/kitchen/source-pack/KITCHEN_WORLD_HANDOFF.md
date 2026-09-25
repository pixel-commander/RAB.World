# RRAABBIITT Dumbot — Kitchen / Baking Mood

## Purpose
Kitchen is an out-of-domain proof that Dumbot is not merely a software IDE. It should demonstrate that the same symbolic organism can operate in a physical World using the same Shapes, missing seats, reducer, parent/child composition, blockers, verification, receipts, and project memory.

Kitchen belongs in the House under `tools/kitchen/`.

## Mood
`mood = baking` changes only the active Tool set. It does not change the tokenizer, grammar/Shapes, reducer, project memory mechanics, House law, blocker/disqualifier mechanics, verification, receipts, or parent/child semantics.

## Project startup
A new Kitchen project asks:

1. Who are we cooking for?
2. Does anyone have food allergies or intolerances?

Allergy status is a required safety seat. If unanswered: `status=input-required`, `missing=[allergy_status]`, `authority=0` for safety claims.

Human-declared allergies are Kitchen PROJECT MEMORY scoped to the named people in that project. They are not global truth.

## Constraint classes
- Safety hard constraint: allergy, cross-contact uncertainty, required safe temperature, validated industrial process boundary.
- Human hard constraint: no onion, no garlic, vegetarian, religious/dietary exclusion.
- Preference: hates mushrooms, prefers crispy cookies, likes spicy food.
- Goal/social constraint: date arrives in 2 hours, avoid garlic/onion for date night, serve by a deadline.

## Same disqualifier shape as Dev
Do not invent Kitchen-specific disqualifiers.

- allergy status missing → `input-required`
- ingredient allergen composition unknown → `input-required` or `lookup-failed`
- recipe contains declared allergen → `conflict`, `authority=0`
- malformed temperature/quantity → `invalid-input`
- validated process relation unavailable → `lookup-failed`/UNRESOLVED

A UI may render a Disqualifiers section, but the source of truth remains ordinary missing/errors/conflicts/status.

## Human-teachable
Humans can explicitly teach scoped facts such as:
- “Sarah is allergic to peanuts.”
- “Mike hates mushrooms.”
- “This oven runs hot.”
- “I have a 12-inch cast iron pan.”
- “We always use this sheet pan for these cookies.”

Safety-sensitive observations should not silently become universal rules.

## Cookie benchmark
Human: I’m baking cookies.
Dumbot: What kind?
Human: Chocolate chip.
Dumbot: I know these recipes. Recipe A requires flour, butter, sugar, eggs and chocolate chips. Do you have those?
Human: Yes.
Dumbot: READY → plan.

## Date-night benchmark
Human: I have chicken, pasta and tomatoes. My date gets here in 2 hours. No onions. No garlic. She hates mushrooms. What can I make?

Canonical state:
- goal=dinner
- time_limit=120 minutes
- available_ingredients=[chicken,pasta,tomatoes]
- forbidden_ingredients=[onion,garlic]
- disliked_ingredients=[mushroom]
- target_meal=UNRESOLVED

Candidate filtering:
known recipes → inventory → allergy hard gate → exclusions → preferences → time → equipment → legal candidates.

Dumbot asks only for the smallest missing information required to make a surviving candidate executable.

## Verification
`CALCULATED ≠ VERIFIED`
`EXECUTED ≠ VERIFIED`

A plan may estimate cook time. A thermometer or validated process measurement verifies the actual result. Taste is human verification and should be stored as preference/experience, not global truth.
