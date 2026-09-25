const cancellable = new Set(['resolving', 'input-required', 'configuration-required', 'language-gap', 'capability-gap', 'ready']);

// Handle flow control before a reply can become an input value or a new request.
export const cancelFlowTurn = async (session, text, {allocateId}) => {
  const isCancellation = /^never\s*mind[.!?]*$/i.test(String(text).trim());
  if (!isCancellation) return null;
  const group = session.groups.find(item => item.id === session.bag.currentGroupId);
  const steps = session.steps.filter(step => step.groupId === group?.id && cancellable.has(step.status));
  const turn = {
    id: await allocateId(), at: new Date().toISOString(),
    text: String(text).trim(), mode: 'cancel', stepIds: steps.map(step => step.id),
    reply: steps.length ? 'Cancelled the current flow.' : 'There is no active flow to cancel.'
  };
  session.turns.push(turn);
  for (const step of steps) {
    step.status = 'cancelled';
    step.gaps = {};
    step.turnIds.push(turn.id);
  }
  if (steps?.length) {
    group.status = 'cancelled';
    const cancelledIds = new Set(turn.stepIds);
    for (const [name, resource] of Object.entries(session.bag.sessionResources ?? {})) {
      if (!resource?.verified && cancelledIds?.has(resource?.stepId)) delete session.bag.sessionResources[name];
    }
    const target = session.bag.currentTarget;
    if (!target?.verified && steps?.some(step => step?.plannedResult && step?.plannedResult?.name === target?.name && step?.plannedResult?.path === target?.path)) {
      session.bag.currentTarget = null;
      session.bag.addressStack = [];
    }
  }
  return turn;
};
