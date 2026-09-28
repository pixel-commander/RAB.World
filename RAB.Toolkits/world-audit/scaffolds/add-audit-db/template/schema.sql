CREATE TABLE audit_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  files TEXT CHECK(files IS NULL OR (json_valid(files) AND json_type(files)='array')),
  title TEXT,
  description TEXT,
  world TEXT NOT NULL,
  project_name TEXT,
  options TEXT NOT NULL CHECK (json_valid(options)),
  date_start INTEGER NOT NULL,
  date_end INTEGER,
  duration_ms REAL CHECK (duration_ms IS NULL OR duration_ms >= 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  errors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(errors))
);
CREATE TABLE folders (
  path TEXT PRIMARY KEY COLLATE NOCASE,
  parent TEXT COLLATE NOCASE REFERENCES folders(path),
  name TEXT NOT NULL,
  files TEXT CHECK(files IS NULL OR (json_valid(files) AND json_type(files)='array')),
  title TEXT, description TEXT, type TEXT NOT NULL DEFAULT 'folder',
  added_by TEXT, date_added INTEGER, date INTEGER,
  settings TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(settings)),
  meta TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(meta)),
  CHECK(parent IS NULL OR parent <> path COLLATE NOCASE)
);
CREATE TABLE run_folders (
  run_id TEXT NOT NULL REFERENCES runs(id),
  folder_path TEXT NOT NULL COLLATE NOCASE REFERENCES folders(path),
  PRIMARY KEY (run_id, folder_path)
);
CREATE INDEX runs_date_start ON runs(date_start);
CREATE INDEX folders_parent ON folders(parent);
CREATE INDEX run_folders_folder ON run_folders(folder_path);
PRAGMA user_version = 3;
