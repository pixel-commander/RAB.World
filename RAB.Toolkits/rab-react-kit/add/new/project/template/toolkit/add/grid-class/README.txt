ADD GRID-CLASS

Required: name (kebab-case suffix) and location (absolute parent folder).
Creates grid-NAME/ containing its CSS and settings.json.
Only the named CSS template and settings.json are used; old copied presets,
demos and SOURCE.json are retained but unused. Existing folders are preserved.

SIGNAL SETTINGS
The tool populates template/settings.json from collected inputs and generated
identity. path is the output folder relative to the selected project root
when contained there, otherwise absolute. type identifies the stamped item;
meta.kind is signal. Template defaults remain unless explicitly overridden,
including transmitting:false. settings remains the template input array.
