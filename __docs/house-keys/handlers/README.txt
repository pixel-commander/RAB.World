HANDLER HOUSE KEYS
=================

Every project uses the agreed handle* names in house-keys.txt beside this
file. That list mirrors HandlerKeys in the root HouseKeys.types.ts. Reuse a
listed name when its meaning fits; do not create a synonym for the same job.

NAMING AND THE DOM BOUNDARY

Start with handle, then the event or action in PascalCase: handleClick,
handleChange, handleSubmit, handleDrag, handleKeyDown. The shared list also
includes actions such as handleSave, handleFilter and handleRemove; these
need not correspond to a native DOM event.

Components and hooks receive, return and forward handle* keys. React's on*
names belong only on the actual DOM element:

  Parent to component:   <Button handleClick={handleClick} />
  Component to DOM:      <button onClick={handleClick}>Choose</button>

Do not define a parent's handler as onClick, return { onClick } from a hook,
or pass <Button onClick={...}>. Keep the same distinction for submit, drag,
keyboard and other events. For a form, the DOM socket is onSubmit and the
house callback is handleSubmit.

THE CALLING SHAPE

  HandlerKey<Data = unknown, Type extends string = string, Result = unknown>
    = (data?: Data, type?: Type) => Result

data carries the thing. type is the final dispatch slot: under rule H5 it
identifies the child or part invoking a shared handler when that matters.

  handleClick(row, 'bar');
  handleClick(row, 'legend');

The receiver can route by type while data stays in the first slot. Omit type
when source identity adds nothing. It is the second argument, not an extra
handler prop. Both inputs are optional and must be guarded before use.

Import types with import type. An owner narrows HandlerKey to its payload,
source identifiers and return value; it does not pass HandlerKeys wholesale
as a universal props type. HandleClick<Data> and HandleSubmit<Data> are
available aliases. HandlerKeys permits broad payloads to describe vocabulary;
that does not remove the owner's responsibility to declare a narrow contract.

A direct onClick={handleClick} receives React's click event as data, not a
domain row, and React does not supply a house source identifier in slot two.
Use the event type for that DOM-facing handler. If an owner translates an
event into domain data, do that work in its mechanics/binding layer; do not
silently attach a row-only callback to a DOM event.

INHERIT, DEFAULT, PASS DOWN

A valid incoming function wins. Otherwise use the local default. Pack the
resolved handler last, then forward the bag with the canonical key and the
same function reference. Never wrap merely to forward, run both versions,
or overwrite an inherited function. See the worked example in:
  ../../best-practices/handlers/README.txt

CHECKING THE CONVENTION

Automatic checks are intended to flag on* house props, declarations and bag
keys while allowing native DOM sockets such as onClick={handleClick}. A
checker must distinguish custom components from DOM elements and flag inline
mechanics at the DOM boundary. This README specifies the expected checks;
it does not establish that every project already runs them.

SOURCES
  ../../../HouseKeys.types.ts -- HandlerKey, HandleClick, HandleSubmit, HandlerKeys
  ../../../ganglion/coding/css/oocss/RULES.txt -- A1, I1, R6-R7, H1-H5
