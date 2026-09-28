useURL
======

PURPOSE
  The URL is shared view state. The hook reads named path segments plus hash
  variables and writes them through one self-similar house handler.

HOUSE SHAPE
  const [{ page, section, url_vars }, handleURL] = useURL();

  handleURL({ section: '2026-10' }, 'update-path');
  handleURL({ page: 'messages' }, 'set-path');
  handleURL({ id: 'cats' }, 'update-var');

  DEFAULT_TEMPLATE = 'page/section'
  URL example: /calendar/2026-10#id=234

HANDLE CONTRACT
  handleURL(data?, type?)

  update-path  updates named path segments and keeps hash variables
  set-path     updates named path segments and clears hash variables
  update-var   merges hash variables
  update       commits data.paths and data.vars together
  remove-var   removes hash keys named by data

  These five verbs are a closed union. Missing or invalid input is guarded;
  an invalid verb reports itself, leaves the URL unchanged, and returns the
  current state.

PATH LAW
  Path segments are hierarchical. Writing a segment removes deeper segments.
  Setting the deepest named segment to undefined removes it too.

VARIABLE LAW
  Writes use #key=value. Reads accept ?, #, or $ for inherited links.
  url_vars is reserved and never names a path segment.

SYNC
  pushState does not emit an event, so every mounted hook instance subscribes
  to the local URL channel. popstate and hashchange cover browser navigation.

SCOPED VARS
  useScopedVars(scope?) returns { params, vars, get, set, patch, clear }.
  A scope prefixes stored keys while returning unprefixed local keys.

USAGE LAW
  Read the URL where it is consumed; do not pass it through component props.
  Links that call handleURL preventDefault. Static hosts serving deep paths
  must fall back to index.html.
