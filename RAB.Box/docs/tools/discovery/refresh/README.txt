REFRESHING DISCOVERY
===================

After adding or changing a definition, request a fresh scan. The shared owner
supports listTools({fresh: true, context}) and scan({fresh: true, context}). Use
the selected project context when its custom toolkit or overrides matter.

The server's GET /api/tools and POST /api/tools/find handlers request fresh
discovery. Internal calls can reuse a cached catalog unless fresh is requested.
This is request-driven refresh; it is not a background filesystem watcher.

Read both items and unavailable in the returned catalog. A folder with no
settings.json is skipped. A malformed definition, missing executor, invalid
contract, conflicting path metadata, or inaccessible toolkit needs its reported
cause corrected. Duplicate tool IDs or full tool paths make all contenders
unavailable; there is no first-one-wins selection.

Check domain and include-stamps filters if an available tool is absent from a
particular list. Refreshing discovery does not prove that a tool executes or
that a chat phrase selects it. Test those behaviors separately when authoring.

Source: ../../../../bridge/tool-house.mjs (scan, listTools),
../../../../bridge/service.mjs (toolsList, toolsFind).
