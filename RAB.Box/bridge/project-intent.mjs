const senses = token => (token.candidates ?? []).flatMap(candidate => candidate.senses ?? []);
const types = token => (token.candidates ?? []).flatMap(candidate => candidate.types ?? []);
const lemmas = token => (token.candidates ?? []).map(candidate => candidate.lemma);
const content = frame => frame.tokens.filter(token => token.kind !== 'punct' && !types(token).includes('polite'));

export const resolveProjectIntent = bag => {
  const candidates = (bag.parse?.frames ?? []).filter(frame => frame.seats.target_type === 'project' && !frame.tokens.some(token => token.key === 'react') && !['inspect','count','update','delete','rename','copy','move','execute','attach'].includes(frame.seats.operation));
  const results = candidates.map(frame => {
    const tokens = content(frame), first = tokens[0];
    const verbs = tokens.filter(token => types(token).includes('verb'));
    const informationQuestion = first && types(first).includes('question') && !types(first).includes('auxiliary');
    const conditional = tokens.some(token => lemmas(token).some(lemma => ['if','when','unless'].includes(lemma)));
    const subject = tokens.find(token => types(token).includes('pronoun'));
    const requested = verbs.some(token => senses(token).some(sense => ['request','require'].includes(sense)));
    const operative = verbs.find(token => senses(token).some(sense => ['create','select','continue','find','list','display'].includes(sense)));
    const statement = subject && operative && subject.index < operative.index && !requested && !tokens.some(token => types(token).includes('auxiliary'));
    if (frame.negated) return { action: 'declined', frame, reason: 'negated project request' };
    if (informationQuestion || conditional || statement) return { action: 'clarify', frame, reason: 'project mentioned without an unambiguous present request' };
    let action = null;
    if (frame.seats.operation === 'create') action = 'create';
    else if (['select','continue'].includes(frame.seats.operation)) action = 'load';
    else if (['find','display'].includes(frame.seats.operation)) action = frame.seats.name ? 'load' : 'list';
    else if (!verbs.length && tokens.some(token => senses(token).includes('new'))) action = 'create';
    if (!action) return { action: 'clarify', frame, reason: 'project operation is missing' };
    if (!frame.completeLanguage) return { action: 'clarify', frame, reason: 'unresolved language or conflicting values' };
    return { action, frame, reason: 'project target plus parsed operation or new-noun construction' };
  });
  const result = results[0];
  const intent = !result ? null : results.length > 1 || bag.parse.frames.length > 1
    ? { action: 'clarify', reason: 'multiple actions need separate project selection', name: null, folder: null }
    : { action: result.action, reason: result.reason, name: result.frame.seats.name ?? null,
        folder: result.frame.evidence.find(item => item.reason?.startsWith('path literal'))?.value ?? null,
        frame: result.frame };
  return { ...bag, projectIntent: intent, authority: 0 };
};

export const resolveConfirmation = bag => {
  const tokens = (bag.parse?.frames ?? []).flatMap(frame => frame.tokens.filter(token => token.kind !== 'punct'));
  const denied = tokens.some(token => types(token).includes('negation') || senses(token).includes('cancel'));
  const affirmed = tokens.some(token => token.key === 'yes' || senses(token).includes('confirm')) && tokens.every(token =>
    token.key === 'yes' || senses(token).includes('confirm') || types(token).some(type => ['polite','pronoun','determiner'].includes(type)));
  return { ...bag, confirmation: denied ? false : affirmed ? true : null };
};
