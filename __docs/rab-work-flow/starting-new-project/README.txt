STARTING A NEW PROJECT WITH RAB.BOX
===================================

PURPOSE
RAB.Box can start a new project without first loading an existing project.
Project setup gathers the project type, name, root path, and any
type-specific choices in memory. No project source folder or Box-owned project
record is created until the creation step completes.

START BOX
From the RAB.Box repository, run:

  npm start

On Windows, RUN_UI.cmd starts the same local server after checking for Node.js
22 or newer. The usual local address is:

  http://127.0.0.1:52814

START FROM THE UI
1. Open the Chat view.
2. Select Start new project in the right-hand project column.
3. Complete the new-project setup: project kind, project name, and the parent
   root path where the source project will be created as root path/name. React projects also ask
   whether to add a UI kit.
4. Review the stated destination and answer the final confirmation.
5. Box creates the selected project, registers it in the user's .rab storage,
   and opens the initial project-start session.

The new-project action is a creation flow, not a load-project action. The UI
should show the project-start form in that column; it should not require a
placeholder or previously loaded project to exist.

START FROM BOX CONVERSATION
In a temporary project-setup conversation, say:

  Start a new project

Box asks the same required questions one at a time. Supply the kind, name, and
root path, answer any type-specific question, then confirm the proposed
creation. The conversation records the setup steps and hands them to the new
project's initial session after successful creation.

SAVED WORK
The setup draft is not saved. The new project's source files and Box-owned
settings, sessions, receipts, logs, and results are saved only after explicit
confirmation and successful creation. Box-owned records live under the
executing user's home .rab directory, separate from the RAB.Box source checkout.

NO DEFAULT PROJECT
HOST.json does not select a placeholder project. Opening Box without a selected
project is valid. Project-specific work must select an existing project or
complete this new-project flow first.

BASIS AND LIMITS
Based on the current RAB.Box source:

  ..\..\..\RAB.Box\magic-box\index.html
  ..\..\..\RAB.Box\bridge\service.mjs
  ..\..\..\RAB.Box\bridge\project-conversation.mjs

Use the owning Box contracts when changing creation behavior.
