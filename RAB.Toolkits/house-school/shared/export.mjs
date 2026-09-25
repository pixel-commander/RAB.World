import { bundle } from './stamping.mjs';

export const candidate = (record, problem, solution) => ({
  status: 'candidate', schema: 'house-school-candidate/v1',
  case: record.case, family: record.family, packaging: record.packaging,
  synthetic: true, approval: null,
  messages: [
    { role: 'user', content: `Repair only violations of this contract. Preserve already-correct code and names. Return all supplied files, with their FILE labels, without explanation.\nContract: ${record.contract}\n\n${bundle(problem)}` },
    { role: 'assistant', content: bundle(solution) },
  ],
});
