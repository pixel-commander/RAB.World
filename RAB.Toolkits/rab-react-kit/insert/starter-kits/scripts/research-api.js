// research-api — the ops door for data/research/<subject>/<topic>/topic.json.
// The server is the only pair of hands on the file: workers and the page send
// small ops (append + field-set), never whole-file writes, so parallel
// workers cannot clobber each other. Shapes: data/research/README.txt.

import fs from 'node:fs';
import path from 'node:path';

const SLUG = /^[a-z][a-z0-9-]*$/;
const VERDICTS = [null, 'shortlist', 'no', 'chosen'];
const STATUSES = ['open', 'working', 'answered', 'closed'];
const BODY_LIMIT = 1024 * 1024;

let ROOT_DIR = null;

const init = (dataDir) => {
  ROOT_DIR = path.join(dataDir, 'research');
};

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

const topicDir = (subject, topic) => path.join(ROOT_DIR, subject, topic);
const topicFile = (subject, topic) => path.join(topicDir(subject, topic), 'topic.json');
const readTopic = (subject, topic) => JSON.parse(fs.readFileSync(topicFile(subject, topic), 'utf8'));
const writeTopic = (subject, topic, value) =>
  fs.writeFileSync(topicFile(subject, topic), JSON.stringify(value, null, 2));

const listNames = (dir) => {
  try {
    return fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
  } catch {
    return [];
  }
};

const nextId = (list, prefix) => {
  const top = list.reduce((max, item) => {
    const n = parseInt(String(item.id || '').split('-').pop(), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}-${top + 1}`;
};

/* one-line summary per topic, for the shelf rail */
const summarize = (subject, topic) => {
  const t = readTopic(subject, topic);
  return {
    subject,
    topic,
    ask: t.ask,
    status: t.status,
    want: t.want,
    alive: t.results.filter((r) => r.verdict !== 'no').length,
    results: t.results.length,
    last_researched: t.last_researched,
    working: t.workers.filter((w) => !w.done).map((w) => w.who),
  };
};

const listAll = () => {
  const topics = [];
  for (const subject of listNames(ROOT_DIR)) {
    for (const topic of listNames(path.join(ROOT_DIR, subject))) {
      if (fs.existsSync(topicFile(subject, topic))) {
        topics.push(summarize(subject, topic));
      }
    }
  }
  return topics;
};

const assignedShape = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value.kind !== 'string' || typeof value.id !== 'string') {
    throw new Error('assigned_to needs { kind, id } or null');
  }
  return { kind: value.kind, id: value.id };
};

const create = (subject, topic, body) => {
  if (fs.existsSync(topicFile(subject, topic))) {
    throw new Error('topic already exists');
  }
  if (typeof body.ask !== 'string' || !body.ask.trim()) {
    throw new Error('ask required');
  }
  fs.mkdirSync(path.join(topicDir(subject, topic), 'files'), { recursive: true });
  fs.mkdirSync(path.join(topicDir(subject, topic), 'downloads'), { recursive: true });
  const requirements = (body.requirements || [])
    .map((text) => String(text).trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `req-${i + 1}`, text, must: true, by: body.by || 'me', added: today() }));
  const value = {
    subject,
    topic,
    ask: body.ask.trim(),
    want: Math.max(1, parseInt(body.want, 10) || 1),
    status: 'open',
    created: today(),
    last_researched: null,
    assigned_to: null,
    requirements,
    fields: Array.isArray(body.fields) ? body.fields.map(String) : [],
    results: [],
    notes: [],
    links: [],
    downloads: [],
    workers: [],
  };
  writeTopic(subject, topic, value);
  return value;
};

/* every op: read, mutate, write — the server is the merge point */
const apply = (t, body) => {
  const by = body.by || 'unknown';
  const row = (id) => {
    const found = t.results.find((r) => r.id === id);
    if (!found) throw new Error(`no result ${id}`);
    return found;
  };

  switch (body.op) {
    case 'claim': {
      if (!body.who) throw new Error('who required');
      t.workers.push({ who: body.who, lane: body.lane || '', since: now(), done: null });
      if (t.status === 'open') t.status = 'working';
      break;
    }
    case 'done': {
      const claim = t.workers.find((w) => w.who === body.who && !w.done);
      if (claim) claim.done = now();
      t.last_researched = today();
      if (t.results.length && t.workers.every((w) => w.done)) t.status = 'answered';
      break;
    }
    case 'add-results': {
      if (!Array.isArray(body.results) || !body.results.length) throw new Error('results required');
      body.results.forEach((r) => {
        t.results.push({
          id: nextId(t.results, 'res'),
          by,
          found: today(),
          verdict: null,
          meets: r.meets || {},
          values: r.values || {},
          refs: r.refs || [],
          notes: [],
          files: r.files || [],
          downloads: [],
          assigned_to: null,
        });
      });
      t.last_researched = today();
      break;
    }
    case 'add-requirement': {
      if (!body.text || !String(body.text).trim()) throw new Error('text required');
      t.requirements.push({
        id: nextId(t.requirements, 'req'),
        text: String(body.text).trim(),
        must: body.must !== false,
        by,
        added: today(),
      });
      break;
    }
    case 'set-fields': {
      if (!Array.isArray(body.fields)) throw new Error('fields must be an array');
      t.fields = body.fields.map(String);
      break;
    }
    case 'set-meets': {
      if (!t.requirements.some((r) => r.id === body.requirement)) throw new Error(`no requirement ${body.requirement}`);
      if (![true, false, null].includes(body.value)) throw new Error('value must be true/false/null');
      row(body.result).meets[body.requirement] = body.value;
      break;
    }
    case 'set-verdict': {
      if (!VERDICTS.includes(body.verdict)) throw new Error('verdict must be shortlist/no/chosen/null');
      row(body.result).verdict = body.verdict;
      break;
    }
    case 'set-status': {
      if (!STATUSES.includes(body.status)) throw new Error('status must be open/working/answered/closed');
      t.status = body.status;
      break;
    }
    case 'request-more': {
      t.want += Math.max(1, parseInt(body.count, 10) || 5);
      t.status = 'open';
      break;
    }
    case 'add-note': {
      if (!body.text || !String(body.text).trim()) throw new Error('text required');
      const target = body.result ? row(body.result).notes : t.notes;
      target.push({ id: nextId(target, 'note'), by, on: today(), text: String(body.text).trim() });
      break;
    }
    case 'add-link': {
      if (!body.url) throw new Error('url required');
      t.links.push({ id: nextId(t.links, 'link'), by, on: today(), url: String(body.url), title: String(body.title || body.url) });
      break;
    }
    case 'add-download': {
      if (!body.url) throw new Error('url required');
      const target = body.result ? row(body.result).downloads : t.downloads;
      target.push({
        id: nextId(target, 'dl'),
        by,
        on: today(),
        title: String(body.title || body.url),
        url: String(body.url),
        version: body.version ? String(body.version) : null,
        size: body.size ? String(body.size) : null,
        saved: null,
      });
      break;
    }
    case 'set-assigned': {
      const value = assignedShape(body.assigned_to);
      if (body.result) row(body.result).assigned_to = value;
      else t.assigned_to = value;
      break;
    }
    default:
      throw new Error(`unknown op ${body.op}`);
  }
  return t;
};

const readBody = (req, callback) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > BODY_LIMIT) req.destroy();
  });
  req.on('end', () => callback(body));
};

const sendJSON = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
};

/* the door: GET /api/research | GET/POST /api/research/<subject>/<topic> */
const handle = (req, res, urlPath) => {
  try {
    const parts = urlPath.split('/').filter(Boolean); // ['api','research',subject?,topic?]

    if (parts.length === 2) {
      if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method not allowed' });
      return sendJSON(res, 200, { topics: listAll() });
    }

    if (parts.length !== 4) return sendJSON(res, 404, { error: 'use /api/research/<subject>/<topic>' });
    const [, , subject, topic] = parts;
    if (!SLUG.test(subject) || !SLUG.test(topic)) {
      return sendJSON(res, 400, { error: 'subject and topic must be kebab-case' });
    }

    if (req.method === 'GET') {
      if (!fs.existsSync(topicFile(subject, topic))) return sendJSON(res, 404, { error: 'no such topic' });
      const t = readTopic(subject, topic);
      t.files_on_disk = listNames(path.join(topicDir(subject, topic), 'files'));
      t.downloads_on_disk = listNames(path.join(topicDir(subject, topic), 'downloads'));
      return sendJSON(res, 200, t);
    }

    if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method not allowed' });

    readBody(req, (raw) => {
      try {
        const body = JSON.parse(raw);
        if (body.op === 'create') {
          return sendJSON(res, 200, create(subject, topic, body));
        }
        if (!fs.existsSync(topicFile(subject, topic))) return sendJSON(res, 404, { error: 'no such topic' });
        const t = apply(readTopic(subject, topic), body);
        writeTopic(subject, topic, t);
        return sendJSON(res, 200, t);
      } catch (error) {
        return sendJSON(res, 400, { error: error.message });
      }
    });
  } catch (error) {
    sendJSON(res, 500, { error: error.message });
  }
};

export { init, handle };
