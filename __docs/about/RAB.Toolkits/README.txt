RAB.Toolkits
============

PURPOSE
RAB.Toolkits contains the tools that plug into RAB.Box. This is the user's
definition of its role in RAB.World.

HOW IT FITS
Box supplies the input and execution workflow. A toolkit supplies tools
for its area of work. Keeping tool behavior with its owner allows Box to
use the shared execution contract while toolkits supply specialized work.

WHAT THE EXISTING TOOLKIT DOCUMENTS
The inspected React toolkit defines a toolkit root with identity and
settings, and a tools directory with semantic paths. Implemented public
tools declare inputs in settings.json and describe output in contract.json.
An executor may belong to the leaf or be inherited from a parent owner.
Template-producing tools own their template directory.

The React contract preserves the house terms container-atom, action-atom,
effect-atom and grid-atom. Components own structure; atoms own skin. The
shared grid owner supplies canonical layout structure and area names.
These are the inspected React rules, not an invented universal file layout
for every future toolkit.

The contract also preserves supplied false, zero and empty-string values,
fills absent keys from the owner's defaults, and keeps shared mechanics at
one owner. Public child tools execute through Box's provided helpers.

Empty placeholders do not establish executable behavior. Toolkits must be
connected through Box's toolkit link mechanism and discovered by Box.
The inspected react-flow folder is operator guidance, not a callable tool
or toolkit root. Its older F: path examples must not be assumed to be local
paths on this laptop.

CURRENT CONNECTION
The inspected Box TOOLKITS.json points to:
  \\DESKTOP-T72ISDI\f\RAB.Toolkits\react

This is different from the local RAB.World toolkit location. No configuration
was changed and no runtime connection was verified while writing this README.

BASIS AND LIMITS
Based on the user's definitions in this task and these inspected files:
  ..\..\..\RAB.Toolkits\react\README.txt
  ..\..\..\RAB.Toolkits\react\RULES.txt
  ..\..\..\RAB.Toolkits\react-flow\README.txt
  ..\..\..\RAB.Toolkits\react-flow\RULES.txt
  ..\..\..\RAB.Box\TOOLKITS.json

Use the relevant toolkit's current contract when building or reviewing it.
Keep live inventories with Box discovery rather than copying them here.
