HANDLERS: INHERIT, DEFAULT, PASS DOWN
===================================

One handler contract repeats at each boundary. A valid incoming handler is
authoritative; a local default supplies behavior only when none was valid.
The vocabulary and complete key list live in:
  ../../house-keys/handlers/README.txt
  ../../house-keys/handlers/house-keys.txt

RESOLVE THE BAG IN ITS OWNER

After guarding the incoming bag, a binding hook or mechanics owner resolves
each handler. This excerpt assumes props has the owner's narrowed prop type
and handleClickDefault has the same local payload/return contract:

  const handleClick = typeof props?.handleClick === 'function'
    ? props.handleClick
    : handleClickDefault;

  return { ...props, handleClick };

The resolved key is last. A supplied function passes through unchanged; the
child gets the same reference. Do not wrap it simply to forward arguments,
call the inherited and default implementations together, or spread the old
props after the resolved key.

MATCH THE PAYLOAD TO THE BOUNDARY

All house handlers use (data?, type?). The owner narrows data; type is an
optional source identifier for dispatch. A direct DOM click handler can use:

  import type { MouseEvent } from 'react';
  import type { HandlerKey } from './HouseKeys.types';

  type ButtonClick = HandlerKey<MouseEvent<HTMLButtonElement>, string, void>;

Use the consuming file's actual path to the keyring. The handler must guard
absent data before accessing currentTarget. A row callback instead narrows
data to its row type; an owning adapter must translate a DOM event to that
row before invoking it. Forwarding and payload conversion are different jobs.

KEEP RENDERING SIMPLE

  Parent:  <Button handleClick={handleClick} />
  Leaf:    <button onClick={handleClick}>Choose</button>

Use on* only at the native DOM socket. No const onClick, onClick house prop,
or { onClick } returned bag. Do not put inline mechanics in the DOM binding.
For a form, bind onSubmit to handleSubmit; collect with FormData in the owning
mechanics instead of building a lone click action for a form submission.

Mechanics live in local js modules; the hook binds them and returns the ready
bag. A component with more than one state puts that system in hooks/use<Name>.ts.
The TSX file renders the bag; it does not receive raw state setters.

TWO CHILD BAGS, SAME CHILD CONTRACT

A parent may distinguish its local wires as handleBag1Click and
handleBag2Click. Pass each child the canonical handleClick key:

  <Button handleClick={handleBag1Click} />
  <Button handleClick={handleBag2Click} />

If children share one handler and the owner needs their identities, the
invoking mechanics supplies the second argument:

  handleClick(row, 'bar');
  handleClick(row, 'legend');

Omit the identifier when it is unnecessary. Do not rename the child's prop
to handleLegendClick or add a second prop just to carry that argument.

WHAT CHECKERS SHOULD VERIFY

- on* appears as a native DOM event socket, not as a house declaration,
  custom-component prop, destructured handler alias or returned bag key.
- DOM event sockets receive named ready handlers instead of inline mechanics.
- A valid inherited function survives by reference and name at each boundary.
- Missing/invalid handlers select only the default; resolved keys are packed last.
- Both optional argument slots are guarded and payloads fit the receiving owner.

Use syntax-aware checks for DOM versus custom-component wiring. A simple
search for onClick cannot make that distinction, and reference identity needs
behavioral verification. These are checking requirements, not a claim that
an enforcement script has already been installed in every project.

SOURCE
  ../../../ganglion/coding/css/oocss/RULES.txt -- A1, I1, P1-P2, R1, R6-R8, H5, F1-F4
