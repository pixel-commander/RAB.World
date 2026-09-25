import { Calendar } from '../../components/Calendar/Calendar.tsx';
import { useCalendarPage } from './hooks/useCalendarPage.ts';
import './css/calendar-page.css';
import { dateLabel, eventStart, eventTimeLabel } from '../../components/Calendar/js/calendar.ts';
import { Panel } from '../../components/panel/Panel.tsx';

export const CalendarPage = () => {
  const {events, proposals, readOnly, date, handleSave, handleSelectProposal, handleSelect} = useCalendarPage();
  return (
    <section className="calendar-page" data-grid="side-left">
      <aside data-area="side">
        <div className="inner scroll">
          {readOnly && (
            <p className="calendar__note">
              Saving is unavailable. Events are read-only.
            </p>
          )}
          <div className="calendar__pending">
            <Panel title={`Pending imports (${proposals.length})`}>
              {proposals.length === 0 ? (
                <span className="proposal__source">
                  No pending imports.
                </span>
              ) : (
                proposals.map((proposal) => (
                  <div key={proposal.id} className="proposal container-inset">
                    <div className="proposal__main">
                      <span className="proposal__title">{proposal.title}</span>
                      <span className="proposal__meta">
                        {[dateLabel(eventStart(proposal)!), eventTimeLabel(proposal), proposal.location].filter(Boolean).join(' · ')}
                      </span>
                      <span className="proposal__source">
                        {`from ${proposal.sourceFrom || 'unknown'} · "${proposal.sourceSubject || ''}"`}
                      </span>
                    </div>
                    <div className="proposal__actions">
                      <button type="button" disabled={readOnly} className="action-main proposal__approve" onClick={() => handleSelectProposal(proposal, 'approve')}>
                        Approve
                      </button>
                      <button type="button" disabled={readOnly} className="action-muted proposal__reject" onClick={() => handleSelectProposal(proposal, 'reject')}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </div>
        </div>
      </aside>
      <div data-area="main"><Calendar date={date} events={events} handleSave={handleSave} handleSelect={handleSelect}/></div>
    </section>
  );
};
