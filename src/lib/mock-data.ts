

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


