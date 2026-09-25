# Addressable construction seats

## Purpose

Build-time markup may contain explicit machine addresses so later deterministic Tools can target the exact element without requiring the human to remember internal paths.

Humans speak semantically:

> add `SiteNav` to the header

The runtime may resolve that to an exact construction address:

```text
area-header:a1
```

The exact address is machine state, not a user-facing requirement.

## Marker format

The construction-only attribute is:

```html
data-rab-seat="<seat-id>"
```

Example:

```html
<div data-grid="header-main" data-gap="content">
  <section data-area="header" data-rab-seat="area-header:a1">
    <!-- [rab-seat:area-header:a1] -->
  </section>
  <section data-area="main" data-rab-seat="area-main:a1">
    <!-- [rab-seat:area-main:a1] -->
  </section>
</div>
```

`data-area` remains artifact semantics. `data-rab-seat` and `[rab-seat:...]` comments are RRAABBIITT construction scaffolding.

## Exact targeting

React DOM-edit Tools may accept `seat_id` and resolve it against `data-rab-seat`.

A Tool may also create a new addressable element using `new_seat_id`.

Example construction intent:

```text
add a div className=container-main new_seat_id=container-main:c1
add a div inside container-main:c1 className=container-seat new_seat_id=container-seat:c1
```

The human should not need to type these IDs in normal use. Semantic resolution/UI focus can map a human reference to the exact address. If more than one legal target remains, the system should ask rather than guess.

## Scaffolding Cleanup Pass

The cleanup Tool has one mutation responsibility:

> Remove RRAABBIITT construction markers.

It may remove:

- `data-rab-seat="..."`
- `<!-- [rab-seat:...] -->`
- `{/* [rab-seat:...] */}`

It must not:

- resolve a missing seat;
- invent a value;
- choose a component;
- move markup;
- add/change classes;
- repair application logic;
- alter `data-area` or other application attributes.

The read-only `list-construction-seats` Tool can inspect remaining markers without changing the artifact.

## Scope law

Artifact construction addresses and Runner seat scope solve related but different problems:

- Runner scoped seats prevent values such as `Parent::name` from accidentally binding `Child::name`.
- `data-rab-seat` prevents an artifact edit from accidentally targeting the wrong DOM node.

Neither mechanism grants semantic authority. They provide exact identity after the intended target/value has been legally resolved.
