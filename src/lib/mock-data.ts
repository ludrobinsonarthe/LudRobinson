

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field, Payment, Attendance, TeacherSalary, CashTransaction, AdminRole, Grade, FeeStructure } from './types';

// Mock data is now being used as the primary source until Firestore rules are configured.

export const mockUsers: User[] = [
    {
        uid: "admin01",
        role: "admin",
        firstName: "sem franslin",
        lastName: "Bourangon",
        email: "sem.bourangon@isgi.com",
        photoUrl: "https://picsum.photos/seed/admin/100/100",
        createdAt: "2024-01-01T10:00:00Z",
        status: "active",
        admin: {
            roleId: "super_admin",
            position: "Super-Administrateur"
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
    students: [],
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
        credit: 5
    },
    {
        id: "phys01",
        name: "Physique Générale",
        description: "Cours de Licence 1",
        teacherId: "teacher01",
        fieldId: "gl",
        level: "Licence 1",
        cycle: "local",
        credit: 4
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
  }
];

export const mockPayments: Payment[] = [];

export const mockGrades: Grade[] = [];

export const mockSalaries: TeacherSalary[] = [];
export const mockCashTransactions: CashTransaction[] = [];
export const mockAttendances: Attendance[] = [];
export const mockAdminRoles: AdminRole[] = [
    { id: 'super_admin', name: 'Super Admin', permissions: []},
    { id: 'compta', name: 'Comptable', permissions: ['manage_tuition', 'manage_cash_flow']}
];
export const mockDocuments: OfficialDocument[] = [];
export const mockFeeStructures: FeeStructure[] = [
    { id: 'local-licence_1', cycle: 'local', level: 'Licence 1', registration: 150000, tuition: 500000, currency: 'XAF'},
    { id: 'local-licence_2', cycle: 'local', level: 'Licence 2', registration: 100000, tuition: 500000, currency: 'XAF'},
]

