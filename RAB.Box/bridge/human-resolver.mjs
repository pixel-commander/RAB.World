import path from 'node:path';
import { canonicalizeShape } from './shape-codec.mjs';

const QUESTION_KINDS = new Set(['fill-seat','define-token','choose-shape','rephrase','correct-fact','reject']);
const ACTIONS = new Set(['fill-seat','define-token','choose-shape','rephrase','correct-fact','reject']);
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uniq = values => [...new Set((values ?? []).filter(value => value !== null && value !== undefined && value !== ''))];
const rawToken = failure => String(failure?.value ?? failure?.token ?? failure?.raw ?? '').trim();

const validateType = (type, value) => {
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const normalized=String(value).trim().toLowerCase();
    if (['true','yes','y','on'].includes(normalized)) return true;
    if (['false','no','n','off'].includes(normalized)) return false;
    throw Object.assign(new Error('Expected a boolean answer.'),{code:'HUMAN_ANSWER_TYPE'});
  }
  if (type === 'number') {
    const n=Number(value); if (!Number.isFinite(n)) throw Object.assign(new Error('Expected a numeric answer.'),{code:'HUMAN_ANSWER_TYPE'}); return n;
  }
  if (type === 'path') {
    const text=String(value ?? '').trim(); if (!text) throw Object.assign(new Error('Expected a path answer.'),{code:'HUMAN_ANSWER_TYPE'});
    if (text.includes('\0')) throw Object.assign(new Error('Path answer contains a null byte.'),{code:'HUMAN_ANSWER_TYPE'});
    return text.replaceAll('\\','/');
  }
  const text=String(value ?? '').trim(); if (!text) throw Object.assign(new Error('Expected a non-empty answer.'),{code:'HUMAN_ANSWER_TYPE'}); return text;
};

export const createQuestionContract = ({
  kind='fill-seat',
  seat=null,
  prompt,
  accepts={type:'string'},
  scope='step',
  knownSeats={},
  legalFills=[],
  unknown=null,
  actions=null,
  onAnswer={},
  source=null
}={}) => {
  if (!QUESTION_KINDS.has(kind)) throw Object.assign(new Error(`Unknown question kind: ${kind}`),{code:'BAD_QUESTION_KIND'});
  const allowedActions=uniq(actions?.length ? actions : [kind]);
  for (const action of allowedActions) if (!ACTIONS.has(action)) throw Object.assign(new Error(`Unknown human action: ${action}`),{code:'BAD_QUESTION_ACTION'});
  return canonicalizeShape({
    version:'question-contract/v0.8.5',
    kind,
    seat,
    prompt:String(prompt ?? (seat ? `What is ${seat}?` : 'Provide the missing information.')),
    accepts:record(accepts)?accepts:{type:String(accepts ?? 'string')},
    scope,
    known_seats:knownSeats,
    legal_fills:uniq(legalFills),
    unknown:unknown || null,
    actions:allowedActions,
    on_answer:onAnswer,
    source:source || null
  });
};

export const questionForFailure = ({ failure, missingSeat=null, knownSeats={}, legalFills=[], seatContract=null }={}) => {
  if (!failure && !missingSeat) return null;
  const blocker=failure?.blocker_type ?? failure?.type ?? null;
  const seat=missingSeat ?? failure?.seat ?? null;
  const token=rawToken(failure);
  const fills=uniq(legalFills);

  if (blocker === 'typed-unknown') {
    const typedSeat=seat ?? failure?.seat ?? null;
    const type=failure?.type ?? 'value';
    return createQuestionContract({
      kind:'define-token',
      seat:typedSeat,
      prompt:`I know the missing ${typedSeat ?? 'meaning'} position, but I do not know what "${token}" means here. Define it, choose a legal value, or rephrase.`,
      accepts:fills.length?{type:'string',enum:fills}:{type:'string'},
      knownSeats,
      legalFills:fills,
      unknown:{raw:token,type,known:false},
      actions:['define-token','choose-shape','rephrase'],
      onAnswer:{train:'language-rule',resume:'same-step',coldVerify:true},
      source:'typed-unknown'
    });
  }

  if (blocker === 'unknown-word') {
    return createQuestionContract({
      kind:'rephrase',
      seat,
      prompt:`Unknown token: "${token}". Correct or rephrase the request.`,
      accepts:{type:'string'},
      knownSeats,
      unknown:{raw:token,known:false},
      actions:['rephrase','define-token'],
      onAnswer:{resume:'same-step'},
      source:'unknown-word'
    });
  }

  if (blocker === 'ambiguous-seat') {
    return createQuestionContract({
      kind:'choose-shape',seat,
      prompt:`Choose the legal value for ${seat ?? 'the unresolved seat'}.`,
      accepts:fills.length?{type:'string',enum:fills}:{type:'string'},
      knownSeats,legalFills:fills,
      actions:['choose-shape','rephrase','reject'],
      onAnswer:{fill:seat,resume:'same-step'},source:'ambiguous-seat'
    });
  }

  if (blocker === 'conflict') {
    return createQuestionContract({
      kind:'correct-fact',seat,
      prompt:`The current ${seat ?? 'fact'} conflicts with existing verified context. Supply the corrected value or reject this interpretation.`,
      accepts:seatContract?.accepts ?? {type:seatContract?.type ?? 'string'},
      knownSeats,legalFills:fills,
      actions:['correct-fact','reject','rephrase'],
      onAnswer:{fill:seat,persist:seatContract?.persist ?? null,resume:'same-step',supersede:true},source:'conflict'
    });
  }

  if (blocker === 'capability-gap' || seat === 'capability') {
    return createQuestionContract({
      kind:'rephrase',seat:'capability',
      prompt:'No registered capability matches the resolved shape. Rephrase the operation or choose a registered capability.',
      accepts:{type:'string'},knownSeats,legalFills:fills,
      actions:['rephrase','choose-shape','reject'],
      onAnswer:{resume:'same-step'},source:'capability-gap'
    });
  }

  const type=seatContract?.type ?? 'string';
  const scope=seatContract?.scope ?? (seatContract?.persist==='project'?'project':'step');
  const prompt=seatContract?.prompt ?? seatContract?.human?.prompt ?? `What is ${String(seat ?? 'the missing value').replaceAll('_',' ')}?`;
  const accepts=seatContract?.accepts ?? seatContract?.human?.accepts ?? {type};
  return createQuestionContract({
    kind:'fill-seat',seat,prompt,accepts,scope,knownSeats,legalFills:fills,
    actions:['fill-seat','rephrase','reject'],
    onAnswer:{fill:seat,persist:seatContract?.persist ?? seatContract?.human?.persist ?? null,resume:'same-step',verify:seatContract?.verify ?? false},
    source:'missing-seat'
  });
};

export const resolveHumanAnswer = ({ question, action=null, answer=null, currentShape={} }={}) => {
  if (!question || question.version!=='question-contract/v0.8.5') throw Object.assign(new Error('A Question Contract is required.'),{code:'BAD_QUESTION'});
  const chosen=action ?? question.kind;
  if (!question.actions?.includes(chosen)) throw Object.assign(new Error(`Action ${chosen} is not legal for this question.`),{code:'ILLEGAL_HUMAN_ACTION'});

  if (chosen === 'reject') return canonicalizeShape({event:{kind:'reject',question_kind:question.kind},returned:{},after:currentShape,persist:null,resume:false});
  if (chosen === 'rephrase') {
    const text=validateType('string',answer);
    return canonicalizeShape({event:{kind:'rephrase',text},returned:{},after:currentShape,persist:null,resume:true});
  }
  if (chosen === 'define-token') {
    const value=validateType('string',answer);
    if (question.accepts?.enum?.length && !question.accepts.enum.includes(value)) throw Object.assign(new Error(`Answer must be one of: ${question.accepts.enum.join(', ')}`),{code:'HUMAN_ANSWER_ENUM'});
    return canonicalizeShape({event:{kind:'define-token',token:question.unknown?.raw ?? null,sense:value,seat:question.seat},returned:{},after:currentShape,training:{kind:'language-rule',token:question.unknown?.raw ?? null,sense:value,seat:question.seat,cold_verify:question.on_answer?.coldVerify===true},persist:question.on_answer?.persist ?? null,resume:true});
  }

  const value=validateType(question.accepts?.type ?? 'string',answer);
  if (question.accepts?.enum?.length && !question.accepts.enum.includes(value)) throw Object.assign(new Error(`Answer must be one of: ${question.accepts.enum.join(', ')}`),{code:'HUMAN_ANSWER_ENUM'});
  const seat=question.seat;
  if (!seat) throw Object.assign(new Error('Question Contract does not identify a seat to fill.'),{code:'BAD_QUESTION'});
  const returned={ [seat]:value };
  const after={ ...currentShape, [seat]:value };
  return canonicalizeShape({event:{kind:chosen,seat,value},returned,after,persist:question.on_answer?.persist ?? null,resume:question.on_answer?.resume!=='never'});
};

export const legacyQuestionContract = ({ kind='required-input', field=null, question=null, optionType='string', pathKey=null, saveTo=null, ...extra }={}) => {
  const persist=saveTo?.includes('project') || kind==='project-path' ? 'project' : null;
  const scope=persist==='project'?'project':'step';
  const seat=field?.startsWith('path:') ? field.slice(5) : field;
  return createQuestionContract({
    kind:'fill-seat',seat,prompt:question ?? `What is ${seat ?? 'the missing value'}?`,accepts:{type:pathKey||kind==='project-path'?'path':optionType||'string'},scope,
    actions:['fill-seat','rephrase','reject'],onAnswer:{fill:seat,persist,resume:'same-step'},source:`legacy:${kind}`,...extra
  });
};
