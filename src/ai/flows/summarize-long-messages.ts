// Summarize long messages using AI to provide a brief overview for quick consumption.


/**
 * @fileOverview Summarizes lengthy messages using AI.
 *
 * - summarizeLongMessage - A function that summarizes a long message.
 * - SummarizeLongMessageInput - The input type for the summarizeLongMessage function.
 * - SummarizeLongMessageOutput - The return type for the summarizeLongMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeLongMessageInputSchema = z.object({
  message: z.string().describe('The lengthy message to be summarized.'),
});
export type SummarizeLongMessageInput = z.infer<typeof SummarizeLongMessageInputSchema>;

const SummarizeLongMessageOutputSchema = z.object({
  summary: z.string().describe('The summarized version of the message.'),
});
export type SummarizeLongMessageOutput = z.infer<typeof SummarizeLongMessageOutputSchema>;

export async function summarizeLongMessage(input: SummarizeLongMessageInput): Promise<SummarizeLongMessageOutput> {
  return summarizeLongMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeLongMessagePrompt',
  input: {schema: SummarizeLongMessageInputSchema},
  output: {schema: SummarizeLongMessageOutputSchema},
  prompt: `Summarize the following message in a concise manner:\n\n{{{message}}}`,
});

const summarizeLongMessageFlow = ai.defineFlow(
  {
    name: 'summarizeLongMessageFlow',
    inputSchema: SummarizeLongMessageInputSchema,
    outputSchema: SummarizeLongMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
