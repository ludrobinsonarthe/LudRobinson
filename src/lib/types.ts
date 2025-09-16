
export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';
export type UserStatus = 'active' | 'suspended' | 'graduated';

export interface User {
  uid: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: 'M' | 'F';
  dob?: string;
  address?: string;
  photoUrl: string;
  createdAt: string;
  status: UserStatus;
  student?: {
    matricule: string;
    programId: string;
    classId: string;
    level?: string;
    fieldId?: string;
    enrollmentDate: string;
    endDate: string;
    parentUid?: string; // UID of the parent/guardian user
    parentalLink?: string;
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


export interface Course {
  id: string;
  name: string;
  description: string;
  teacherId: string; // teacher_uid
  classId: string;
  programId: string;
  documents?: string[];
  schedule?: {
    day: string;
    start: string;
    end: string;
    room: string;
  }[];
}

export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  type: 'devoir' | 'examen';
  score: number;
  coefficient: number;
  total: number;
  academicYear: string;
  createdAt: string;
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
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string; // student_uid | class_ref | all
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

export interface Settings {
  id: 'system';
  schoolName: string;
  logoUrl: string;
  academicYear: string;
  currency: string;
  adminContacts: string[];
}

    