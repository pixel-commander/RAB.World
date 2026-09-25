STATELESS FORM FAMILY
=====================

Named, uncontrolled controls composed inside a real form. The DOM holds
field values; React state is not the form's data store.

FOLDER MAP
----------
StatelessForm.tsx          Form owner: fields, tabs, collection, validation.
StatelessForm.types.ts    Local form and generated-field contracts.
StatelessInputGroup.tsx   Generates a field from a settings bag.
Dropdown/                Native select control, local types and css/.
InputGroup/              Label, input/textarea or supplied children.
RadioGroup/              Single-selection wrapper around SelectList.
SelectList/              Single/multiple selection, optional search/add.
StatusForm/              Shell grid for form content and status messages.
css/                     Form and generated-field styles.
js/                      Value normalization, collection and validation.
demo/                    A local example; nested components have demos too.

Nested components own their types and css/[component-name].css. Imports
are relative. The root index exports StatelessForm, StatelessInputGroup,
and their types; import other components from their own folders.

HOUSE HANDLERS
--------------
The shared vocabulary lives in src/HouseKeys.types.ts. Each component
narrows the payloads it understands in its own types file.

  handleChange(data?, type?)
  handleSubmit(data?, type?)

Expect absent input, guard what arrives, preserve valid false/0/empty
strings, and leave room for additional keys. Optional TypeScript fields
are not runtime validation. External handlers are checked before calling.

Never rename a key when passing it to a child. Local function names can
be different:

  const handleInputChange = (data, type) => {
    // This owner can add work, then call its incoming handler.
    handleChange?.(data, type);
  };
  <Dropdown {...{ handleChange: handleInputChange }} />

The receiver still gets handleChange. The same interface works when the
control is used independently or composed inside a form.

The optional second slot is dispatch, not a field-props bag. Examples:
text, number, select, radio, check_list. Owners preserve the child's type
when forwarding a change. A caller may use it to select special behavior.

Payloads belong to the owner:
- InputGroup and Dropdown changes send a string value.
- RadioGroup sends one string; SelectList sends a string or string array.
- Generated fields send their string value on handleChange. Their select
  handleSelect currently sends a keyed object: { [name]: value }.
- StatelessForm wraps generated-field and child-component handleChange
  handlers. It preserves the child's existing handler, then sends its
  caller the collected form object with the child's dispatch type.
- handleSubmit receives the collected object after validation. The form's
  optional type prop supplies its submit dispatch value.

A custom composite must forward house handlers to its own controls for
that chain to continue; merely nesting arbitrary JSX cannot wire its internals.

VALUES AND COLLECTION
---------------------
Give each collected field a name. Unnamed and disabled controls are omitted
by FormData. Use unique names except for a native radio group.

value and default_value seed uncontrolled controls. default_value wins
when present, including false, 0 and ''. Changing props is not a reset;
remount with a different key when loading a different record.

The form collects Object.fromEntries(new FormData(form)). Values are
strings or Files, not automatically numbers or booleans. Repeated names
collapse to the last entry, so use the provided multi-selection shape:
SelectList with can_multi and generated check_list store one comma-separated
value under the field name. IDs containing commas are unsuitable for this
shape. Selected options remain collected when search hides them.

GENERATED FIELDS AND COMPOSED CHILDREN
------------------------------------
Pass form_fields for a flat list, form_tabs for named field lists, or
children for explicitly composed controls. These can be used together.

  <StatelessForm
    form_fields={[
      { name: 'name', label: 'Name', is_required: true },
      { name: 'count', label: 'Count', type: 'number', default_value: 0 }
    ]}
    handleChange={(data, type) => console.log(type, data)}
    handleSubmit={(data) => console.log('submit', data)}
  >
    <Dropdown name="role" label="Role" options={['Owner', 'Viewer']} />
  </StatelessForm>

Generated fields support native input types plus textarea, select,
check_list and radio_list. options supplies display/value strings; items
supplies { id, name } entries for separate stored IDs and display labels.
A spacer field inserts space instead of a control.

SelectList/RadioGroup accept string arrays or comma-separated options.
SelectList supports can_multi; both support has_search, can_add and modes
list, scroll, chip/chips. Their search/add interactions update the DOM.
Dropdown is a native select: the browser owns its popup/open state.

view_mode changes generated fields to display values and hides form actions.
It does not convert arbitrary children into read-only controls; the caller
must provide suitable child content for that mode.

VALIDATION
----------
Submit checks generated fields, including untouched fields in hidden tabs,
and native constraints on child controls. The first invalid tab is revealed;
error messages and classes clear when validation succeeds.

A generated field's validate(value?) returns a falsy result for success or
a message for failure. A thrown validator is treated as invalid. Required
checks treat absence and empty strings as missing; numeric zero is valid.
Field blur validates that field. It does not switch tabs to validate others.
Custom child components own custom validation beyond native constraints.

STATUS FORM
-----------
StatusForm imports React, its local types and its own CSS only. It provides
 data-grid="shell" with Header, main content and Footer regions.

Normal content stays mounted but hidden while a status is shown.
is_saving selects SavingMessage; is_saved selects SavedMessage; has_error
selects ErrorMessage or error. Error takes priority, then saving, then saved.
is_visible={false} removes the component. The shell exposes aria-busy and
a live status region. Provide the message content you want displayed.

StatusForm does not submit, persist data, or run a save lifecycle itself.
The caller owns that work and the status flags. No Card, Button or contact
application dependency is needed. Demos use local components, with no backend.

THEME AND COMPONENT OVERRIDES
-----------------------------
The site loads CSS once in src/main.tsx, beginning with global.css so the
layer order exists before component styles:

  src/themes/layout/layout.css   Shared spacing, sizing, type and motion.
  src/themes/layout/grid.css     Grid vocabulary, including shell.
  src/themes/dark/colors.css     Current site palette.
  src/css/containers.css         Site container classes.
  src/css/actions.css               Site action atoms.

There is no light palette yet. No old @css/theme.css or @atoms imports
are required by this family.

Component tokens use --[component-name]-[property], with part names where
needed. They remain unset until overridden, so CSS falls back to site
classes/theme tokens or an explicit component default. For example:

  .dropdown__select {
    background: var(--dropdown-background, var(--surface-inset));
  }

  :root {
    --dropdown-background: #203040;
    --stateless-form-padding: 1.5rem;
  }

A nearer ancestor can override the same tokens for one instance. See each
component's CSS for the exact supported names. No "toke" segment is used.
The generated-field prefix is --stateless-input-group-*; the separate
InputGroup component uses --input-group-*.
