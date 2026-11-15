/**
 * Work & organizational experience (chronological order: past to present).
 * Every text field has `en` and `id` versions. `current: true` shows a "Now"
 * badge; `upcoming: true` an "Incoming" one, for something that hasn't started.
 */
export const experience = [
  {
    id: 'gdgoc-ub',
    role: { en: 'Member', id: 'Anggota' },
    org: 'Google Developer Groups on Campus · Brawijaya University',
    logo: '/images/logo-gdgoc.svg',
    start: { en: 'Oct 2024', id: 'Okt 2024' },
    end: { en: 'Present', id: 'Sekarang' },
    current: true,
    description: {
      en: "Google's developer community on campus. I take part in its learning sessions, workshops and other developer activities.",
      id: 'Komunitas developer Google di kampus. Saya ikut sesi belajar, workshop, dan kegiatan developer lainnya.',
    },
    tags: ['GDGoC', 'Developer Community', 'Workshops'],
  },
  {
    id: 'finance-bet',
    role: { en: 'Staff of Finance & Sponsorship', id: 'Staf Keuangan & Sponsorship' },
    org: 'Brawijaya English Tournament (BET) · FORMASI UB',
    logo: '/images/logo-formasi.webp',
    start: { en: 'May 2025', id: 'Mei 2025' },
    end: { en: 'Jun 2025', id: 'Jun 2025' },
    description: {
      en: "I'm a member of FORMASI, a student activity unit at Universitas Brawijaya, and worked on the finance and sponsorship committee of the Brawijaya English Tournament 2025. To fund the event I wrote sponsorship proposals, negotiated with companies and kept in touch with the sponsors.",
      id: 'Saya anggota FORMASI, salah satu unit aktivitas mahasiswa di Universitas Brawijaya, dan masuk panitia keuangan dan sponsorship Brawijaya English Tournament 2025. Untuk mendanai acaranya saya menyusun proposal sponsorship, bernegosiasi dengan perusahaan, dan menjaga komunikasi dengan sponsor.',
    },
    tags: ['UKM FORMASI UB', 'Finance & Sponsorship', 'Negotiation', 'Partnerships'],
  },
  {
    id: 'qc-pkkmb',
    role: { en: 'Staff of Quality Control', id: 'Staf Quality Control' },
    org: 'PKKMB & Startup Academy · SGE FILKOM UB 2025',
    logo: '/images/logo-sge.webp',
    start: { en: 'Aug 2025', id: 'Agu 2025' },
    end: { en: 'Jan 2026', id: 'Jan 2026' },
    description: {
      en: 'Quality control for PKKMB & Startup Academy 2025 under SGE (Student Graduation & Empowerment) FILKOM UB. I checked the event materials, the administrative documents and how the event was run, so they stayed consistent with each other.',
      id: 'Quality control untuk PKKMB & Startup Academy 2025 di bawah SGE (Student Graduation & Empowerment) FILKOM UB. Saya memeriksa materi acara, dokumen administrasi, dan jalannya acara supaya semuanya tetap konsisten.',
    },
    tags: ['SGE FILKOM 2025', 'Quality Control', 'Event Management', 'Evaluation'],
  },
  {
    id: 'is-lab-resident',
    role: { en: 'Laboratory Resident & Project Collaborator', id: 'Resident Laboratorium & Kolaborator Proyek' },
    org: 'Intelligent System Laboratory · FILKOM UB',
    logo: '/images/logo-is-lab.webp',
    start: { en: 'Feb 2026', id: 'Feb 2026' },
    end: { en: 'Present', id: 'Sekarang' },
    current: true,
    description: {
      en: 'A resident of the Intelligent System Laboratory. The lab is where my teaching assistant roles come from, and where I work with lecturers on research and applied AI and data science projects.',
      id: 'Resident di Intelligent System Laboratory. Dari lab ini saya ditugaskan jadi asisten praktikum, dan di sini saya ikut mengerjakan proyek riset serta terapan AI dan data science bersama dosen.',
    },
    tags: ['Intelligent Systems', 'AI/ML Projects', 'Faculty Collaboration', 'Lab Research'],
  },
  {
    id: 'ta-advanced-programming',
    role: { en: 'Teaching Assistant', id: 'Asisten Praktikum' },
    org: 'Advanced Programming · Intelligent System Lab, FILKOM UB',
    logo: '/images/logo-is-lab.webp',
    start: { en: 'Feb 2026', id: 'Feb 2026' },
    end: { en: 'Jun 2026', id: 'Jun 2026' },
    description: {
      en: 'Taught the Advanced Programming practical sessions for 41 students. I explained object-oriented programming in Java, helped them debug their code and graded their coding exercises.',
      id: 'Mengajar praktikum Pemrograman Lanjut untuk 41 mahasiswa. Saya menjelaskan OOP dengan Java, membantu mereka men-debug kodenya, dan menilai latihan pemrogramannya.',
    },
    tags: ['Java', 'OOP', 'Debugging', 'Teaching Assistant'],
  },
  {
    id: 'ta-international',
    role: { en: 'Teaching Assistant (International Class)', id: 'Asisten Praktikum (Kelas Internasional)' },
    org: 'Information Systems Engineering · Intelligent System Lab, FILKOM UB',
    logo: '/images/logo-is-lab.webp',
    start: { en: 'Jul 2026', id: 'Jul 2026' },
    end: { en: 'Present', id: 'Sekarang' },
    current: true,
    description: {
      en: 'Practical sessions for 8 international-class students, taught entirely in English. I walk them through BPMN workflows and the basics of web development with PHP, and supervise their lab exercises.',
      id: 'Praktikum untuk 8 mahasiswa kelas internasional, sepenuhnya dalam bahasa Inggris. Saya memandu mereka memahami alur kerja BPMN dan dasar web development dengan PHP, serta mendampingi latihan praktikumnya.',
    },
    tags: ['English', 'BPMN', 'PHP', 'Teaching Assistant'],
  },
  {
    id: 'telkom-pkl',
    role: { en: 'Intern', id: 'Magang (PKL)' },
    org: 'PT Telkom Indonesia (Persero) Tbk · Witel Riau, Pekanbaru',
    logo: '/images/logo-telkom.webp',
    start: { en: 'Jan 2027', id: 'Jan 2027' },
    end: { en: 'Mar 2027', id: 'Mar 2027' },
    upcoming: true,
    description: {
      en: "A two-month internship (Praktik Kerja Lapangan) in the Shared Service & General Support unit of Telkom's Riau regional office, working on site in Pekanbaru. The focus is applying data analytics and AI to telecom operations; the project will be set once it starts.",
      id: 'Magang (Praktik Kerja Lapangan) selama dua bulan di unit Shared Service & General Support, Telkom Witel Riau, di kantor Pekanbaru. Fokusnya penerapan data analytics dan AI pada operasional telekomunikasi; proyeknya ditentukan setelah magang dimulai.',
    },
    tags: ['Telkom Indonesia', 'Data Analytics', 'AI', 'Internship'],
  },
]
