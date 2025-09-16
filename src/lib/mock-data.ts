

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field, Payment, Attendance, TeacherSalary, CashTransaction, AdminRole, Grade } from './types';

// Mock data is now being used as the primary source until Firestore rules are configured.

export const mockUsers: User[] = [
    {
        uid: "admin01",
        role: "admin",
        firstName: "Marie",
        lastName: "Curie",
        email: "marie.curie@isgi.com",
        photoUrl: "https://picsum.photos/seed/admin/100/100",
        createdAt: "2024-01-01T10:00:00Z",
        status: "active",
        admin: {
            roleId: "super_admin",
            position: "Directrice"
        }
    },
    {
        uid: "teacher01",
        role: "teacher",
        firstName: "Albert",
        lastName: "Einstein",
        email: "albert.einstein@isgi.com",
        photoUrl: "https://picsum.photos/seed/teacher1/100/100",
        createdAt: "2024-01-05T11:00:00Z",
        status: "active",
        teacher: {
            specialty: "Physique Théorique",
            assignedCourses: ["phys01"]
        }
    },
    {
        uid: "teacher02",
        role: "teacher",
        firstName: "Isaac",
        lastName: "Newton",
        email: "isaac.newton@isgi.com",
        photoUrl: "https://picsum.photos/seed/teacher2/100/100",
        createdAt: "2024-01-05T12:00:00Z",
        status: "active",
        teacher: {
            specialty: "Mathématiques",
            assignedCourses: ["math01"]
        }
    },
    {
        uid: "student01",
        role: "student",
        firstName: "Alice",
        lastName: "Wonderland",
        email: "alice.wonderland@isgi.com",
        photoUrl: "https://picsum.photos/seed/student1/100/100",
        createdAt: "2024-09-01T09:00:00Z",
        status: "active",
        student: {
            matricule: "ISGI-2024-001",
            programId: "prog01",
            level: "Licence 1",
            cycle: "local",
            fieldId: "gl",
            enrollmentDate: "2024-09-01T09:00:00Z",
            endDate: "2025-07-01T09:00:00Z",
            parentUid: "parent01"
        }
    },
     {
        uid: "student02",
        role: "student",
        firstName: "Bob",
        lastName: "Builder",
        email: "bob.builder@isgi.com",
        photoUrl: "https://picsum.photos/seed/student2/100/100",
        createdAt: "2024-09-01T09:05:00Z",
        status: "active",
        student: {
            matricule: "ISGI-2024-002",
            programId: "prog01",
            level: "Licence 1",
            cycle: "international",
            fieldId: "cs",
            enrollmentDate: "2024-09-01T09:05:00Z",
            endDate: "2025-07-01T09:00:00Z",
            parentUid: "parent01"
        }
    },
    {
        uid: "parent01",
        role: "parent",
        firstName: "Carol",
        lastName: "Danvers",
        email: "carol.danvers@email.com",
        photoUrl: "https://picsum.photos/seed/parent1/100/100",
        createdAt: "2024-09-01T08:00:00Z",
        status: "active",
        parent: {
            childrenUids: ["student01", "student02"]
        }
    }
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
        description: "Cours de Licence 1",
        teacherId: "teacher02",
        fieldId: "gl",
        level: "Licence 1",
        cycle: "local",
    },
    {
        id: "phys01",
        name: "Physique Générale",
        description: "Cours de Licence 1",
        teacherId: "teacher01",
        fieldId: "gl",
        level: "Licence 1",
        cycle: "local",
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

export const mockPayments: Payment[] = [
    {
        id: "pay01",
        studentId: "student01",
        amountExpected: 150000,
        amountPaid: 150000,
        balance: 0,
        month: "Inscription",
        year: "2024-2025",
        method: "cash",
        status: "validated",
        validatedBy: "admin01",
        createdAt: "2024-09-01T10:00:00Z",
        currency: "XAF"
    },
    {
        id: "pay02",
        studentId: "student01",
        amountExpected: 50000,
        amountPaid: 0,
        balance: 50000,
        month: "Octobre",
        year: "2024-2025",
        method: "cash",
        status: "pending",
        createdAt: "2024-10-01T11:00:00Z",
        currency: "XAF"
    }
];

export const mockGrades: Grade[] = [
    {
        id: "grade01",
        studentId: "student01",
        courseId: "math01",
        type: 'devoir',
        score: 15,
        total: 20,
        coefficient: 1,
        academicYear: '2024-2025',
        createdAt: '2024-10-15T10:00:00Z',
    },
    {
        id: "grade02",
        studentId: "student01",
        courseId: "math01",
        type: 'examen',
        score: 14,
        total: 20,
        coefficient: 2,
        academicYear: '2024-2025',
        createdAt: '2024-12-10T10:00:00Z',
    },
     {
        id: "grade03",
        studentId: "student01",
        courseId: "phys01",
        type: 'examen',
        score: 16,
        total: 20,
        coefficient: 2,
        academicYear: '2024-2025',
        createdAt: '2024-12-12T10:00:00Z',
    }
];

export const mockSalaries: TeacherSalary[] = [];
export const mockCashTransactions: CashTransaction[] = [];
export const mockAttendances: Attendance[] = [];
export const mockAdminRoles: AdminRole[] = [];
export const mockDocuments: OfficialDocument[] = [];
