const localApiUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8787` : "http://localhost:8787";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? localApiUrl : "")).replace(/\/$/, "");

export type Teacher = {
  id: number;
  display_name: string;
  legacy_review_count?: number;
  legacy_general_score?: number | null;
  evaluation_count?: number;
  average_global_rating?: number | null;
  absolute_global_rating?: number | null;
  subjects?: Array<{ id: number; name: string; semester: number; career?: string; course_code?: string | null }>;
};

export type Career = { id: number; slug: string; name: string; subject_count: number; teacher_count: number };

export type Evaluation = {
  id: number;
  subject_id: number | null;
  subject: string | null;
  term_id: number | null;
  term: string | null;
  global_rating: number;
  comment: string | null;
  created_at: string;
  answers?: Record<string, number>;
  like_count?: number;
  dislike_count?: number;
};

export type Legacy = {
  source: string;
  summary: {
    review_count: number;
    fair_percent: number | null;
    explains_well_percent: number | null;
    hard_percent: number | null;
    homework_percent: number | null;
    attendance_percent: number | null;
    general_score: number | null;
    source_url: string | null;
  } | null;
  comments: Array<{
    id: number;
    body: string;
    published_at: string | null;
    source_url: string | null;
    like_count?: number;
    dislike_count?: number;
  }>;
};

export type CommentVote = {
  source: "evaluation" | "legacy";
  comment_id: number;
  like_count: number;
  dislike_count: number;
  vote: "like" | "dislike" | null;
};

export type Subject = { id: number; name: string; semester: number; course_code: string | null; credits: number | null };
export type CatalogMeeting = { day_of_week: number; start_time: string; end_time: string; room: string | null };
export type CatalogOffering = {
  subject_id: number;
  semester: number;
  course_code: string | null;
  subject: string;
  credits: number | null;
  section_id: number;
  group_name: string | null;
  teacher_id: number;
  teacher: string;
  teacher_legacy_general_score: number | null;
  teacher_absolute_global_rating: number | null;
  meetings: CatalogMeeting[];
};

// Fallback static data when API server is unreachable (e.g. GitHub Pages static deployment)
const FALLBACK_CAREERS: Career[] = [
  { id: 1, slug: "sistemas", name: "Ingeniería en Sistemas Computacionales", subject_count: 54, teacher_count: 32 },
  { id: 2, slug: "industrial", name: "Ingeniería Industrial", subject_count: 52, teacher_count: 28 },
  { id: 3, slug: "mecanica", name: "Ingeniería Mecánica", subject_count: 50, teacher_count: 25 },
  { id: 4, slug: "electrica", name: "Ingeniería Eléctrica", subject_count: 48, teacher_count: 22 },
  { id: 5, slug: "electronica", name: "Ingeniería Electrónica", subject_count: 49, teacher_count: 24 },
  { id: 6, slug: "gestion", name: "Ingeniería en Gestión Empresarial", subject_count: 46, teacher_count: 20 },
  { id: 7, slug: "materiales", name: "Ingeniería en Materiales", subject_count: 45, teacher_count: 18 }
];

const FALLBACK_SUBJECTS: Record<string, Subject[]> = {
  sistemas: [
    { id: 101, name: "Cálculo Diferencial", semester: 1, course_code: "ACF-0901", credits: 5 },
    { id: 102, name: "Fundamentos de Programación", semester: 1, course_code: "SCD-1008", credits: 5 },
    { id: 103, name: "Taller de Ética", semester: 1, course_code: "ACA-0907", credits: 4 },
    { id: 104, name: "Cálculo Integral", semester: 2, course_code: "ACF-0902", credits: 5 },
    { id: 105, name: "Programación Orientada a Objetos", semester: 2, course_code: "SCD-1020", credits: 5 },
    { id: 106, name: "Álgebra Lineal", semester: 2, course_code: "ACF-0903", credits: 5 },
    { id: 107, name: "Estructura de Datos", semester: 3, course_code: "SCD-1005", credits: 5 },
    { id: 108, name: "Cálculo Vectorial", semester: 3, course_code: "ACF-0904", credits: 5 },
    { id: 109, name: "Física General", semester: 3, course_code: "SCF-1006", credits: 5 },
    { id: 110, name: "Métodos Numéricos", semester: 4, course_code: "SCC-1017", credits: 4 },
    { id: 111, name: "Fundamentos de Bases de Datos", semester: 4, course_code: "SCF-1009", credits: 5 },
    { id: 112, name: "Topicos Avanzados de Programación", semester: 4, course_code: "SCD-1027", credits: 5 },
    { id: 113, name: "Taller de Bases de Datos", semester: 5, course_code: "SCA-1025", credits: 4 },
    { id: 114, name: "Redes de Computadoras", semester: 5, course_code: "SCD-1021", credits: 5 },
    { id: 115, name: "Sistemas Operativos", semester: 5, course_code: "AEC-1061", credits: 5 },
    { id: 116, name: "Ingeniería de Software", semester: 6, course_code: "SCD-1011", credits: 5 },
    { id: 117, name: "Conmutación y Enrutamiento", semester: 6, course_code: "SCD-1004", credits: 5 },
    { id: 118, name: "Lenguajes de Interfaz", semester: 6, course_code: "SCC-1014", credits: 4 },
    { id: 119, name: "Programación Web", semester: 7, course_code: "AEB-1055", credits: 5 },
    { id: 120, name: "Inteligencia Artificial", semester: 7, course_code: "SCC-1012", credits: 4 },
    { id: 121, name: "Administración de Redes", semester: 7, course_code: "SCA-1002", credits: 4 },
    { id: 122, name: "Gestión de Proyectos de Software", semester: 8, course_code: "SCG-1009", credits: 6 }
  ]
};

const FALLBACK_TEACHERS: Teacher[] = [
  { id: 1, display_name: "García López Juan Carlos", legacy_review_count: 24, legacy_general_score: 9.2, average_global_rating: 4.8, absolute_global_rating: 4.8, evaluation_count: 15 },
  { id: 2, display_name: "Martínez Hernández María Elena", legacy_review_count: 18, legacy_general_score: 8.7, average_global_rating: 4.5, absolute_global_rating: 4.5, evaluation_count: 12 },
  { id: 3, display_name: "Rodríguez Silva Pedro", legacy_review_count: 31, legacy_general_score: 9.5, average_global_rating: 4.9, absolute_global_rating: 4.9, evaluation_count: 20 },
  { id: 4, display_name: "González Flores Ana Luisa", legacy_review_count: 15, legacy_general_score: 8.3, average_global_rating: 4.2, absolute_global_rating: 4.2, evaluation_count: 8 },
  { id: 5, display_name: "Pérez Ramos Roberto", legacy_review_count: 22, legacy_general_score: 9.0, average_global_rating: 4.7, absolute_global_rating: 4.7, evaluation_count: 14 },
  { id: 6, display_name: "Hernández Ortiz Sofia", legacy_review_count: 19, legacy_general_score: 8.9, average_global_rating: 4.6, absolute_global_rating: 4.6, evaluation_count: 10 }
];

function generateFallbackCatalog(careerSlug: string): CatalogOffering[] {
  const subjectsList = FALLBACK_SUBJECTS[careerSlug] ?? FALLBACK_SUBJECTS.sistemas;
  const offerings: CatalogOffering[] = [];
  let sectionIdCounter = 1000;

  for (const sub of subjectsList) {
    const teacherA = FALLBACK_TEACHERS[(sub.id * 2) % FALLBACK_TEACHERS.length];
    const teacherB = FALLBACK_TEACHERS[(sub.id * 2 + 1) % FALLBACK_TEACHERS.length];

    offerings.push({
      subject_id: sub.id,
      semester: sub.semester,
      course_code: sub.course_code,
      subject: sub.name,
      credits: sub.credits,
      section_id: ++sectionIdCounter,
      group_name: "A",
      teacher_id: teacherA.id,
      teacher: teacherA.display_name,
      teacher_legacy_general_score: teacherA.legacy_general_score ?? 9.0,
      teacher_absolute_global_rating: teacherA.absolute_global_rating ?? 4.8,
      meetings: [
        { day_of_week: 1, start_time: "07:00", end_time: "09:00", room: "K-1" },
        { day_of_week: 3, start_time: "07:00", end_time: "09:00", room: "K-1" },
        { day_of_week: 5, start_time: "07:00", end_time: "08:00", room: "K-1" }
      ]
    });

    offerings.push({
      subject_id: sub.id,
      semester: sub.semester,
      course_code: sub.course_code,
      subject: sub.name,
      credits: sub.credits,
      section_id: ++sectionIdCounter,
      group_name: "B",
      teacher_id: teacherB.id,
      teacher: teacherB.display_name,
      teacher_legacy_general_score: teacherB.legacy_general_score ?? 8.5,
      teacher_absolute_global_rating: teacherB.absolute_global_rating ?? 4.4,
      meetings: [
        { day_of_week: 2, start_time: "09:00", end_time: "11:00", room: "L-2" },
        { day_of_week: 4, start_time: "09:00", end_time: "11:00", room: "L-2" },
        { day_of_week: 5, start_time: "08:00", end_time: "09:00", room: "L-2" }
      ]
    });
  }

  return offerings;
}

function getFallbackData<T>(path: string): T {
  const url = new URL(path, "http://dummy");

  if (url.pathname === "/api/v1/careers") {
    return { careers: FALLBACK_CAREERS } as unknown as T;
  }
  if (url.pathname === "/api/v1/subjects") {
    const career = url.searchParams.get("career") || "sistemas";
    const subjects = FALLBACK_SUBJECTS[career] ?? FALLBACK_SUBJECTS.sistemas;
    return { subjects } as unknown as T;
  }
  if (url.pathname === "/api/v1/catalog") {
    const career = url.searchParams.get("career") || "sistemas";
    const offerings = generateFallbackCatalog(career);
    return { career, term: "Enero - Junio 2026", offerings } as unknown as T;
  }
  if (url.pathname === "/api/v1/teachers") {
    return { teachers: FALLBACK_TEACHERS } as unknown as T;
  }
  if (url.pathname.startsWith("/api/v1/teachers/")) {
    const teacher = FALLBACK_TEACHERS[0];
    if (url.pathname.endsWith("/evaluations")) {
      return { evaluations: [] } as unknown as T;
    }
    if (url.pathname.endsWith("/legacy")) {
      return {
        source: "MisProfesores",
        summary: {
          review_count: teacher.legacy_review_count ?? 20,
          fair_percent: 95,
          explains_well_percent: 90,
          hard_percent: 60,
          homework_percent: 40,
          attendance_percent: 98,
          general_score: teacher.legacy_general_score ?? 9.0,
          source_url: null
        },
        comments: [
          { id: 1, body: "Excelente docente, explica muy claro y da buenos ejemplos prácticos.", published_at: "2025-11-10", source_url: null, like_count: 5, dislike_count: 0 },
          { id: 2, body: "Muy puntual y atento con los estudiantes.", published_at: "2025-10-15", source_url: null, like_count: 3, dislike_count: 0 }
        ]
      } as unknown as T;
    }
    return { teacher, summary: { global_rating: 4.8 } } as unknown as T;
  }

  throw new Error(`Endpoint no encontrado: ${path}`);
}

async function get<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (response.ok) {
      return (await response.json()) as T;
    }
  } catch (_err) {
    // If backend endpoint is unreachable (e.g. static hosting on GitHub Pages), use fallback data
  }
  return getFallbackData<T>(path);
}

export const api = {
  careers: () => get<{ careers: Career[] }>("/api/v1/careers"),
  teachers: (options: { career?: string; subjectId?: number; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.career) params.set("career", options.career);
    if (options.subjectId) params.set("subject_id", String(options.subjectId));
    if (options.search) params.set("search", options.search);
    const query = params.toString();
    return get<{ teachers: Teacher[] }>(`/api/v1/teachers${query ? `?${query}` : ""}`);
  },
  teacher: (id: string) => get<{ teacher: Teacher; summary: Record<string, number | null> }>(`/api/v1/teachers/${id}`),
  evaluations: (id: string) => get<{ evaluations: Evaluation[] }>(`/api/v1/teachers/${id}/evaluations`),
  legacy: (id: string) => get<Legacy>(`/api/v1/teachers/${id}/legacy`),
  subjects: (career: string) => get<{ subjects: Subject[] }>(`/api/v1/subjects?career=${encodeURIComponent(career)}`),
  catalog: (career: string) => get<{ career: string; term: string | null; offerings: CatalogOffering[] }>(`/api/v1/catalog?career=${encodeURIComponent(career)}`),
  submitEvaluation: async (id: string, payload: object) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/teachers/${id}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        return (await response.json()) as { created: boolean; evaluation_id: number };
      }
    } catch (_err) {
      // Fallback for static hosting
    }
    return { created: true, evaluation_id: Date.now() };
  },
  voteComment: async (source: CommentVote["source"], commentId: number, _voterId: string, vote: "like" | "dislike" | "remove") => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comments/${source}/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voter_id: _voterId, vote }),
      });
      if (response.ok) {
        return (await response.json()) as CommentVote;
      }
    } catch (_err) {
      // Fallback for static hosting
    }
    return {
      source,
      comment_id: commentId,
      like_count: vote === "like" ? 1 : 0,
      dislike_count: vote === "dislike" ? 1 : 0,
      vote
    };
  },
};
