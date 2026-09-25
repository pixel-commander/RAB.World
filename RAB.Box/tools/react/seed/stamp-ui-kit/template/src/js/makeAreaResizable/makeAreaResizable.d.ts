export type AreaRef = HTMLElement | { readonly current: HTMLElement | null } | null | undefined;
export declare function makeAreaResizable(ref?: AreaRef, type?: 'left' | 'right' | 'top' | 'bottom'): void;
export declare function handleRemove(ref: AreaRef): void;
export default makeAreaResizable;
