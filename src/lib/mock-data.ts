

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field } from './types';

// Mock data is now being phased out in favor of Firestore.
// It is kept here for reference and potential fallback during development.

export const mockUsers: User[] = [
  // This data is now primarily managed in Firestore.
];

export const mockSectors: Sector[] = [
  { id: 'gestion', name: 'GESTION' },
  { id: 'industrie', name: 'INDUSTRIE' },
  { id: 'technologie', name: 'TECHNOLOGIE' },
];

export const mockFields: Field[] = [
    // GESTION
    { "id": "cge", "name": "Comptabilité et gestion d’entreprise", "sectorId": "gestion" },
    { "id": "acg", "name": "Audit et contrôle de gestion", "sectorId": "gestion" },
    { "id": "ci", "name": "Commerce international", "sectorId": "gestion" },
    { "id": "gam", "name": "Gestion en affaires mondiales", "sectorId": "gestion" },
    { "id": "mce", "name": "Marketing et communication d’entreprise", "sectorId": "gestion" },
    { "id": "gf", "name": "Gestion des finances", "sectorId": "gestion" },
    { "id": "grhae", "name": "GRH et administration des entreprises", "sectorId": "gestion" },
    { "id": "eli", "name": "Entrepreneuriat et leadership international", "sectorId": "gestion" },
    { "id": "dia", "name": "Droit international des affaires", "sectorId": "gestion" },
    { "id": "lt", "name": "Logistique et transport", "sectorId": "gestion" },

    // TECHNOLOGIE
    { "id": "ri", "name": "Réseaux informatiques", "sectorId": "technologie" },
    { "id": "tfo", "name": "Télécommunications et fibre optique", "sectorId": "technologie" },
    { "id": "mi", "name": "Maintenance informatique", "sectorId": "technologie" },
    { "id": "a2d3dm", "name": "Animation 2D, 3D et motion design", "sectorId": "technologie" },
    { "id": "gi", "name": "Génie informatique", "sectorId": "technologie" },
    { "id": "cs", "name": "Cybersécurité", "sectorId": "technologie" },
    { "id": "ria", "name": "Robotique et Intelligence Artificielle", "sectorId": "technologie" },
    { "id": "dwm", "name": "Développement web et mobile", "sectorId": "technologie" },
    { "id": "prog", "name": "Programmation", "sectorId": "technologie" },
    { "id": "idg", "name": "Infographie et design graphique", "sectorId": "technologie" },
    { "id": "ars", "name": "Administration réseaux et systèmes", "sectorId": "technologie" },
    { "id": "abd", "name": "Administration des Bases de Données", "sectorId": "technologie" },
    { "id": "gl", "name": "Génie Logiciel", "sectorId": "technologie" },

    // INDUSTRIE
    { "id": "gee", "name": "Génie électrique et électronique", "sectorId": "industrie" },
    { "id": "gm", "name": "Génie mécanique", "sectorId": "industrie" },
    { "id": "gca", "name": "Génie civil & Architecture", "sectorId": "industrie" },
    { "id": "mpg", "name": "Maintenance du pétrole et du gaz", "sectorId": "industrie" },
    { "id": "ervl", "name": "Entretien et réparation des véhicules légers", "sectorId": "industrie" },
    { "id": "ervp", "name": "Entretien et réparation des véhicules lourds", "sectorId": "industrie" },
    { "id": "tpg", "name": "Traitement du pétrole et du gaz", "sectorId": "industrie" },
    { "id": "dpg", "name": "Distribution pétrolière et gazière", "sectorId": "industrie" },
    { "id": "ot", "name": "Opérateur topographe", "sectorId": "industrie" },
    { "id": "fc", "name": "Froid et climatisation", "sectorId": "industrie" },
    { "id": "esr", "name": "Énergie solaire et renouvelable", "sectorId": "industrie" },
    { "id": "psi", "name": "Plomberie et soudure industrielle", "sectorId": "industrie" },
    { "id": "eis", "name": "Équipement industriel et sanitaire", "sectorId": "industrie" }
];


export const mockPrograms: Program[] = [
    {
        id: "prog01",
        name: "Ingénierie Informatique",
        description: "Cycle d'ingénieur en génie logiciel et systèmes d'information",
        createdAt: new Date().toISOString(),
        responsible: "teacher01"
    }
]

export const mockClasses: Class[] = [
  {
    id: 'class01',
    programId: 'prog01',
    name: 'Licence 3 - Génie Logiciel',
    academicYear: '2024-2025',
    students: ['student01', 'student02'],
    createdAt: new Date().toISOString(),
  },
];

export const mockCourses: Course[] = [
    {
        id: "math01",
        name: "Mathématiques pour l'ingénieur",
        description: "Cours de Licence 3",
        teacherId: "teacher01",
        programId: "prog01",
    }
]

export const mockMessages: Message[] = [
  {
    id: 'msg01',
    senderId: 'admin01',
    receiverId: 'all',
    content: 'Bienvenue à l\'année académique 2024-2025! Nous sommes ravis de vous accueillir à l\'ISGI.',
    type: 'announcement',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg02',
    senderId: 'admin01',
    receiverId: 'class01',
    content: 'Rappel : La réunion de rentrée pour la classe de Licence 3 aura lieu ce vendredi.',
    type: 'announcement',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    attachments: ['https://example.com/ordre_du_jour.pdf'],
  },
  {
    id: 'msg03',
    senderId: 'teacher01',
    receiverId: 'student01',
    content: 'Bonjour Alice, n\'oublie pas de rendre ton projet de mathématiques avant demain soir.',
    type: 'private',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg04',
    senderId: 'student01',
    receiverId: 'teacher01',
    content: 'Bonjour Mme. Curie, j\'ai une question concernant le projet. Pouvez-vous m\'éclairer sur la méthode à utiliser ?',
    type: 'private',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg05',
    senderId: 'teacher01',
    receiverId: 'student01',
    content: 'Bien sûr, Alice. Pense à utiliser les méthodes d\'analyse numérique que nous avons vues en cours. C\'est un problème plus complexe qu\'il n\'y paraît. Il faut décomposer le problème en plusieurs étapes. La première étape consiste à bien définir le modèle mathématique. Ensuite, appliquez les algorithmes appropriés. Faites attention aux conditions initiales. Si tu as d\'autres questions, n\'hésite pas à venir me voir après le cours. Nous pourrons regarder ça ensemble. Bon courage!',
    type: 'private',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export const mockDocuments: OfficialDocument[] = [
  {
    id: 'doc01',
    studentId: 'student01',
    type: 'bulletin',
    fileUrl: '#',
    issuedBy: 'admin01',
    issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'doc02',
    studentId: 'student01',
    type: 'certificat',
    fileUrl: '#',
    issuedBy: 'admin01',
    issuedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
