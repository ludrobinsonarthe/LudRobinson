

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field, Payment, Attendance, TeacherSalary, CashTransaction, AdminRole, Grade, FeeStructure } from './types';
import { adminPermissions } from './types';

// We are now using a mix of mock data for initial setup and live data from Firestore.
// The Super Admin is defined here to ensure access is always available.

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


export const mockSectors: Sector[] = [];
export const mockFields: Field[] = [];
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
