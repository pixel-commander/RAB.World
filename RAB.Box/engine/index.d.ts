export type Value = string | boolean | number;
export type Options = Record<string, Value>;
export type Field = {
  required: boolean;
  type: 'text' | 'boolean' | 'number';
  role?: string;
  title?: string;
  description?: string;
  question?: string;
  default?: Value;
  enum?: Value[];
  catalog?: string;
  validate?: 'project-name' | 'identifier' | 'css-class' | 'css-token' | 'relative-directory';
  language?: {
    prefixes?: string[];
    true?: string[];
    false?: string[];
    references?: Record<string, Value>;
  };
};
export type StampSettings = {
  id: string | number;
  name: string;
  title: string;
  description: string;
  date_added?: string | number;
  options: Record<string, Field> | (Field & { key: string })[];
};
export type CanonicalRequest = {
  mode: 'command' | 'query';
  capability: string;
  options: Options;
  dependency_options?: Record<string, Options>;
};
export type ReturnTo = { request_id: number; stamp: string; key: string };
export type Question = ReturnTo & {
  title: string;
  type: Field['type'];
  role: string | null;
  required: true;
  question: string;
  choices?: Value[];
  returnTo: ReturnTo | null;
};
export type Answer = { request_id: number; stamp: string; values: Options };
export type Ticket = {
  version: '0.2';
  id: number;
  project_id: string;
  original: string | CanonicalRequest;
  contract: string;
  answers: Answer[];
  questions: Question[];
};
export type Frame = {
  capability: string;
  title: string;
  settings: string;
  script: string;
  options: Options;
  seats: { key: string; required: boolean; satisfied: boolean }[];
  returnTo: ReturnTo | null;
  dependencies: { capability: string; catalog: string; value: string; returnTo: ReturnTo }[];
  worldEvidence: unknown[];
};
export type Result = {
  status: 'ready' | 'input-required' | 'query-result' | 'completed' | 'inspected' | 'conflict' | 'ambiguous' | 'denied' | 'invalid-input' | 'unsupported-language' | 'lookup-failed' | 'capability-unavailable' | 'stale-contract' | 'error';
  authority: 0 | 1;
  mode?: 'command' | 'query';
  capability?: string;
  ticket?: Ticket;
  frames?: Frame[];
  questions?: Question[];
  evidence?: Record<string, unknown[]>;
  trace?: unknown[];
  receipt?: Record<string, unknown>;
  capabilities?: StampSettings[];
  unavailable?: unknown[];
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  partial?: boolean;
  completed_steps?: unknown[];
};
export type MagicBox = {
  prepare: (input: string | CanonicalRequest) => Promise<Result>;
  resume: (ticket: Ticket) => Promise<Result>;
  answer: (ticket: Ticket, answer: Answer) => Promise<Result>;
  answerText: (ticket: Ticket, text: string, target?: { stamp: string; key: string }) => Promise<Result>;
  execute: (ticket: Ticket) => Promise<Result>;
  inspect: () => Promise<Result>;
};
export declare const createMagicBox: (config: {
  projectRoot: string;
  allowExecutableSettings?: boolean;
  allowWrites?: boolean;
  authorize?: (job: { project_id: string; capability: string; options: Options }) => boolean | Promise<boolean>;
  clock?: () => number;
}) => MagicBox;
export declare const normalizeOptions: (options: StampSettings['options']) => Record<string, Field>;
export declare const normalizeSettings: (settings: StampSettings, name: string) => StampSettings & { options: Record<string, Field> };
export declare const validateSeats: (settings: { options: Record<string, Field> }, values: Options) => { values: Options; missing: string[]; errors: unknown[]; requiredPass: boolean; seats: Frame['seats']; defaults: string[] };
export declare const every: <T>(P: (x: T) => boolean) => (Q: (x: T) => boolean) => (domain: T[]) => boolean;
