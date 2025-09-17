

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field, Payment, Attendance, TeacherSalary, CashTransaction, AdminRole, Grade, FeeStructure } from './types';
import { adminPermissions } from './types';

// This file is now primarily for bootstrapping the Super Admin role and user if the database is empty.
// Most other mock data is no longer needed as the app is connected to Firestore.

export const mockUsers: User[] = [
    {
        uid: "admin01",
        role: "admin",
        firstName: "ISGI Admin",
        lastName: "User",
        email: "admin@isgi.com",
        photoUrl: "https://picsum.photos/seed/admin/100/100",
        createdAt: "2024-01-01T10:00:00Z",
        status: "active",
        admin: {
            roleId: "super_admin",
            position: "Super-Administrateur"
        }
    },
];

export const mockAdminRoles: AdminRole[] = [
    { 
        id: 'super_admin', 
        name: 'Super Admin', 
        permissions: Object.keys(adminPermissions) as (keyof typeof adminPermissions)[]
    },
    { 
        id: 'compta', 
        name: 'Comptable', 
        permissions: ['manage_tuition', 'manage_cash_flow', 'manage_fees', 'view_reporting']
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


// The following are empty as they are now fetched from Firestore.
export const mockPrograms: Program[] = [];
export const mockClasses: Class[] = [];
export const mockCourses: Course[] = [];
export const mockMessages: Message[] = [];
export const mockPayments: Payment[] = [];
export const mockGrades: Grade[] = [];
export const mockSalaries: TeacherSalary[] = [];
export const mockCashTransactions: CashTransaction[] = [];
export const mockAttendances: Attendance[] = [];
export const mockDocuments: OfficialDocument[] = [];
export const mockFeeStructures: FeeStructure[] = [];
