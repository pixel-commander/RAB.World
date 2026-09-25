# Kitchen Tool Blueprint

All names are conceptual. Fit them to current House metadata/naming before implementation.

## Project / people / memory
- kitchen/project/start
- kitchen/project/who-cooking-for
- kitchen/project/load-constraints
- kitchen/project/list-people
- kitchen/project/add-person
- kitchen/project/remove-person

## Allergies
- kitchen/allergy/teach
- kitchen/allergy/remove
- kitchen/allergy/list
- kitchen/allergy/check-ingredient
- kitchen/allergy/check-recipe
- kitchen/allergy/check-meal
- kitchen/allergy/check-substitution
- kitchen/allergy/check-label
- kitchen/allergy/check-cross-contact

Rules:
CONFIRMED ALLERGEN → BLOCK
UNKNOWN ALLERGEN RELATIONSHIP → UNRESOLVED
CROSS-CONTACT UNKNOWN → NOT VERIFIED SAFE
ALLERGY ≠ PREFERENCE

## Preferences / exclusions
- kitchen/preference/teach
- kitchen/preference/remove
- kitchen/preference/list
- kitchen/constraint/add-exclusion
- kitchen/constraint/remove-exclusion
- kitchen/constraint/check

## Recipe
- kitchen/recipe/list
- kitchen/recipe/find
- kitchen/recipe/load
- kitchen/recipe/filter
- kitchen/recipe/compare
- kitchen/recipe/check-inventory
- kitchen/recipe/check-equipment
- kitchen/recipe/check-time-budget
- kitchen/recipe/check-constraints
- kitchen/recipe/build-plan

## Inventory
- kitchen/inventory/list
- kitchen/inventory/add
- kitchen/inventory/remove
- kitchen/inventory/check
- kitchen/inventory/check-required
- kitchen/inventory/find-missing
- kitchen/inventory/build-shopping-list

## Measurement / scaling
- kitchen/measure/convert
- kitchen/scale/servings
- kitchen/scale/base-ingredient
- kitchen/scale/batch
- kitchen/scale/pan-area
- kitchen/scale/compare-ratios

## Math
- kitchen/math/solve-one-seat
- kitchen/math/ratio
- kitchen/math/percent
- kitchen/math/residence-time
- kitchen/math/belt-speed
- kitchen/math/throughput
- kitchen/math/rate
- kitchen/math/unit-convert

Law: one unresolved mathematical seat + complete valid relationship → solve. Multiple unresolved independent seats → underdetermined → ask/resolve.

## Home safety
- kitchen/safety/get-target
- kitchen/safety/check-target
- kitchen/safety/check-measured-temperature
- kitchen/safety/check-rest
- kitchen/safety/check-reheat-target
- kitchen/safety/check-rule-scope
- kitchen/safety/get-reference

Cooking duration is not the safety verifier.

## Timing / planning
- kitchen/time/estimate-total
- kitchen/time/check-deadline
- kitchen/time/build-timeline
- kitchen/time/find-critical-path
- kitchen/time/add-buffer

## Equipment
- kitchen/equipment/list
- kitchen/equipment/check
- kitchen/equipment/find-missing
- kitchen/equipment/check-capacity

## Substitutions
- kitchen/substitution/find
- kitchen/substitution/check-allergy
- kitchen/substitution/check-function
- kitchen/substitution/apply
- kitchen/substitution/recalculate

## Verification / receipts
- kitchen/verify/recipe-ready
- kitchen/verify/meal-ready
- kitchen/verify/temperature
- kitchen/verify/human-result
- kitchen/receipt/build
- kitchen/receipt/compare-run

## Candidate Stamps
Only if they own `template/`:
- stamp-recipe
- stamp-meal-plan
- stamp-shopping-list
- stamp-baking-checklist
