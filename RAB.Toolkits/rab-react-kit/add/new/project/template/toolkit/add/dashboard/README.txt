New Dashboard

Creates a React dashboard by composing New Page, Apply Grid Layout, New Navigation, and Insert Component Into Area. Defaults to a header-main grid with SiteNav in header.

Box key: react/add/new/dashboard
Inputs are declared in settings.json. The local template owns the shape.
Box supplies shared rendering and artifact-writing helpers; public child tools
run through helpers.runTool. Existing output is never silently replaced.
See contract.json for the result and SOURCE.json for the preserved identity.

SIGNAL SETTINGS
The tool populates template/settings.json from collected inputs and generated
identity. path is the output folder relative to the selected project root
when contained there, otherwise absolute. type identifies the stamped item;
meta.kind is signal. Template defaults remain unless explicitly overridden,
including transmitting:false. settings remains the template input array.
