__WORLD_NAME__

This world belongs to one computer/user instance. Its root is this folder:
.rab/worlds/__WORLD_NAME__ under that user's home.

settings.json owns its identity, title, description, creation date and path
declarations. The world holds shared information that projects can refer to.
Projects keep their own records under .rab/projects; creating a world does
not move them or make copies of their source folders.

paths starts as an empty array. Beacon discovery and scanner visibility
are separate capabilities; creating this world does not start a scanner.
