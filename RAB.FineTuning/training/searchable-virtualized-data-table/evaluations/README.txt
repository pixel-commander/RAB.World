HELD-OUT EVALUATIONS
====================
Copy evaluation.template.json to a stable case ID file and fill it deliberately.
These cases measure transfer; they must never enter a training export. Templates
are not runnable tests. Define real observable assertions and a review rubric.
Use split validation for tuning and test for final held-out assessment.
Keep each near-duplicate task family in one split. Test the same skill using fresh
code, plus a boundary where the rule should not apply. Related skills can appear in
both training and evaluation; near-duplicate task examples must not.
reference_answer is private grading context, never part of messages sent to a model.
Store checker paths relative to this session and record their versions/hashes.
See ../PROCESS.txt for contamination handling and comparison rules.
