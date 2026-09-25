import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('World Hands stdio discovery, invocation, and write boundary', async () => {
  const client = new Client({ name: 'world-hands-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../bridge/world-hands.mjs', import.meta.url))],
    env: { ...process.env, RAB_WORLD_BEACON_MANIFEST: path.join(os.homedir(), '.rab/worlds/server/beacons/manifest.json') }
  });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ['report_search_feedback', 'get_world_beacons', 'get_beacon_manifests', 'search_world', 'list_world_hands', 'invoke_world_hand']);
    const call = async (name, args) => {
      const response = await client.callTool({ name, arguments: args });
      assert.ok(!response.isError, JSON.stringify(response));
      return JSON.parse(response.content[0].text);
    };
    const registry = await call('get_world_beacons', {});
    assert.ok(registry.items.length);
    const names = registry.items.slice(0, 2).map(item => item.name);
    const many = await call('get_beacon_manifests', { beacons: names });
    assert.deepEqual(many.map(item => item.beacon.name), names);
    const one = await call('get_beacon_manifests', { beacons: [registry.items[0].id] });
    assert.equal(one.length, 1);
    assert.ok(one[0].manifest.items.length);
    const partial = await call('get_beacon_manifests', { beacons: [names[0], 'no-such-beacon'] });
    assert.ok(partial[0].manifest);
    assert.ok(partial[1].error);
    assert.deepEqual(await call('get_beacon_manifests', { beacons: [] }), []);
    const invalid = await client.callTool({ name: 'get_beacon_manifests', arguments: { beacons: names[0] } });
    assert.equal(invalid.isError, true);
    const search = await call('search_world', { query: 'atom' });
    assert.ok(search.items.length);
    const listed = await client.callTool({ name: 'list_world_hands', arguments: {} });
    assert.ok(!listed.isError, JSON.stringify(listed));
    const catalog = JSON.parse(listed.content[0].text);
    assert.equal(catalog.status, 'ready');
    assert.ok(catalog.hands.length > 0);
    const read = await client.callTool({ name: 'invoke_world_hand', arguments: { key: 'world/world-hands', options: {} } });
    assert.ok(!read.isError, JSON.stringify(read));
    assert.equal(JSON.parse(read.content[0].text).result.status, 'ready');
    const writer = catalog.hands.find(hand => hand.authority !== 'read');
    assert.ok(writer);
    const blocked = await client.callTool({ name: 'invoke_world_hand', arguments: { key: writer.call.key, options: {} } });
    assert.equal(blocked.isError, true);
    assert.match(blocked.content[0].text, /CONFIRM_REQUIRED/);
    const outside = await client.callTool({ name: 'invoke_world_hand', arguments: { key: 'base/find/tool', options: {}, confirm: true } });
    assert.equal(outside.isError, true);
    assert.match(outside.content[0].text, /not available/);
  } finally {
    await client.close();
  }
});
