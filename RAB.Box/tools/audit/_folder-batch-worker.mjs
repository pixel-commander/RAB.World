import { createToolHouse } from '../../bridge/tool-house.mjs';
import { createRabMemory } from '../../bridge/rab-memory.mjs';
import { assertNumericId } from '../../bridge/rab-id.mjs';
import { reservedExecutionMemory } from '../../bridge/tool-tracking.mjs';
import { boundedFolderJson } from '../../bridge/rab-folder-records.mjs';
import { checkedFolder } from './_folder-index.mjs';
import { fingerprintDirectFolderTool } from './_folder-batch.mjs';

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const send = async value => {
  const json = boundedFolderJson(value, 48 * 1024);
  await new Promise((resolve, reject) => process.send(json, error => error ? reject(error) : resolve()));
};
process.once('message', async message => {
  let execution = null;
  try {
    if (typeof message !== 'string' || Buffer.byteLength(message) > 16 * 1024) fail('BAD_WORKER_REQUEST', 'Worker request exceeds its bound.');
    const config = JSON.parse(message);
    assertNumericId(config.executionId);
    const house = createToolHouse({ root: config.root, toolsRoot: config.toolsRoot });
    const tool = await house.getTool(config.toolKey);
    const fingerprint = await fingerprintDirectFolderTool(tool);
    if (tool.id !== config.toolId || fingerprint !== config.fingerprint) fail('TOOL_CHANGED', 'Tool changed after batch preparation.');
    const folder = await checkedFolder(config.sourceRoot, config.relativePath);
    const memory = createRabMemory({ rabHome: config.rabHome });
    // This private supervisor reserved the first attempt through the very same
    // memory owner. The existing runner adopts it once; nested calls, if any,
    // still allocate through that owner. Public tool options cannot supply it.
    const allocationMemory = reservedExecutionMemory(memory, config.executionId);
    const output = await house.runTool({ key: config.toolKey, options: { ...config.options, folder }, context: { rab_home: config.rabHome, __rab_run: { memory: allocationMemory, sessionId: null } } });
    execution = output.execution;
    // Descendant traces are not sent across IPC. This first adapter accepts a
    // leaf direct-folder tool; a composite must supply its own bounded protocol.
    if (output.tasks.length !== 1) fail('UNSUPPORTED_FOLDER_SCOPE', 'Direct-folder batch tools must be leaf tools.');
    await send({ status: 'completed', execution: output.execution, result: output.result });
  } catch (error) {
    await send({ status: 'failed', error: { code: String(error.code ?? 'ERROR').slice(0, 80), message: String(error.message).slice(0, 1024) }, execution: error.execution ?? execution }).catch(() => {});
  } finally {
    if (process.connected) process.disconnect();
  }
});
