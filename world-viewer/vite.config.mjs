import { defineConfig } from 'vite';
import { beaconFiles } from './automation/beacon-files.mjs';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react(), beaconFiles()], server: { host: '127.0.0.1' }, preview: { host: '127.0.0.1' } });
