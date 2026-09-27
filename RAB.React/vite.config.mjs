import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { worldSettings } from './server/world-settings.mjs';
export default defineConfig({ plugins: [react(), worldSettings()], server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' } });
