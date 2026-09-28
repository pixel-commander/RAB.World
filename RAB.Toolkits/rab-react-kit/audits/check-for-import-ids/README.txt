Check for Import IDs

Inputs: path (source folder), file (source filename).
Run independently against settings.json or after check-for-imports. The preceding tool uses name for its filename input; pass that same filename as file here.
Each required row's relative or absolute import path resolves to a file or directory. Extensionless TS/JS files are supported. Reads settings.json in the dependency file's directory (or the imported directory itself). Copies its id into the row, preserving other fields. Never invents IDs.
Reports missing import paths, missing settings, invalid JSON, and missing IDs in notes. Package names and aliases are reported as unresolved; no guessing or ancestor search. Existing IDs remain untouched if lookup fails.
No dependencies. No automatic scan chaining or source changes.
