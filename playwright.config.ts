import { defineConfig } from '@playwright/test';

const externalBaseURL = process.env.NEURAL_BRUSH_E2E_BASE_URL;
const localBaseURL = 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: localBaseURL,
        reuseExistingServer: false,
      },
});
