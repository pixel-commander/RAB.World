import { useState } from 'react';

export const __HOOK_NAME__ = () => {
  const [value, setValue] = useState(__INITIAL_VALUE__);

  // @rab-seat state-logic

  return { value, setValue };
};
