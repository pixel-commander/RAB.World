import { useEffect, useState } from 'react';
import { useURL } from '../../../hooks/useURL/useURL.ts';
import { fetchStore, saveStore } from '../../../store.ts';
import { handleSave as saveUserData, loadData } from '../../../../api/handleSave.ts';
import { validDate, normalizeDate, parseDateKey, dateKey } from '../../../components/Calendar/js/calendar.ts';
import type { CalendarEvent, CalendarSelectType } from '../../../components/Calendar/Calendar.types.ts';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

import { readEvents, readProposals } from '../js/records.ts';
import type { Proposal } from '../js/records.ts';

interface Stores {
  events: CalendarEvent[];
  proposals: Proposal[];
  readOnly: boolean;
}


export const useCalendarPage = () => {
  const [url, handleURL] = useURL();
  const section = typeof url.section === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(url.section) ? url.section + '-01' : url.section;
  const date = normalizeDate(parseDateKey(section));
  const [stores, setStores] = useState<Stores | null>(null);

  useEffect(() => {
    Promise.all([
      loadData<CalendarEvent>('events'),
      fetchStore<{ proposals?: unknown }>('proposals'),
    ])
      .then(([events, proposals]) =>
        setStores({ events: readEvents(events), proposals: readProposals(proposals?.proposals), readOnly: false }),
      )
      .catch(() => setStores({ events: [], proposals: [], readOnly: true }));
  }, []);


  const { events, proposals, readOnly } = stores ?? {events: [], proposals: [], readOnly: true};

  const saveEvent = async (event: CalendarEvent) => {
    const result = await saveUserData(event, 'events');
    return readEvents(result.items);
  };

  const handleSave: HandlerKey<CalendarEvent, string, Promise<void>> = async (data, type) => {
    const event = readEvents([data])[0];
    if (!event || type !== 'events') return;
    if (readOnly) throw new Error('Saving is unavailable. Events are read-only.');
    try {
      const nextEvents = await saveEvent(event);
      setStores(current => current ? { ...current, events: nextEvents } : current);
    } catch (error) {
      setStores(current => current ? { ...current, readOnly: true } : current);
      throw error;
    }
  };

  const handleSelectProposal = async (proposal?: Proposal, type?: string) => {
    if (!proposal || readOnly || !proposals.some(item => item.id === proposal.id)) return;
    const approve = type === 'approve';
    const nextProposals = proposals.filter((item) => item.id !== proposal.id);
    try {
      const nextEvents = approve ? await saveEvent({ ...proposal, source: 'gmail' }) : events;
      const next = { readOnly: false, proposals: nextProposals, events: nextEvents };
      setStores(next);
      await saveStore('proposals', { proposals: nextProposals });
    } catch {
      setStores(current => current ? { ...current, readOnly: true } : current);
    }
  };

  const handleSelect: HandlerKey<number, CalendarSelectType, void> = (data) => {
    if (validDate(data)) handleURL({section: dateKey(data)}, 'update-path');
  };

  return {events, proposals, readOnly, date, handleSave, handleSelectProposal, handleSelect};
};
