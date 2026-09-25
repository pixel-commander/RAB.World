// A disposable view of the current plan. Input declarations remain owned by
// their Tools; answers remain owned by session Steps, never a second form store.
export const canEditStepInput = (step, name) => !step?.projectAction
  && ['ready', 'input-required', 'configuration-required'].includes(step?.status)
  && !['pending-dependency', 'auto-resolver'].includes(step.options?.[name]?.status)
  && !String(step.options?.[name]?.source ?? '').startsWith('runner:');

export const prepareSessionInputs = (session, currentGroup, currentSteps, ready) => ({
  version: 'run-preparation/v1',
  session_id: session.id,
  revision: session.revision,
  group_id: currentGroup?.id ?? null,
  status: ['cancelled','superseded'].includes(currentGroup?.status) ? currentGroup.status
    : currentSteps.some(step => step?.status === 'running') ? 'running'
      : currentSteps.some(step => step?.status === 'execution-failed') ? 'failed'
        : currentSteps.some(step => step?.status === 'execution-interrupted') ? 'interrupted'
      : currentSteps.length && currentSteps.every(step => step?.status === 'completed') ? 'completed'
        : ready ? 'ready' : currentSteps.length ? 'input-required' : 'idle',
  ready_to_confirm: ready,
  steps: currentSteps.map(step => {
    const questions = [...(step.gaps?.requiredInputs ?? []), ...(step.gaps?.configuration ?? [])];
    const declarations = new Map((step.settings ?? []).map(field => [field.name, field]));
    // Configuration questions (e.g. paths.components) belong to the planner;
    // conditional questions may name optional, declared Tool fields.
    for (const gap of questions) {
      if (!gap?.field || declarations.has(gap.field)) continue;
      declarations.set(gap.field, {name:gap.field, title:gap.field, type:gap.optionType ?? 'text', description:gap.question, required:true,...(gap.enum?{enum:gap.enum}:{})});
    }
    return {
      id: step.id,
      title: step.capability?.title ?? step.capability?.name ?? step.frame?.text ?? 'Pending action',
      status: step.status,
      ...(step.projectAction ? {projectAction:step.projectAction} : {}),
      settings: [...declarations.values()].map(field => {
        const answer = step.options?.[field.name];
        const question = questions.find(gap => gap.field === field.name);
        return {
          name:field.name, type:field.type, title:field.title ?? field.name,
          description:question?.question ?? field.description ?? '',
          required:Boolean(field.required || (question && question.kind !== 'optional-input')),
          ...(Array.isArray(question?.enum??field.enum) ? {enum:question?.enum??field.enum} : {}),
          value:answer?.value ?? null,
          status:answer?.status ?? (question ? 'unknown' : 'unbound'),
          source:answer?.source ?? null,
          editable:currentGroup?.status === 'open' && !currentSteps.some(item => item.status === 'running') && canEditStepInput(step, field.name)
        };
      }),
      gaps:step.gaps ?? {},
      ...(step.executionError ? {error:step.executionError} : {}),
      // The receiver needs receipt locations/timing, never a second copy of
      // potentially large audit results already held by the existing owner.
      ...(step.receipt ? {receipt:{
        id:step.receipt.id, start_date:step.receipt.start_date,
        end_date:step.receipt.end_date, duration_ms:step.receipt.duration_ms,
        steps:(step.receipt.steps??[]).map(item=>({
          execution_id:item.execution_id,
          ...(item.result_file?{result_file:item.result_file}:{}),
          ...(item.tracking_file?{tracking_file:item.tracking_file}:{})
        }))
      }} : {})
    };
  })
});
