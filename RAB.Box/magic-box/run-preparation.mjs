/**
 * Temporary input receiver. The session owns requirements and readiness;
 * this component owns only unsaved drafts and renders declared fields.
 * @typedef {import('./HouseKeys.types').HandleSubmit<Record<string, unknown>>} HandleSubmit
 * @typedef {import('./HouseKeys.types').HandleCancel<Record<string, unknown>>} HandleCancel
 * @typedef {import('./HouseKeys.types').HandleClick<Record<string, unknown>>} HandleClick
 */

export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const terminal = new Set(['completed', 'cancelled', 'failed', 'interrupted', 'superseded', 'abandoned', 'execution-failed', 'execution-interrupted']);
const keyOf = data => `${data?.session_id}:${data?.revision}:${data?.group_id}`;
const display = value => value === undefined || value === null ? 'Not supplied' : typeof value === 'string' ? value === '' ? '""' : value : JSON.stringify(value);
const human = value => String(value ?? 'unresolved').replaceAll('_', ' ').replaceAll('-', ' ');
const fieldsOf = step => Array.isArray(step?.settings) ? step.settings : [];
const inputValue = field => {
  if (field?.value === undefined || field?.value === null) return '';
  if (Array.isArray(field?.enum)) {
    const index = field.enum.findIndex(value => Object.is(value, field.value));
    return index < 0 ? '' : String(index);
  }
  return ['json', 'settings'].includes(field?.type) ? JSON.stringify(field.value, null, 2) : String(field.value);
};

/** Decode an edited control without treating false, zero, or empty text as absent. */
export const decodeFieldValue = (field, raw) => {
  if (typeof raw !== 'string') throw new Error('The field value must come from an input control.');
  if (Array.isArray(field?.enum)) {
    if (!/^\d+$/.test(raw) || !Object.hasOwn(field?.enum, Number(raw))) throw new Error('Choose a listed value.');
    return field.enum[Number(raw)];
  }
  if (field?.type === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error('Choose Yes or No.');
  }
  if (field?.type === 'number') {
    if (!raw.trim() || !Number.isFinite(Number(raw))) throw new Error('Enter a finite number.');
    return Number(raw);
  }
  if (['json', 'settings'].includes(field?.type)) {
    try { return JSON.parse(raw); } catch { throw new Error('Enter valid JSON.'); }
  }
  if (field?.required === true && raw.trim() === '') throw new Error('This required field needs a value.');
  return raw;
};

/** @param {Element} root
 * @param {{handleSubmit?: HandleSubmit, handleCancel?: HandleCancel, handleClick?: HandleClick}} handlers
 */
export const createRunPreparation = (root, handlers = {}) => {
  if (!root?.ownerDocument) throw new Error('Run preparation needs a DOM container.');
  root.setAttribute('role', 'region');
  const document = root.ownerDocument;
  const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  let preparation = null, snapshotKey = null, externalBusy = false, pending = false;
  let form = null, errorBox = null, saveButton = null, runButton = null, cancelButton = null;
  let controls = [], drafts = new Map();

  const snapshot = () => preparation ? { session_id: preparation.session_id, revision: preparation.revision, group_id: preparation.group_id } : null;
  const active = () => preparation?.group_id !== null && preparation?.group_id !== undefined && !terminal.has(preparation?.status);
  const running = () => preparation?.status === 'running' || preparation?.status === 'executing' || preparation?.steps?.some(step => ['running', 'executing'].includes(step?.status));
  const sync = () => {
    const busy = externalBusy || pending;
    root.setAttribute('aria-busy', String(busy));
    for (const { control, editable } of controls) control.disabled = busy || !editable || running();
    if (saveButton) saveButton.disabled = busy || drafts.size === 0;
    if (runButton) runButton.disabled = busy || drafts.size > 0 || preparation?.ready_to_confirm !== true || !active() || running();
    if (cancelButton) cancelButton.disabled = busy || !active() || running();
  };
  const reportError = error => {
    if (!errorBox) return;
    errorBox.textContent = error?.message ?? String(error);
    errorBox.hidden = false;
    errorBox.focus();
  };
  const invoke = async (handler, data, type, expectedKey) => {
    if (expectedKey !== snapshotKey || externalBusy || pending) return;
    if (typeof handler !== 'function') { reportError(new Error('This action is unavailable.')); return; }
    pending = true; sync();
    try { await handler(data, type); }
    catch (error) { if (expectedKey === snapshotKey) reportError(error); }
    finally { pending = false; sync(); }
  };
  const collectAnswers = () => {
    const byStep = new Map();
    for (const { field, stepId, draftKey, control } of controls) {
      if (!drafts.has(draftKey)) continue;
      let value;
      try { value = decodeFieldValue(field, drafts.get(draftKey)); control.removeAttribute('aria-invalid'); }
      catch (error) { control.setAttribute('aria-invalid', 'true'); throw new Error(`${field.title ?? field.name}: ${error.message}`); }
      if (!byStep.has(stepId)) byStep.set(stepId, Object.create(null));
      byStep.get(stepId)[field.name] = value;
    }
    return [...byStep].map(([step_id, values]) => ({ step_id, values }));
  };
  const makeControl = (field, stepId, index, renderKey) => {
    const draftKey = JSON.stringify([stepId, field.name]);
    const wrapper = node('div', undefined, 'field');
    const id = `run-preparation-field-${index}`, helpId = `${id}-help`;
    const editable = field.editable === true;
    const label = node('label', `${field.title ?? field.name} · ${field.required ? 'Required' : 'Optional'}`);
    label.htmlFor = id;
    let control;
    if (Array.isArray(field?.enum) || field?.type === 'boolean') {
      control = node('select');
      const placeholder = node('option', 'Choose a value…'); placeholder.value = ''; control.append(placeholder);
      const choices = Array.isArray(field?.enum) ? field.enum.map((value, optionIndex) => [String(optionIndex), display(value)]) : [['true', 'Yes'], ['false', 'No']];
      for (const [value, title] of choices) { const option = node('option', title); option.value = value; control.append(option); }
    } else {
      const multiline = ['textarea', 'json', 'settings'].includes(field?.type);
      control = node(multiline ? 'textarea' : 'input');
      if (multiline) { control.rows = field.type === 'textarea' ? 8 : 4; control.spellcheck = false; control.setAttribute('autocapitalize', 'off'); }
      else { control.type = field?.type === 'number' ? 'number' : 'text'; if (field?.type === 'number') control.step = 'any'; }
    }
    control.id = id; control.name = field.name;
    control.setAttribute('aria-describedby', helpId);
    control.setAttribute('aria-required', String(field.required === true));
    control.required = field.required === true;
    control.value = drafts.get(draftKey) ?? inputValue(field);
    const changed = () => {
      if (renderKey !== snapshotKey || externalBusy || pending || !editable || running()) return;
      drafts.set(draftKey, control.value);
      control.removeAttribute('aria-invalid');
      if (errorBox) errorBox.hidden = true;
      sync();
    };
    control.addEventListener('input', changed); control.addEventListener('change', changed);
    const waiting = field.status === 'pending-dependency' ? 'Waiting for the preceding step’s result.'
      : field.status === 'auto-resolver' ? 'A declared helper will supply this value during execution.' : '';
    const help = node('small', [field.description, waiting].filter(Boolean).join(' ')); help.id = helpId;
    wrapper.append(label, control, help); controls.push({ field, stepId, draftKey, control, editable });
    return wrapper;
  };
  const render = () => {
    root.replaceChildren(); controls = []; form = null; errorBox = null; saveButton = null; runButton = null; cancelButton = null;
    root.hidden = !preparation || !preparation?.steps?.length || terminal.has(preparation.status);
    if (root?.hidden) return;
    const renderKey = snapshotKey;
    const heading = node('div', undefined, 'row');
    const status = node('span', human(preparation.status), 'pill'); status.setAttribute('role', 'status');
    heading.append(node('h2', active() ? 'Prepare action' : 'Action summary'), status);
    root.append(heading);
    const editable = preparation.steps.flatMap(step => step?.projectAction ? [] : fieldsOf(step).filter(field => field?.editable === true));
    root.append(node('p', active() ? editable.length ? 'Review or edit the fields below. Required fields are labeled. Save any changes before running.' : preparation.ready_to_confirm ? 'Review the fields below, then confirm Run.' : 'The action is waiting for the requirements below.' : `This action is ${human(preparation.status)}.`, 'subtle'));
    form = node('form', undefined, 'stack'); form.noValidate = true;
    errorBox = node('div', undefined, 'callout'); errorBox.dataset.tone = 'bad'; errorBox.setAttribute('role', 'alert'); errorBox.tabIndex = -1; errorBox.hidden = true; form.append(errorBox);
    let fieldIndex = 0;
    for (const step of preparation.steps) {
      if (!isRecord(step)) continue;
      const section = node('section', undefined, 'frame');
      section.append(node('h3', step.title ?? 'Action'), node('small', human(step.status)));
      if (active() && step?.projectAction) section.append(node('p', 'Continue this project setup in Chat. Its questions and confirmation stay in that flow.', 'subtle'));
      if (isRecord(step?.error)) {
        const error = node('p', `${step.error.code ?? 'Execution error'}: ${step.error.message ?? 'The tool did not complete.'}`, 'callout');
        error.dataset.tone = 'bad'; section.append(error);
      }
      if (isRecord(step?.receipt)) {
        const receipt = node('div', undefined, 'field');
        receipt.append(node('strong', `Receipt ${step.receipt.id ?? ''}`));
        if (typeof step?.receipt?.duration_ms === 'number') receipt.append(node('small', `Duration: ${step.receipt.duration_ms} ms`));
        for (const output of Array.isArray(step?.receipt?.steps) ? step.receipt.steps : []) {
          if (typeof output?.result_file === 'string') receipt.append(node('small', 'Saved report'), node('code', output.result_file));
        }
        section.append(receipt);
      }
      for (const field of fieldsOf(step)) {
        if (!isRecord(field) || typeof field?.name !== 'string') continue;
        if (active() && !step?.projectAction) section.append(makeControl(field, step.id, fieldIndex++, renderKey));
        else {
          const row = node('div', undefined, 'field');
          row.append(node('strong', `${field.title ?? field.name} · ${field.required ? 'Required' : 'Optional'}`), node('code', display(field.value)), node('small', `${human(field.status)} · ${field.source ?? 'No source yet'}`));
          if (field?.status === 'auto-resolver') row.append(node('small', active() ? 'A declared helper will supply this value during execution.' : 'A declared helper was expected to supply this value.'));
          if (field?.status === 'pending-dependency') row.append(node('small', active() ? 'Waiting for the preceding step’s result.' : 'This input depended on the preceding step’s result.'));
          section.append(row);
        }
      }
      for (const [kind, gaps] of Object.entries(isRecord(step.gaps) ? step.gaps : {})) {
        for (const gap of Array.isArray(gaps) ? gaps : []) {
          if (!isRecord(gap)) continue;
          if (active() && !step?.projectAction && ['requiredInputs', 'configuration'].includes(kind) && fieldsOf(step).some(field => field?.editable === true && field?.name === gap?.field)) continue;
          const gapText = gap.question ?? gap.message ?? gap.field ?? gap.token;
          if (gapText) section.append(node('p', `${human(kind)}: ${gapText}`, 'subtle'));
        }
      }
      form.append(section);
    }
    if (active()) {
      const actions = node('div', undefined, 'actions');
      if (controls.some(item => item.editable)) { saveButton = node('button', 'Save answers', 'primary'); saveButton.type = 'submit'; actions.append(saveButton); }
      cancelButton = node('button', 'Cancel'); cancelButton.type = 'button';
      cancelButton.addEventListener('click', () => {
        if (!active() || running()) return;
        return invoke(handlers.handleCancel, undefined, 'session-inputs', renderKey);
      }); actions.append(cancelButton);
      if (!preparation?.steps?.some(step => step?.projectAction)) {
        runButton = node('button', 'Confirm & run', 'primary'); runButton.type = 'button';
        runButton.addEventListener('click', () => {
          if (drafts?.size || preparation?.ready_to_confirm !== true || !active() || running()) return;
          return invoke(handlers.handleClick, { confirm: true }, 'session-execute', renderKey);
        }); actions.append(runButton);
      }
      form.append(actions);
      if (controls.some(item => item.editable)) form.append(node('small', 'Only edited fields are saved. Unanswered fields remain pending; nothing runs when answers are saved.', 'subtle'));
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (renderKey !== snapshotKey || externalBusy || pending || !active()) return;
      try { const answers = collectAnswers(); if (answers?.length) return invoke(handlers.handleSubmit, { answers }, 'session-inputs', renderKey); }
      catch (error) { reportError(error); }
    });
    root.append(form); sync();
  };
  return {
    update(data, { busy = false } = {}) {
      const valid = isRecord(data) && data?.version === 'run-preparation/v1' && Array.isArray(data?.steps);
      const nextKey = valid ? keyOf(data) : null;
      if (nextKey !== snapshotKey) drafts = new Map();
      preparation = valid ? data : null; snapshotKey = nextKey; externalBusy = busy; render();
    },
    setBusy(value) { externalBusy = value === true; sync(); },
    snapshot,
  };
};
