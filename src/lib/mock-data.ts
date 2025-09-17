

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
    {
        "uid": "nadine_mvemba",
        "role": "student",
        "firstName": "Nadine",
        "lastName": "Mvemba",
        "email": "nadine.mvemba@isgi.com",
        "photoUrl": "https://picsum.photos/seed/nadine/100/100",
        "createdAt": "2024-09-01T09:00:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-001",
            "programId": "prog01",
            "level": "Licence 3",
            "cycle": "local",
            "fieldId": "grhae",
            "enrollmentDate": "2024-09-01T09:00:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "cynthia_ngoma",
        "role": "student",
        "firstName": "Cynthia",
        "lastName": "Ngoma",
        "email": "cynthia.ngoma@isgi.com",
        "photoUrl": "https://picsum.photos/seed/cynthia_n/100/100",
        "createdAt": "2024-09-01T09:01:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-002",
            "programId": "prog01",
            "level": "Licence 3",
            "cycle": "local",
            "fieldId": "eli",
            "enrollmentDate": "2024-09-01T09:01:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "esther_okoko",
        "role": "student",
        "firstName": "Esther",
        "lastName": "Okoko",
        "email": "esther.okoko@isgi.com",
        "photoUrl": "https://picsum.photos/seed/esther/100/100",
        "createdAt": "2024-09-01T09:02:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-003",
            "programId": "prog01",
            "level": "Licence 1",
            "cycle": "local",
            "fieldId": "mce",
            "enrollmentDate": "2024-09-01T09:02:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "sarah_mayala",
        "role": "student",
        "firstName": "Sarah",
        "lastName": "Mayala",
        "email": "sarah.mayala@isgi.com",
        "photoUrl": "https://picsum.photos/seed/sarah_m/100/100",
        "createdAt": "2024-09-01T09:03:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-004",
            "programId": "prog01",
            "level": "Licence 2",
            "cycle": "local",
            "fieldId": "eli",
            "enrollmentDate": "2024-09-01T09:03:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "samuel_matondo",
        "role": "student",
        "firstName": "Samuel",
        "lastName": "Matondo",
        "email": "samuel.matondo@isgi.com",
        "photoUrl": "https://picsum.photos/seed/samuel_m/100/100",
        "createdAt": "2024-09-01T09:04:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-005",
            "programId": "prog01",
            "level": "Licence 3",
            "cycle": "local",
            "fieldId": "lt",
            "enrollmentDate": "2024-09-01T09:04:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "cynthia_mayala",
        "role": "student",
        "firstName": "Cynthia",
        "lastName": "Mayala",
        "email": "cynthia.mayala@isgi.com",
        "photoUrl": "https://picsum.photos/seed/cynthia_m/100/100",
        "createdAt": "2024-09-01T09:05:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-006",
            "programId": "prog01",
            "level": "Licence 2",
            "cycle": "local",
            "fieldId": "gf",
            "enrollmentDate": "2024-09-01T09:05:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "sarah_ebina",
        "role": "student",
        "firstName": "Sarah",
        "lastName": "Ebina",
        "email": "sarah.ebina@isgi.com",
        "photoUrl": "https://picsum.photos/seed/sarah_e/100/100",
        "createdAt": "2024-09-01T09:06:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-007",
            "programId": "prog01",
            "level": "Licence 3",
            "cycle": "local",
            "fieldId": "lt",
            "enrollmentDate": "2024-09-01T09:06:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "patrick_bissila",
        "role": "student",
        "firstName": "Patrick",
        "lastName": "Bissila",
        "email": "patrick.bissila@isgi.com",
        "photoUrl": "https://picsum.photos/seed/patrick/100/100",
        "createdAt": "2024-09-01T09:07:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-008",
            "programId": "prog01",
            "level": "Master 2",
            "cycle": "local",
            "fieldId": "lt",
            "enrollmentDate": "2024-09-01T09:07:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "kevin_ondongo",
        "role": "student",
        "firstName": "Kevin",
        "lastName": "Ondongo",
        "email": "kevin.ondongo@isgi.com",
        "photoUrl": "https://picsum.photos/seed/kevin/100/100",
        "createdAt": "2024-09-01T09:08:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-009",
            "programId": "prog01",
            "level": "Master 2",
            "cycle": "local",
            "fieldId": "gf",
            "enrollmentDate": "2024-09-01T09:08:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    },
    {
        "uid": "samuel_kanza",
        "role": "student",
        "firstName": "Samuel",
        "lastName": "Kanza",
        "email": "samuel.kanza@isgi.com",
        "photoUrl": "https://picsum.photos/seed/samuel_k/100/100",
        "createdAt": "2024-09-01T09:09:00Z",
        "status": "active",
        "student": {
            "matricule": "ISGI2025-010",
            "programId": "prog01",
            "level": "Master 1",
            "cycle": "local",
            "fieldId": "lt",
            "enrollmentDate": "2024-09-01T09:09:00Z",
            "endDate": "2025-07-01T09:00:00Z"
        }
    }
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

    