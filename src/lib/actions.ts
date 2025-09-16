'use server';

import { summarizeLongMessage } from '@/ai/flows/summarize-long-messages';

export async function summarizeMessageAction(message: string) {
  if (message.length < 50) {
    return { summary: null, error: 'Message is too short to summarize.' };
  }
  try {
    const result = await summarizeLongMessage({ message });
    return { summary: result.summary, error: null };
  } catch (e) {
    console.error(e);
    return { summary: null, error: 'Failed to summarize message.' };
  }
}
