# Kitchen Audits & Scenario Checkers

## Recipe audits
- audit/kitchen/recipe-completeness
- audit/kitchen/ingredient-reference
- audit/kitchen/allergen-declaration
- audit/kitchen/unit-consistency
- audit/kitchen/time-budget
- audit/kitchen/equipment-capacity
- audit/kitchen/temperature-target
- audit/kitchen/unverified-safety
- audit/kitchen/constraint-conflict
- audit/kitchen/substitution-impact

## Generic checkers
- check-required-seats
- check-one-missing-seat-solvable
- check-underdetermined
- check-constraint-set
- check-time-budget
- check-available-resources
- check-measurement-present
- check-reference-authority
- check-reference-scope
- check-result-verified

These should work for cookies, date-night dinner, home meat, and industrial scenarios.

## Scaling audits
- audit/kitchen/scaling/linear-assumption
- audit/kitchen/scaling/pan-geometry
- audit/kitchen/scaling/equipment-capacity
- audit/kitchen/scaling/time-assumption

## Industrial/process audits
- audit/food-process/process-authority
- audit/food-process/missing-critical-parameters
- audit/food-process/outside-validated-window
- audit/food-process/underdetermined-process
- audit/food-process/unverified-process
- audit/food-process/sensor-missing
- audit/food-process/unit-consistency
- audit/food-process/throughput-vs-residence
- audit/food-process/process-change-revalidation

Industrial safety values must come from plant/process-specific validated support or an applicable authoritative source. Generic consumer rules must not be promoted to validated industrial process schedules.
