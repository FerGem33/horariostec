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

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error("No pudimos comunicarnos con el servidor.");
  return response.json() as Promise<T>;
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
    const response = await fetch(`${API_BASE_URL}/api/v1/teachers/${id}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "No pudimos guardar tu evaluación.");
    }
    return response.json() as Promise<{ created: boolean; evaluation_id: number }>;
  },
  voteComment: async (source: CommentVote["source"], commentId: number, voterId: string, vote: "like" | "dislike" | "remove") => {
    const response = await fetch(`${API_BASE_URL}/api/v1/comments/${source}/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voter_id: voterId, vote }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "No pudimos registrar tu voto.");
    }
    return response.json() as Promise<CommentVote>;
  },
};
