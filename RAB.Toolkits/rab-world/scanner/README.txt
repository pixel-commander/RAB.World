WORLD SCANNER
=============

One explicit scan pass. Give it the drive/folder PATH to inspect and the
WORLDS_PATH that owns the world folders. It is the beacon finder: it finds
beacon.json records, uses their numeric world value to route them, indexes
direct child settings.json records into each beacon folder's manifest.json,
and records the full beacon house keys in that world's beacons/manifest.json.

It does not open a port, start a server, or remain running. Invalid records are
reported as skips instead of being guessed or replaced.
