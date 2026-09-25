import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { HandlerKey } from '../../HouseKeys.types.ts';

export function useClickOutside(
  rootRef?: RefObject<HTMLElement | null>,
  handleClickOutside?: HandlerKey<PointerEvent, 'outside'>,
) {
  const handlerRef = useRef(handleClickOutside);
  handlerRef.current = handleClickOutside;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef?.current;
      const target = event.target;
      if (!root || !(target instanceof Node) || root.contains(target)) return;
      handlerRef.current?.(event, 'outside');
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [rootRef]);
}
