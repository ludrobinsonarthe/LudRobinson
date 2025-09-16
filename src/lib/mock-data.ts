import type { User, Class, Message, OfficialDocument, Program, Course } from './types';

export const mockUsers: User[] = [
  {
    uid: 'admin01',
    role: 'admin',
    firstName: 'Admin',
    lastName: 'Principal',
    email: 'admin@eschool.com',
    photoUrl: 'https://picsum.photos/seed/admin/100/100',
    createdAt: new Date().toISOString(),
    status: 'active',
  },
  {
    uid: 'teacher01',
    role: 'teacher',
    firstName: 'Marie',
    lastName: 'Curie',
    email: 'marie.curie@eschool.com',
    photoUrl: 'https://picsum.photos/seed/teacher/100/100',
    createdAt: new Date().toISOString(),
    status: 'active',
    teacher: {
      specialty: 'Mathématiques',
      assignedCourses: ['math01'],
    },
  },
  {
    uid: 'student01',
    role: 'student',
    firstName: 'Alice',
    lastName: 'Dubois',
    email: 'alice.dubois@eschool.com',
    photoUrl: 'https://picsum.photos/seed/student1/100/100',
    createdAt: new Date().toISOString(),
    status: 'active',
    student: {
      matricule: 'ISGI-2025-ANG-001',
      programId: 'prog01',
      classId: 'class01',
      enrollmentDate: '2025-09-01',
      endDate: '2026-07-30',
    },
  },
  {
    uid: 'student02',
    role: 'student',
    firstName: 'Bob',
    lastName: 'Martin',
    email: 'bob.martin@eschool.com',
    photoUrl: 'https://picsum.photos/seed/student2/100/100',
    createdAt: new Date().toISOString(),
    status: 'active',
    student: {
      matricule: 'ISGI-2025-ANG-002',
      programId: 'prog01',
      classId: 'class01',
      enrollmentDate: '2025-09-01',
      endDate: '2026-07-30',
    },
  },
  {
    uid: 'parent01',
    role: 'parent',
    firstName: 'Claire',
    lastName: 'Dubois',
    email: 'claire.dubois@email.com',
    photoUrl: 'https://picsum.photos/seed/parent/100/100',
    createdAt: new Date().toISOString(),
    status: 'active',
  },
];

export const mockPrograms: Program[] = [
    {
        id: "prog01",
        name: "Informatique",
        description: "Filière Informatique Générale",
        createdAt: new Date().toISOString(),
        responsible: "teacher01"
    }
]

export const mockClasses: Class[] = [
  {
    id: 'class01',
    programId: 'prog01',
    name: 'Terminale C',
    academicYear: '2025-2026',
    students: ['student01', 'student02'],
    createdAt: new Date().toISOString(),
  },
];

export const mockCourses: Course[] = [
    {
        id: "math01",
        name: "Mathématiques",
        description: "Cours de Terminale C",
        teacherId: "teacher01",
        classId: "class01",
        programId: "prog01",
    }
]

export const mockMessages: Message[] = [
  {
    id: 'msg01',
    senderId: 'admin01',
    receiverId: 'all',
    content: 'Bienvenue à l\'année scolaire 2025-2026! Nous sommes ravis de vous accueillir.',
    type: 'announcement',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg02',
    senderId: 'admin01',
    receiverId: 'class01',
    content: 'Rappel : La réunion parents-professeurs pour la classe de Terminale C aura lieu ce vendredi.',
    type: 'announcement',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    attachments: ['https://example.com/ordre_du_jour.pdf'],
  },
  {
    id: 'msg03',
    senderId: 'teacher01',
    receiverId: 'student01',
    content: 'Bonjour Alice, n\'oublie pas de rendre ton devoir de mathématiques avant demain soir.',
    type: 'private',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg04',
    senderId: 'student01',
    receiverId: 'teacher01',
    content: 'Bonjour Mme. Curie, j\'ai une question concernant l\'exercice 5. Pouvez-vous m\'éclairer sur la méthode à utiliser ?',
    type: 'private',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg05',
    senderId: 'teacher01',
    receiverId: 'student01',
    content: 'Bien sûr, Alice. Pense à utiliser le théorème de Pythagore. C\'est un problème plus complexe qu\'il n\'y paraît. Il faut décomposer le problème en plusieurs étapes. La première étape consiste à identifier les triangles rectangles dans la figure. Ensuite, pour chaque triangle, applique le théorème. Fais attention aux unités, elles doivent être cohérentes. Si tu as d\'autres questions, n\'hésite pas à venir me voir après le cours. Nous pourrons regarder ça ensemble. Bon courage!',
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
