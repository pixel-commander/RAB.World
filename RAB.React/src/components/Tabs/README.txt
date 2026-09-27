Tabs
====
Inputs: tabs [{id,name,View}], selected (name), styler (defaults to main), stylers (optional per-slot class overrides).
TAB_STYLERS above Tabs owns the main preset. Explicit empty class strings remove preset skin for that slot.
By default the parent owns selected; handleClick(item, 'tab') receives the full tab record and the fixed tab dispatch type using the shared HandleClick<TabItem> house contract.
use_url defaults to false. When true, URLTabs calls useURL at the top, resolves handleClick = props?.handleClick || default URL handler and selected = props?.selected || URL selection, then merges both into props. A supplied handler replaces the URL handler; it is not chained. The default URL handler accepts (data, type), handles type 'tab', and writes data.name. This wrapper uses the requested truthy fallback convention, including for an empty selected string.
The current URL key is tab; multiple independent URL-owned Tabs on one page would share it. If selected is omitted the first item is shown; an explicit unmatched name shows no panel.
Tabs support arrow keys, Home, End, aria-selected, linked tab panels and native hidden. All panels stay mounted.
The demo enables use_url; useURL owns URL formatting and history.

Tabs dispatches use_url=true to URLTabs. URLTabs alone owns useURL, prepares selection and the click handler, and renders Tabs with use_url=false. The plain renderer has no URL subscription; switching modes does not change hook order.

side defaults to top. Per the requested Tabs layout, tabs.css owns nav/main grid areas: stacked for tabs--top and side by side for tabs--left. Direct children use data-area nav and main. Left navigation uses Up/Down; top uses Left/Right.

Supported side values: top (default), bottom, left, right. Each modifier owns grid-template-areas, rows and columns. Top/bottom use horizontal navigation and Left/Right keys; left/right use vertical navigation and Up/Down keys. DOM order remains unchanged.

The main area uses tab-container scroll-y: a grid with vertical overflow supplied by the shared grid.css utility imported by style.css.
