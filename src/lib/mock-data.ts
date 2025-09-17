

import type { User, Class, Message, OfficialDocument, Program, Course, Sector, Field, Payment, Attendance, TeacherSalary, CashTransaction, AdminRole, Grade, FeeStructure } from './types';
import { adminPermissions } from './types';

// This file is intentionally left empty to ensure all data is fetched from Firestore.

export const mockUsers: User[] = [];
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
export const mockAdminRoles: AdminRole[] = [];
export const mockDocuments: OfficialDocument[] = [];
export const mockFeeStructures: FeeStructure[] = [];
