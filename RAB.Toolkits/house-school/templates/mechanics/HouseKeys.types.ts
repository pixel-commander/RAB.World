export interface Item { label?: string }
export interface Payload { id?: string; doThat?: number }
// HandlerKey: data first, type second; both optional.
export type HandlerKey = (data?: Payload, type?: string) => unknown;
export type Selection = string | undefined;
export type SelectionSetter = (selected?: string) => void;
export interface Bag {
  // handleClick: preserve this key through components; onClick only at the DOM.
  handleClick?: HandlerKey;
  // selected: undefined is a valid caller-owned unselected value.
  selected?: Selection;
  // setSelected: callable means caller-owned; otherwise use the local pair.
  setSelected?: SelectionSetter;
  // items: optional collection; individual items can also be absent.
  items?: (Item | undefined | null)[] | null;
  // title: preserve the shared name when forwarding.
  title?: string;
}
