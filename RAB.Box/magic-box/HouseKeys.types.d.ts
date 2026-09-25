/** Narrow house handler vocabulary. Owners define their own data contracts.
 * Source: C:/stand-alone-react/src/HouseKeys.types.ts. No runtime dependency.
 */
export type HandlerKey<Data = unknown, Type extends string = string, Result = unknown> = (
  data?: Data,
  type?: Type,
) => Result;
export type HandleSubmit<Data = unknown> = HandlerKey<Data>;
export type HandleCancel<Data = unknown> = HandlerKey<Data>;
export type HandleClick<Data = unknown> = HandlerKey<Data>;
