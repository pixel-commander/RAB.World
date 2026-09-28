import { auditMap } from './server/audit-map.mjs';
import { auditTools } from './server/audit-tools.mjs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { worldSettings } from './server/world-settings.mjs';
export default defineConfig({ plugins: [react(), worldSettings(), auditTools(), auditMap()], server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' } });
