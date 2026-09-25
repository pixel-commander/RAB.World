/** Shared JSON property types. These declarations do not create files or set defaults. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** One configurable input in the settings array. */
export interface SettingProps {
  name: string;
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  default?: JsonValue;
  options?: JsonValue[];
}

/** Properties shared by saved settings.json records. */
export interface SettingsProps {
  id: number;
  name: string;
  title: string;
  description: string;
  settings: SettingProps[];
  meta: { [key: string]: JsonValue };
  indexed?: boolean;
  date_added?: string;
}

/** A folder address: relative to the selected root, or absolute without one. */
export interface PathProps {
  path: string;
}

/** Saved signal properties; type describes the item, not a form control. */
export interface SignalProps extends SettingsProps, PathProps {
  type: string;
  transmitting: boolean;
  meta: { kind: 'signal'; [key: string]: JsonValue };
}

/** Saved world settings. The scaffold currently initializes paths to []. */
export interface WorldProps extends SettingsProps {
  version: 'rab-node/v1';
  // World path entries have no defined schema yet; do not invent one here.
  paths: JsonValue[];
  meta: { kind: 'world'; source_root: string; [key: string]: JsonValue };
}
