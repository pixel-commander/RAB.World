NEW UI TOOLKIT
==============

Use base/templates/toolkits/ui through the shared Box runner to create an empty
UI toolkit. Supply folder as an absolute destination and type as the lowercase
project type, such as react, angular, or html. Optional name, title, and
description describe the new toolkit. The destination must be new or empty.

template/ owns the reusable folder structure and root files. __PROJECT_TYPE__
is replaced in folder paths and file contents. Root toolkit settings receive a
fresh identity from the shared memory owner.

The generated toolkit follows project type / optional subject / action /
qualifier / house type. add/new creates an artifact; add/sub/component creates
a component inside its parent's folder; insert/component places an existing
component in rendered markup. CSS uses the container-atom, action-atom,
effect-atom, and grid-atom house keys.

Placeholder tool folders are empty. They become public capabilities when
their settings.json and supported executor are supplied. The root toolkit
settings describe the collection, not an implemented React or Angular tool.

Template-backed tools use semantic names without a required stamp- prefix.
Box currently retains its internal stamp kind for tools owning template/.
The source contract records the implementation mechanism.

The executor uses the shared artifact writer and returns created files,
directory paths, and provided.seats. It refuses an occupied destination.
Filesystem failures can leave partial output; the error retains that evidence.
It does not install packages, start services, or register a toolkit link.

Use the existing toolkit link owner when the toolkit is ready for Box:
bridge/toolkit-links.mjs, documented in docs/paths/toolkits/.
Root records and execution history remain under the executing user's .rab.
