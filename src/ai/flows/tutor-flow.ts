
'use server';
/**
 * @fileOverview Le flux Genkit pour l'assistant Tuteur IA.
 *
 * - askTutor - Une fonction qui interroge le modèle d'IA avec le contexte du cours.
 * - TutorInput - Le type d'entrée pour la fonction askTutor.
 */
import {Course, User} from '@/lib/types';
import {genkit, ai} from '@/lib/genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'zod';

// Définir le schéma d'entrée pour le flux du tuteur.
export const TutorInputSchema = z.object({
  query: z.string(),
  student: z.custom<User>(),
  courses: z.array(z.custom<Course>()),
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
    })
  ),
});

export type TutorInput = z.infer<typeof TutorInputSchema>;

// Construire le prompt pour le tuteur
const tutorPrompt = ai.definePrompt(
  {
    name: 'tutorPrompt',
    input: {
      schema: z.object({
        query: z.string(),
        student: z.custom<User>(),
        courses: z.array(z.custom<Course>()),
      }),
    },
    prompt: `
      Tu es un tuteur IA expert pour l'ISGI (Institut Supérieur de Gestion et d'Ingénierie).
      Ton rôle est d'aider les étudiants à comprendre leurs cours, à réviser, et à répondre à leurs questions.
      Tu dois toujours être encourageant, positif et pédagogique.

      Informations sur l'étudiant:
      - Nom: {{{student.firstName}}} {{{student.lastName}}}
      - Niveau: {{{student.student.level}}}
      - Filière: {{{student.student.fieldId}}}

      Cours de l'étudiant:
      {{#each courses}}
      - {{{this.name}}}: {{{this.description}}} (Crédit: {{{this.credit}}})
      {{/each}}

      Instructions:
      1. Base tes réponses UNIQUEMENT sur les informations des cours fournis. Ne fournis pas d'informations externes.
      2. Si une question sort du cadre des cours listés, réponds gentiment que tu ne peux aider que sur ses matières actuelles.
      3. Adresse-toi à l'étudiant par son prénom, {{{student.firstName}}}.
      4. Tu peux générer des mini-quiz (2-3 questions) pour aider l'étudiant à tester sa compréhension si cela est pertinent.
      5. Reste concis et clair dans tes explications.

      Question de l'étudiant:
      {{{query}}}
    `,
  },
);

const tutorFlow = ai.defineFlow(
  {
    name: 'tutorFlow',
    inputSchema: TutorInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { query, student, courses, history } = input;
    
    const llmResponse = await ai.generate({
      prompt: {
        text: await tutorPrompt.renderText({ input: { query, student, courses } }),
      },
      model: 'googleai/gemini-1.5-flash',
      history: history.map(h => ({ role: h.role, content: [{ text: h.content }] })),
    });

    return llmResponse.text;
  }
);


/**
 * Fonction principale du flux qui génère une réponse à la question de l'étudiant.
 * @param input L'objet d'entrée contenant la question et le contexte.
 * @returns Une promesse qui se résout en une chaîne de caractères (la réponse).
 */
export async function askTutor(input: TutorInput): Promise<string> {
    return tutorFlow(input);
}
