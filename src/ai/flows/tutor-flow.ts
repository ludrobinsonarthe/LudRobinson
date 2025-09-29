
/**
 * @fileOverview An AI tutor that can answer student questions and generate quizzes.
 * 
 * - tutor - A function that handles the AI tutor logic.
 * - TutorInput - The input type for the tutor function.
 * - TutorOutput - The return type for the tutor function.
 * - TutorMessage - The type for a single message in the conversation history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TutorMessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
});
export type TutorMessage = z.infer<typeof TutorMessageSchema>;

const TutorInputSchema = z.object({
  history: z.array(TutorMessageSchema),
});
export type TutorInput = z.infer<typeof TutorInputSchema>;

const QuizQuestionSchema = z.object({
    question: z.string().describe("The quiz question to ask."),
    options: z.array(z.string()).describe("A list of 4 possible answers."),
    answer: z.string().describe("The correct answer from the options."),
    explanation: z.string().describe("A brief explanation of why the answer is correct."),
});

const TutorOutputSchema = z.object({
  response: z.string().describe("The AI tutor's text response to the user's question."),
  quiz: z.optional(z.array(QuizQuestionSchema)).describe("An optional quiz with 3 questions to test the user's knowledge on the topic."),
});
export type TutorOutput = z.infer<typeof TutorOutputSchema>;

export async function tutor(input: TutorInput): Promise<TutorOutput> {
  return tutorFlow(input);
}

const prompt = ai.definePrompt({
    name: 'tutorPrompt',
    input: { schema: TutorInputSchema },
    output: { schema: TutorOutputSchema },
    prompt: `You are a friendly and encouraging AI Tutor for students at a higher education institute. Your name is ISGI-Bot.
    Your goal is to help students understand their course material better.

    Here are your instructions:
    1.  Analyze the user's question from the provided history.
    2.  Provide a clear, concise, and helpful answer to the user's question. Address the student directly.
    3.  If the user's question is about a specific academic topic (like "Explain the concept of photosynthesis" or "What are the main causes of World War 1?"), you MUST ALSO generate a short, relevant 3-question quiz to test their understanding of the topic you just explained.
    4.  If the question is conversational (e.g., "Hello", "Who are you?", "Thank you") or not related to an academic subject, just provide a friendly response and DO NOT generate a quiz.
    5.  Format your responses in Markdown for readability. Use lists, bold text, and italics where appropriate.

    Here is the conversation history:
    {{#each history}}
        **{{role}}**: {{{content}}}
    {{/each}}
    `,
});

const tutorFlow = ai.defineFlow(
  {
    name: 'tutorFlow',
    inputSchema: TutorInputSchema,
    outputSchema: TutorOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
