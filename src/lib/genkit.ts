import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';

// Initialize and export the AI instance directly.
export const ai = genkit({
  plugins: [
    firebase(),
    googleAI(),
  ],
  logLevel: 'warn',
  enableTracingAndMetrics: true,
});

// Also export genkit itself if needed elsewhere.
export { genkit };
