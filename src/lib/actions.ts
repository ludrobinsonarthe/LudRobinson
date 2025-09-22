'use server';

import { summarizeLongMessage } from '@/ai/flows/summarize-long-messages';
import { tutor, type TutorMessage } from '@/ai/flows/tutor-flow';


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

export async function tutorAction(history: TutorMessage[]) {
    try {
        const result = await tutor({ history });
        return { response: result, error: null };
    } catch (e) {
        console.error(e);
        return { response: null, error: 'Désolé, une erreur est survenue. Je ne peux pas répondre pour le moment.' };
    }
}
