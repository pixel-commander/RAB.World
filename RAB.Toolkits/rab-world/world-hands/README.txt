WORLD HANDS
===========

World Hands is the callable catalog for the world toolkit. Invoke
world/world-hands through Box's existing Tool House runner with empty options.
It uses fresh discovery and returns the toolkit's available world hands,
their House Keys, input settings, authority, and callable keys.

A plugin or hand host can present these inputs, collect missing values,
then call the selected key through the same Box runner. Listing hands does
not execute them. Discovery diagnostics accompany the result.

The host owns standby and process lifetime. This tool does not introduce
another server, watcher, or runtime. In particular, world-watcher currently
creates a watch plan; it does not itself run a persistent watcher.
