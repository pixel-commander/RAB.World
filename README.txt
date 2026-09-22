RAB.World
=========

PROJECT PURPOSE

RAB.World is the home for our AI-human interaction project and the baseline
for all things self-similar. This is where we track house keys, naming
conventions, code styles and interface testing for RAB.Box.

It is also the central point for developing training materials from LLM
code reviews, keeping the reasoning, examples and verification evidence
alongside the findings.

PROJECT HOME

The working project is C:\RAB.World on this computer. Use this root explicitly
if the session starts in a different directory with the same project name.

RAB.Box now runs locally. Older documents or configurations may still refer
to server locations. Check the current file owner and configured connection
before using a path; a server drive letter is not a local drive address.

THE PARTS OF THE HOUSE

RAB.Box
The input box that turns words into tools into deterministic output results.

RAB.Toolkits
The tools that plug into RAB.Box.

__docs
The home for documentation files, including explanations of the house and
training materials developed from code reviews.

ganglion
The intended central home for the skills required to produce acceptable
code. Read the applicable skills and rules when they exist; a named folder
does not establish that its planned contents have been implemented.

__shared
Where the shared interface will live for internal use and administration.
It will display documentation and skills, provide searches, and track
features and todos.

HOW THEY CONNECT

RAB.Box turns intent into tool execution and results. RAB.Toolkits supplies
the tools. ganglion provides the skills that guide acceptable implementation
and review. __docs records the explanations and teaching material. __shared
will provide the internal interface for finding and working with that
knowledge and tracking the work.

The development loop is to build or reuse a capability, inspect its output,
review it against the applicable rules, verify the findings, and carry useful
reasoning and examples into documentation and training material. A review
claim needs evidence before it becomes an accepted lesson.

COLD START

1. Read this README for the project purpose and the roles of its parts.
2. Use the current request to identify the area of work. Read that area's
   AGENTS.md, README and RULES.txt when present before editing it.
3. Read only the relevant skills, contracts and stamp guides for that task.
   Keep orientation narrow; __docs is not a bundle to load in full.
4. Check current names and paths on disk. Prefer the implementation owner's
   current contract over an older explanatory snapshot in __docs\about.
5. Reuse canonical names, keys, contracts and existing stamps. Apply each
   area's own rules; do not impose one toolkit's file layout on everything.
6. Verify the changed output and behavior with appropriate checks. Report
   what was observed, what remains unverified, and any missing rule source.

Orientation supplies context. Starting services, executing tools, training
models, changing configuration or publishing work follows the current task,
not the fact that those activities are mentioned here.

BOOT ENTRY POINT

AGENTS.md beside this README directs project sessions to this overview.
Start new project sessions from C:\RAB.World where possible. A session
opened directly in a nested repository also needs this project overview;
do not assume its tool automatically loads instructions above that repo.

Keep the project description here as the shared source, with detailed rules
and implementation guidance at their owners.

Self-similarity is the design target. The purpose described here does not
mean every existing part has already been verified against that target.
