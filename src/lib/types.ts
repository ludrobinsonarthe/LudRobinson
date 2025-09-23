

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';
export type UserStatus = 'active' | 'suspended' | 'graduated';
export type Cycle = 'local' | 'international' | 'entrepreneur';

export const adminPermissions = {
  view_reporting: "Tableau de Bord",
  manage_students: "Étudiants",
  manage_teachers: "Professeurs",
  manage_course: "Gestion Cours & Horaires",
  manage_grades: "Gestion des notes",
  manage_tuition: "Scolarité",
  manage_fees: "Gestion des frais",
  manage_salaries: "Salaires",
  manage_attendance: "Suivi des Présences",
  manage_cash_flow: "Suivi de caisse",
  manage_users: "Personnel",
  manage_roles: "Rôles & Permissions",
  manage_admin_settings: "Administration",
};


export type AdminPermission = keyof typeof adminPermissions;

export interface AdminRole {
  id: string;
  name: string;
  permissions: AdminPermission[];
}

export interface User {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: 'M' | 'F';
  dob?: string; // Date of Birth
  pob?: string; // Place of Birth
  nationality?: string;
  address?: string;
  photoUrl: string;
  createdAt: string;
  status: UserStatus;
  admin?: {
    roleId: string;
    position?: string;
    baseSalary?: number;
  };
  student?: {
    matricule: string;
    programId: string;
    cycle?: Cycle;
    level?: string;
    fieldId?: string;
    enrollmentDate: string;
    endDate: string;
    parentUid?: string; // UID of the parent/guardian user
    parentalLink?: string;
    lastDiploma?: string;
  };
  teacher?: {
    specialty: string;
    assignedCourses: string[];
  };
  parent?: {
    childrenUids: string[]; // UIDs of their children
  }
}

export interface Program {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  responsible: string; // teacher_uid
}

export interface Class {
  id: string;
  programId: string;
  name: string;
  academicYear: string;
  students: string[]; // student_uids
  createdAt: string;
}

export interface Sector {
  id: string;
  name: string;
}

export interface Field {
  id: string;
  name: string;
  sectorId: string;
}

export interface FeeStructure {
    id: string; // e.g., local-licence_1
    cycle: Cycle;
    level: string;
    registration: number;
    tuition: number;
    currency: string;
}


export interface Course {
  id: string;
  name: string;
  description: string;
  teacherId: string; // teacher_uid
  fieldId: string;
  level: string;
  cycle: Cycle;
  credit: number;
  documents?: string[];
  schedule?: {
    day: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
    start: string; // "HH:MM"
    end: string; // "HH:MM"
    room: string;
  }[];
}

export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  type: 'devoir de classe' | 'devoir de recherche' | 'examen';
  score: number;
  coefficient: number;
  total: number;
  academicYear: string;
  createdAt: string;
  comment?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amountExpected: number;
  amountPaid: number;
  balance: number;
  month: string;
  year: string;
  method: 'mobile_money' | 'cash' | 'card';
  proofUrl?: string;
  status: 'pending' | 'validated' | 'rejected';
  validatedBy?: string; // admin_uid
  createdAt: string;
  currency: string;
}

export interface TeacherSalary {
  id: string;
  teacherId: string;
  month: string;
  year: string;
  hourlyRate: number;
  hoursWorked: number;
  totalSalary: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  paidBy?: string; // admin_uid
  createdAt: string;
  currency: string;
}

export interface CashTransaction {
    id: string;
    date: string;
    type: 'income' | 'expense';
    category: 'tuition' | 'salary' | 'equipment' | 'utilities' | 'session' | 'soutenance' | 'other';
    description: string;
    amount: number;
    currency: string;
    createdBy: string; // admin_uid
    relatedDocId?: string; // id of payment or salary doc
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string; // student_uid | class_ref | all | role_id | role_name
  title?: string;
  content: string;
  type: 'announcement' | 'private';
  attachments?: string[];
  createdAt: string;
}

export interface OfficialDocument {
  id: string;
  studentId: string;
  type: 'bulletin' | 'certificat' | 'diplôme';
  fileUrl: string;
  issuedBy: string; // admin_uid
  issuedAt: string;
}

export type StudentAttendanceStatus = 'present' | 'absent' | 'justified';

export interface StudentAttendance {
    studentId: string;
    status: StudentAttendanceStatus;
    comment?: string;
}

export interface Attendance {
    id: string; // YYYY-MM-DD-courseId
    date: string; // YYYY-MM-DD
    courseId: string;
    teacherId: string;
    teacherStatus: 'present' | 'absent';
    studentAttendances: StudentAttendance[];
    validatedBy: string; // admin_uid
    createdAt: string;
    updatedAt: string;
}

export interface Settings {
  id: 'system';
  schoolName: string;
  logoUrl: string;
  academicYear: string;
  currency: string;
  levels: { value: string }[];
  sectors: { id: string; name: string }[];
}

// Unified salary type for both teachers and admin staff
export interface UnifiedSalary {
  id: string;
  userId: string;
  userName: string;
  userRole: 'teacher' | 'admin';
  month: string;
  year: string;
  totalSalary: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  paidBy?: string;
  createdAt: string;
  currency: string;
  // Teacher specific
  hourlyRate?: number;
  hoursWorked?: number;
  // Admin specific
  baseSalary?: number;
}
