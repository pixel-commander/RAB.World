export const filterRows = (root?: HTMLElement | null) => {
  if (!root) return;
  const query = root.querySelector<HTMLInputElement>('[data-id="search"]')?.value.trim().toLowerCase() ?? '';
  let count = 0;
  root.querySelectorAll<HTMLElement>('[data-id="atom-row"]').forEach((row) => {
    row.hidden = !(row.textContent ?? '').toLowerCase().includes(query);
    if (!row.hidden) count += 1;
  });
  const empty = root.querySelector<HTMLElement>('[data-id="empty"]');
  if (empty) empty.hidden = count !== 0;
};
