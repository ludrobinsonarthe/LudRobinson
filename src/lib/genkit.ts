
import { genkit, Ai } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';

let aiInstance: Ai | null = null;

function getAiInstance() {
  if (!aiInstance) {
    aiInstance = genkit({
      plugins: [
        firebase(),
        googleAI(),
      ],
      logLevel: 'warn',
      enableTracingAndMetrics: true,
    });
  }
  return aiInstance;
}

export { genkit, getAiInstance as ai };
