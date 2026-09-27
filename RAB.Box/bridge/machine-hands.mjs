import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Delegate catalog resolution and single-argument execution to Machine Hands.
export async function callMachineHands(name, args) {
  const client = new Client({ name: 'world-hands-machine-adapter', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.env.RAB_MACHINE_HANDS_PYTHON || 'python',
    args: [process.env.RAB_MACHINE_HANDS_SERVER || path.join(os.homedir(), 'plugins/machine-hands/mcp/server.py')],
    stderr: 'inherit'
  });
  try {
    await client.connect(transport);
    return await client.callTool({ name, arguments: args }, undefined, { timeout: 130000 });
  } finally {
    await client.close();
  }
}
