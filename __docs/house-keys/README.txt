HOUSE KEYS
==========

Shared names keep projects and components self-similar: one key, one meaning,
with the same name and contract carried through every layer.

  data/       Record identity, labels, counts, dates and event collections.
  handlers/   The agreed handle* names and their shared calling shape.
  settings/   Item identity, input declarations and owner metadata.
  manifests/  Collections of identified items using the same nested shape.
  project/    How those keys apply inside a particular project.

One example captures the idea:

  /**
   * Every house handler keeps the same two-slot shape. Both slots stay optional
   * under receiver law: expect nothing and guard anything that arrives.
   * data carries the thing; type is the final dispatch slot.
   */
  handleAnything(data?, type?)

HouseKeys.types.ts at the RAB.World root owns the shared TypeScript vocabulary.
Each leaf explains its keys and points to its implementation owner. Owners
narrow the keys they use; there is no universal HouseKeys component contract.
