import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpath } from 'node:fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createToolHouse } from './tool-house.mjs';
import { pathIdentity } from './toolkit-links.mjs';
import { getWorldBeacons, getBeaconManifests } from '../../RAB.Toolkits/rab-world/tools/world/world-hands/indexes.mjs';
import { run as searchWorld } from '../../RAB.Toolkits/rab-world/tools/world/world-search/world-search.mjs';
import { run as searchFeedback } from '../../RAB.Toolkits/rab-world/tools/world/search-feedback/search-feedback.mjs';

const boxRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const reply = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

export const createWorldHandsServer = ({ root = boxRoot, manifestPath = process.env.RAB_WORLD_BEACON_MANIFEST } = {}) => {
  const house = createToolHouse({ root });
  const server = new Server({ name: 'world-hands', version: '1.0.0' }, { capabilities: { tools: {} } });
  const catalog = async () => {
    const expectedRoot = await realpath(path.resolve(root, '../RAB.Toolkits/rab-world'));
    const found = await house.listTools({ fresh: true });
    const items = found.items.filter(tool => tool.domain === 'world' && tool.toolkit &&
      pathIdentity(tool.toolkit.root) === pathIdentity(expectedRoot));
    return items;
  };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
    {
      name: 'report_search_feedback', description: 'Increment used for an actually used search result by numeric item ID. Call once per actual use; not merely for viewing. Every call increments; avoid retrying uncertain calls.',
      inputSchema: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'], additionalProperties: false },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    {
      name: 'get_world_beacons', description: 'Get the configured world beacon registry, including paths, on/off state and priority order. No discovery call or path needed.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'get_beacon_manifests', description: 'Get one or many registered beacon manifests. Always pass a beacons array of names or numeric IDs. Returns an array in request order with individual errors; can inspect disabled beacons too.',
      inputSchema: { type: 'object', properties: { beacons: { type: 'array', maxItems: 100, items: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'integer', minimum: 1 }] } } }, required: ['beacons'], additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'search_world', description: 'Search beacon indexes and increment shown counters by item ID. Missing source IDs are allocated and manifests synchronized with backups. Report actual use by ID. No query history.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    {
      name: 'list_world_hands', description: 'List available World hands, their required inputs, authority, and discovery errors. Does not run the listed hands.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'invoke_world_hand', description: 'Run a World hand by exact catalog key through Box. Read list_world_hands first. Set confirm=true only after user authorization for a writing action. Missing inputs are reported by Box.',
      inputSchema: {
        type: 'object', properties: {
          key: { type: 'string', description: 'Exact callable key returned by list_world_hands.' },
          options: { type: 'object', additionalProperties: true },
          confirm: { type: 'boolean', description: 'Explicit confirmation required for non-read hands.' }
        }, required: ['key', 'options'], additionalProperties: false
      }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
    }
  ] }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    try {
      const args = params.arguments ?? {};
      if (!isObject(args)) throw new Error('Arguments must be an object.');
      if (params.name === 'report_search_feedback') {
        if (Object.keys(args).some(key => key !== 'id')) throw new Error('Unexpected feedback field.');
        return reply(await searchFeedback({ options: args }));
      }
      if (params.name === 'get_world_beacons') {
        if (Object.keys(args).length) throw new Error('get_world_beacons takes no arguments.');
        return reply(await getWorldBeacons(manifestPath));
      }
      if (params.name === 'get_beacon_manifests') {
        if (Object.keys(args).some(key => key !== 'beacons') || !Array.isArray(args.beacons) || args.beacons.length > 100 || !args.beacons.every(beacon => (typeof beacon === 'string' && beacon.trim()) || (Number.isSafeInteger(beacon) && beacon > 0))) throw new Error('Provide a beacons array of names or positive numeric IDs (up to 100).');
        return reply(await getBeaconManifests(manifestPath, args.beacons));
      }
      if (params.name === 'search_world') {
        if (Object.keys(args).some(key => key !== 'query')) throw new Error('search_world accepts only query.');
        return reply(await searchWorld({ options: { query: args.query, manifest_path: manifestPath } }));
      }
      const items = await catalog();
      if (params.name === 'list_world_hands') {
        if (Object.keys(args).length) throw new Error('list_world_hands takes no arguments.');
        const tool = items.find(item => item.key === 'world/world-hands');
        if (!tool) throw new Error('World Hands catalog unavailable. Check Box TOOLKITS.json and toolkit discovery.');
        return reply((await house.runTool({ key: tool.key })).result);
      }
      if (params.name !== 'invoke_world_hand') throw new Error('Unknown MCP tool.');
      if (Object.keys(args).some(key => !['key', 'options', 'confirm'].includes(key)) ||
          typeof args.key !== 'string' || !isObject(args.options) ||
          (args.confirm !== undefined && typeof args.confirm !== 'boolean')) throw new Error('Invalid invocation arguments.');
      const tool = items.find(item => item.key === args.key);
      if (!tool) throw new Error('Hand is not available in the linked World toolkit.');
      if (tool.meta.authority !== 'read' && args.confirm !== true) throw new Error('CONFIRM_REQUIRED: obtain user authorization and pass confirm=true before running this hand.');
      const result = await house.runTool({ key: tool.key, options: args.options });
      return reply({ tool: result.tool, result: result.result, execution: result.execution });
    } catch (error) {
      return { ...reply({ code: error.code ?? 'WORLD_HAND_ERROR', message: error.message }), isError: true };
    }
  });
  return server;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // stdout belongs exclusively to MCP messages, including during tool execution.
  console.log = console.info = console.debug = console.error;
  const server = createWorldHandsServer();
  await server.connect(new StdioServerTransport());
}
