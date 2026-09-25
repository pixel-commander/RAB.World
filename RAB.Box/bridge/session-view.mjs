import { prepareSessionInputs } from './run-preparation.mjs';

export const presentSession = (session, { memory, meta, turn = null, parse = null }) => {
  const currentGroup = session.groups.find(group => group.id === session.bag.currentGroupId) ?? null;
  const currentSteps = (currentGroup?.stepIds ?? []).map(id => session.steps.find(step => step.id === id)).filter(Boolean);
  const ready = currentSteps.length > 0 && currentSteps.every(step => ['ready','completed'].includes(step.status));
  return { version: 'rab-session/v1', session_id: session.id, name:session.name??null,title:session.title??session.name??null,description:session.description??'', revision:session.revision, bag: session.bag, groups: session.groups, steps: session.steps,
    turns: session.turns, current_group: currentGroup, current_steps: currentSteps, last_turn: turn ?? session.turns.at(-1) ?? null,
    parse, ready_to_confirm: ready && currentSteps.some(step => step.status === 'ready'), yolo: session.yolo === true,
    preparation: prepareSessionInputs(session,currentGroup,currentSteps,ready && currentSteps.some(step => step.status === 'ready')),
    rab: memory.paths(meta), authority: 0,
    note: 'Turns persist in .rab. Only fully resolved, explicitly authorized work can execute.' };
};
