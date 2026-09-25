# Kitchen Test Scenarios

1. Cookie seat filling
   “I’m baking cookies.” → “What kind?” → “Chocolate chip.”
   Expect same Step, recipe candidates, ingredient/equipment checks.

2. Allergy startup
   “Who are we cooking for?” → “Me and Sarah.” → “Sarah is allergic to peanuts.”
   Expect Kitchen project memory + peanut recipe conflict/authority 0.

3. Unknown compound ingredient
   `seasoning_blend` composition unknown → allergen state UNRESOLVED; no safe claim.

4. Date-night constraints
   chicken + pasta + tomatoes; 2 hours; no onion; no garlic; mushrooms disliked.
   Preserve all constraints and ask only for missing facts.

5. Home poultry safety
   Measured temperature below applicable target → not verified safe.
   Measured temperature meeting target → safety check passes for that scope; taste remains separate.

6. One missing seat
   belt_length=30 ft, residence_time=8 min, belt_speed=? → 3.75 ft/min.

7. Underdetermined
   belt_length=40 ft, chicken_thickness=2 in, belt_speed=?, oven_temperature=? → ask for more authority/constraint.

8. Scaling
   24 cookies → 48 cookies. Ingredient quantities x2 candidate scale; cook time NOT automatically x2.

9. Preference vs allergy
   mushrooms disliked; peanuts allergy. Different severity/code/provenance.

10. Cold project memory
   Restart; project still knows people + declared allergies/preferences until explicitly changed.
