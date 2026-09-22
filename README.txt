RAB.World - MODEL PROJECT CONTEXT
--------------------------------

Audience: LLMs, coding agents and cloud models.
Read START_HERE.txt first for boot instructions, repository boundaries,
download/setup commands and the working protocol. This file owns project
purpose and context. Human documentation lives in __docs.

PROJECT PURPOSE

RAB.World is the home for our AI-human interaction project and the baseline
for all things self-similar. This is where we track house keys, naming
conventions, code styles and interface testing for RAB.Box.

It is also the central point for developing training materials from LLM
code reviews, keeping the reasoning, examples and verification evidence
alongside the findings.

PROJECT HOME

On laptop PIXEL, the working project is C:\RAB.World. Use that root explicitly
if the session starts in the older saved workspace. On another computer or
in a cloud environment, use the actual RAB.World checkout root instead.

RAB.Box now runs locally. Older documents or configurations may still refer
to server locations. Check the current file owner and configured connection
before using a path; a server drive letter is not a local drive address.

THE PARTS OF THE HOUSE

RAB.Box
The input box that turns words into tools into deterministic output results.

RAB.Toolkits
The tools that plug into RAB.Box.

__docs
Human documentation: explanations of the house, conventions, examples and
training materials developed from code reviews. Read task-relevant files
when needed; this folder is not an automatic model boot bundle.

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

START_HERE.txt owns the boot and working protocol. This README owns project
context. Detailed rules, skills and contracts stay with their current owners.

Self-similarity is the design target. The purpose described here does not
mean every existing part has already been verified against that target.
