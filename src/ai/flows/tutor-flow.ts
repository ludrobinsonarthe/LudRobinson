
'use server';
/**
 * @fileOverview Le flux Genkit pour l'assistant Tuteur IA.
 *
 * - askTutor - Une fonction qui interroge le modèle d'IA avec le contexte du cours.
 * - TutorInput - Le type d'entrée pour la fonction askTutor.
 */
import {Course, User} from '@/lib/types';
import {generate} from 'genkit';
import {googleAI} from 'genkit/googleai';
import {configureGenkit} from 'genkit';
import {z} from 'zod';

// Initialiser Genkit avec le plugin Google AI.
configureGenkit({
  plugins: [googleAI()],
  logLevel: 'warn', // 'debug' pour des logs détaillés
});

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

/**
 * Fonction principale du flux qui génère une réponse à la question de l'étudiant.
 * @param input L'objet d'entrée contenant la question et le contexte.
 * @returns Une promesse qui se résout en une chaîne de caractères (la réponse).
 */
export async function askTutor(input: TutorInput): Promise<string> {
  const {query, student, courses, history} = input;

  // Construire le contexte système pour le prompt.
  const courseContext = courses
    .map(
      (course) => `
- ${course.name}: ${course.description} (Crédit: ${course.credit})`
    )
    .join('');

  const systemPrompt = `
    Tu es un tuteur IA expert pour l'ISGI (Institut Supérieur de Gestion et d'Ingénierie).
    Ton rôle est d'aider les étudiants à comprendre leurs cours, à réviser, et à répondre à leurs questions.
    Tu dois toujours être encourageant, positif et pédagogique.

    Informations sur l'étudiant:
    - Nom: ${student.firstName} ${student.lastName}
    - Niveau: ${student.student?.level}
    - Filière: ${student.student?.fieldId}

    Cours de l'étudiant:
    ${courseContext}

    Instructions:
    1. Base tes réponses UNIQUEMENT sur les informations des cours fournis. Ne fournis pas d'informations externes.
    2. Si une question sort du cadre des cours listés, réponds gentiment que tu ne peux aider que sur ses matières actuelles.
    3. Adresse-toi à l'étudiant par son prénom, ${student.firstName}.
    4. Tu peux générer des mini-quiz (2-3 questions) pour aider l'étudiant à tester sa compréhension si cela est pertinent.
    5. Reste concis et clair dans tes explications.
  `;

  // Générer la réponse en utilisant le modèle Gemini 1.5 Flash.
  const {response} = await generate({
    model: 'googleai/gemini-1.5-flash',
    prompt: query,
    system: systemPrompt,
    history: history.map((h) => ({
      role: h.role,
      content: [{text: h.content}],
    })),
  });

  return response.text();
}
