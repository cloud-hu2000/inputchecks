import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '../..');

export default defineConfig({
  testDir: configDir,
  testMatch: '**/*.e2e.ts',
  use: { baseURL: 'http://localhost:4321', channel: 'chrome' },
  webServer: {
    command: 'npm run dev',
    cwd: repoRoot,
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});
