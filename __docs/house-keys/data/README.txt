DATA HOUSE KEYS
==============

DataKeys is the shared doorway for DB and JSON records. Reuse its names and
extend it locally for the actual record. All base fields are optional; the
receiver guards unknown input rather than treating a TypeScript type as
runtime validation.

THE KEYS

  id             string | number   Record identity; retain inherited IDs.
  name           string            Short name, usually one or two words.
  title          string            Short sentence for a roomier display.
  description    string            Full explanation; no fixed length here.
  added_by       string | number   Identifier of whoever added the record.
  count          number            Count whose subject the owner defines.
  date           number            General record date, defined by its owner.
  date_start     number            Start time.
  date_added     number            Time added.
  date_end       number            End time.

New IDs use Date.now() epoch milliseconds. New values in these date fields
also use epoch milliseconds. An ID collision exposes duplicate execution:
investigate the trigger or reload instead of adding a random suffix. A
project can require numeric IDs more strictly than this shared base type.

EventsKeys<Event extends DataKeys = DataKeys> contributes events?: Event[].
Each event keeps the common record vocabulary and adds its own fields.

EXAMPLE: AN OWNER ADDS ITS OWN FIELDS

  import type { DataKeys, EventsKeys } from './HouseKeys.types';

  interface CalendarEvent extends DataKeys {
    date_start: number;
    date_end: number;
    location?: string;
  }

  interface CalendarData extends EventsKeys<CalendarEvent> {}

The import path above assumes a file beside the keyring; use the real relative
path in the consuming project. CalendarEvent makes its required dates explicit
without renaming them. Its location stays local until reuse justifies a shared
key. Required TypeScript fields still need validation at an external boundary.

Do not use truthiness to decide whether a key was supplied. count: 0 and an
allowed empty description are values. Fill only absent keys from defaults,
then validate according to the owner's contract. See:
  ../../best-practices/data/README.txt

SOURCES
  ../../../HouseKeys.types.ts -- DataKeys and EventsKeys
  ../../../ganglion/coding/css/oocss/RULES.txt -- I1, H3-H4, H6-H7
