import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.mjs';

test('CSP permits the shipped UI with LF, CRLF, CR and mixed line endings', async t => {
  const parent = path.join(os.homedir(), '.rab', 'temp', 'test');
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'server-csp-'));
  let app;
  t.after(async () => {
    if (app) await app.close();
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith('server-csp-'));
    await rm(root, { recursive: true, force: true });
  });
  for (const folder of ['tools', 'language']) await mkdir(path.join(root, folder));
  await writeFile(path.join(root, 'HOST.json'), JSON.stringify({ interface: 'index.html', language: 'language' }));
  const html = (await readFile(new URL('../magic-box/index.html', import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
  const interfaceFile = path.join(root, 'index.html');
  await writeFile(interfaceFile, html);
  app = await startServer({ root, port: 0, rabHome: path.join(root, 'memory') });

  const expected = Object.fromEntries(['script', 'style'].map(tag => {
    const blocks = [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g'))];
    assert.ok(blocks.length > 0, `The shipped UI contains inline ${tag}`);
    return [`${tag}-src`, blocks.map(([, text]) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`)];
  }));
  let newline = 0;
  const variants = {
    LF: html,
    CRLF: html.replace(/\n/g, '\r\n'),
    CR: html.replace(/\n/g, '\r'),
    // Do not turn adjacent blank lines into a single CRLF sequence.
    mixed: html.replace(/\n/g, () => ['\n', '\r', '\r\n'][newline++ % 3])
  };

  for (const [name, input] of Object.entries(variants)) {
    await t.test(name, async () => {
      await writeFile(interfaceFile, input);
      for (const route of ['/', '/magic-box/', '/magic-box/index.html']) {
        const response = await fetch(app.origin + route);
        assert.equal(response.status, 200);
        const policy = response.headers.get('content-security-policy');
        assert.doesNotMatch(policy, /'unsafe-inline'|'unsafe-eval'/);
        const directives = new Map(policy.split(';').map(part => {
          const [directive, ...sources] = part.trim().split(/\s+/);
          return [directive, sources];
        }));
        assert.deepEqual(directives.get('script-src'), ["'self'", ...expected['script-src']]);
        assert.deepEqual(directives.get('style-src'), expected['style-src']);
        assert.equal(await response.text(), html);
      }
      assert.equal(await readFile(interfaceFile, 'utf8'), input, 'Serving does not rewrite the source file');
    });
  }
});
