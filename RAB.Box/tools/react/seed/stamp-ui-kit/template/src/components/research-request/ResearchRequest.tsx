import { useRef, useState, type FormEvent } from 'react';
import './research-request.css';

// the ask form. THE DOM IS THE FORM STATE (F4): the fields are uncontrolled,
// FormData is read once at submit, and status is the only thing React owns.
// The requirement rows are a list of ids only -- their text lives in the DOM.

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .slice(0, 48);

const kebab = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '');

interface Props {
  subjects?: string[];
  by?: string;
  onCreated?: (subject: string, topic: string) => void;
}

export const ResearchRequest = ({ subjects = [], by = 'me', onCreated }: Props) => {
  const form = useRef<HTMLFormElement>(null);
  const topicInput = useRef<HTMLInputElement>(null);
  const [reqIds, setReqIds] = useState<number[]>([]);
  const [status, setStatus] = useState<{ text: string; error: boolean }>({ text: '', error: false });
  const nextId = useRef(0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ask = String(data.get('ask') || '').trim();
    const subject = String(data.get('subject') || '').trim();
    const topic = String(data.get('topic') || '').trim() || slugify(ask);
    const want = parseInt(String(data.get('want') || ''), 10) || 1;

    if (!ask) return setStatus({ text: 'say the ask', error: true });
    if (!/^[a-z][a-z0-9-]*$/.test(subject)) return setStatus({ text: 'subject must be kebab-case', error: true });
    if (!/^[a-z][a-z0-9-]*$/.test(topic)) return setStatus({ text: 'topic must be kebab-case', error: true });

    const requirements = data.getAll('requirement').map((r) => String(r).trim()).filter(Boolean);

    try {
      const response = await fetch(`/api/research/${subject}/${topic}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ op: 'create', ask, want, requirements, by }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'create failed');
      setStatus({ text: `opened ${subject}/${topic}`, error: false });
      form.current?.reset();
      setReqIds([]);
      onCreated?.(subject, topic);
    } catch (error) {
      setStatus({ text: (error as Error).message, error: true });
    }
  };

  return (
    <form ref={form} className="research-request" onSubmit={submit}>
      <h3 className="research-request__title">Ask for research</h3>

      <label className="research-request__label" htmlFor="research-ask">what do you want to know</label>
      <input
        id="research-ask"
        name="ask"
        className="research-request__input"
        required
        onChange={(event) => {
          // the topic offers itself from the ask, once
          if (topicInput.current && !topicInput.current.value) {
            topicInput.current.value = slugify(event.target.value);
          }
        }}
      />

      <div className="research-request__pair">
        <span>
          <label className="research-request__label" htmlFor="research-subject">subject</label>
          <input
            id="research-subject"
            name="subject"
            className="research-request__input"
            list="research-subjects"
            required
            onInput={(event) => {
              const input = event.currentTarget;
              input.value = kebab(input.value);
            }}
          />
          <datalist id="research-subjects">
            {subjects.map((name) => <option key={name} value={name} />)}
          </datalist>
        </span>
        <span>
          <label className="research-request__label" htmlFor="research-topic">topic</label>
          <input
            id="research-topic"
            name="topic"
            ref={topicInput}
            className="research-request__input"
            onInput={(event) => {
              const input = event.currentTarget;
              input.value = kebab(input.value);
            }}
          />
        </span>
        <span>
          <label className="research-request__label" htmlFor="research-want">want</label>
          <input id="research-want" name="want" className="research-request__input" type="number" min="1" defaultValue="3" />
        </span>
      </div>

      <span className="research-request__label">requirements — testable, one per row</span>
      <div className="research-request__reqs">
        {reqIds.map((id) => (
          <div key={id} className="research-request__req">
            <input name="requirement" className="research-request__input" placeholder="must be …" />
            <button
              type="button"
              className="research-request__remove"
              onClick={() => setReqIds((ids) => ids.filter((x) => x !== id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="research-request__add action-muted"
        onClick={() => setReqIds((ids) => [...ids, (nextId.current += 1)])}
      >
        + requirement
      </button>

      <div className="research-request__foot">
        <span className={`research-request__status${status.error ? ' research-request__status--error' : ''}`}>
          {status.text}
        </span>
        <button type="submit" className="action-main">open the topic</button>
      </div>
    </form>
  );
};
