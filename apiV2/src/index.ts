type Env = {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
};

type Row = Record<string, any>;

const MAX_COMMENT_LENGTH = 1_000;
const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const VOTER_PATTERN = /^[a-zA-Z0-9:_-]{16,128}$/;
const ANSWER_KEYS = new Set([
  "attendance_weight",
  "assignments_weight",
  "exams_weight",
  "projects_weight",
  "fairness",
  "explains",
  "attitude",
  "accessibility",
  "difficulty",
]);

function configuredOrigins(value: string | undefined): Set<string> {
  const origins = new Set(
    (value ?? "*")
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
  return origins.size ? origins : new Set(["*"]);
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(data: unknown, origin: string, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders(origin) });
}

function positiveId(value: unknown, field: string): number {
  if (typeof value === "boolean" || value === null || value === undefined || value === "") {
    throw new Error(`${field} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function validateSlug(value: string): string {
  if (!NAME_PATTERN.test(value)) throw new Error("invalid identifier");
  return value;
}

function validateGlobalRating(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("global_rating must be an integer between 0 and 100");
  }
  return value;
}

function validateAnswers(value: unknown): Record<string, number> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("answers must be an object");

  const answers: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!ANSWER_KEYS.has(key)) throw new Error(`unknown answer: ${key}`);
    if (rawValue === null || rawValue === undefined) continue;
    if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
      throw new Error(`answer ${key} must be an integer`);
    }
    const maximum = key.endsWith("_weight") ? 100 : 5;
    const minimum = key.endsWith("_weight") ? 0 : 1;
    if (rawValue < minimum || rawValue > maximum) {
      throw new Error(`answer ${key} must be between ${minimum} and ${maximum}`);
    }
    answers[key] = rawValue;
  }
  return answers;
}

function validateComment(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("comment must be a string");
  const comment = value.trim();
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`comment must be at most ${MAX_COMMENT_LENGTH} characters`);
  }
  return comment || null;
}

function validateVoterKey(value: unknown): string {
  if (typeof value !== "string" || !VOTER_PATTERN.test(value)) {
    throw new Error("voter_id must be a valid anonymous identifier");
  }
  return value;
}

function validateVote(value: unknown): "like" | "dislike" | "remove" {
  if (value !== "like" && value !== "dislike" && value !== "remove") {
    throw new Error("vote must be like, dislike, or remove");
  }
  return value;
}

function weightedGlobalRating(
  currentAverage: unknown,
  currentCount: unknown,
  legacyAverage: unknown,
  legacyCount: unknown,
): number | null {
  const sources: Array<[number, number]> = [];
  for (const [average, count] of [[currentAverage, currentCount], [legacyAverage, legacyCount]]) {
    if (average !== null && average !== undefined && Number(average) >= 0 && count !== null && count !== undefined && Number(count) > 0) {
      sources.push([Number(average), Number(count)]);
    }
  }
  const total = sources.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return null;
  return Math.round((sources.reduce((sum, [average, count]) => sum + average * count, 0) / total) * 100) / 100;
}

function originFor(request: Request, env: Env): { origin: string; allowed: boolean } {
  const origins = configuredOrigins(env.ALLOWED_ORIGINS);
  const requestOrigin = request.headers.get("Origin");
  const normalized = requestOrigin?.replace(/\/$/, "") ?? null;
  const fallback = [...origins].find((origin) => origin !== "*") ?? "*";
  return {
    origin: requestOrigin ?? fallback,
    allowed: origins.has("*") || (normalized !== null && origins.has(normalized)),
  };
}

async function terms(env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare("SELECT id, code, name, is_active FROM terms ORDER BY is_active DESC, id DESC").all<Row>();
  return jsonResponse({ terms: result.results }, origin);
}

async function careers(env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT c.id, c.slug, c.name,
           COUNT(DISTINCT s.id) AS subject_count,
           COUNT(DISTINCT sec.teacher_id) AS teacher_count
    FROM careers c
    LEFT JOIN subjects s ON s.career_id = c.id
    LEFT JOIN sections sec ON sec.career_id = c.id
    GROUP BY c.id, c.slug, c.name
    ORDER BY c.name`).all<Row>();
  return jsonResponse({ careers: result.results }, origin);
}

async function teachers(request: Request, env: Env, origin: string): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const career = query.has("career") ? validateSlug(query.get("career")!) : null;
  const subjectId = query.has("subject_id") ? positiveId(query.get("subject_id"), "subject_id") : null;
  const searchValue = query.get("search");
  const search = searchValue === null ? null : searchValue.trim();
  if (search !== null && search.length > 80) throw new Error("search must be at most 80 characters");
  const pattern = search ? `%${search.toLowerCase()}%` : null;
  const result = await env.DB.prepare(`
    SELECT t.id, t.display_name,
           COALESCE(ls.review_count, 0) AS legacy_review_count,
           ls.general_score AS legacy_general_score,
           COALESCE(current.evaluation_count, 0) AS evaluation_count,
           current.average_global_rating,
           CASE
             WHEN current.average_global_rating >= 0 AND ls.general_score >= 0
               THEN ROUND((current.average_global_rating * current.evaluation_count + ls.general_score * ls.review_count) / (current.evaluation_count + ls.review_count), 2)
             WHEN current.average_global_rating >= 0 THEN current.average_global_rating
             WHEN ls.general_score >= 0 THEN ls.general_score
             ELSE NULL
           END AS absolute_global_rating,
           s.id AS subject_id, s.code AS course_code, s.name AS subject,
           s.semester AS subject_semester
    FROM teachers t
    LEFT JOIN legacy_teacher_summaries ls ON ls.teacher_id = t.id
    LEFT JOIN (
      SELECT teacher_id, COUNT(*) AS evaluation_count,
             ROUND(AVG(global_rating), 2) AS average_global_rating
      FROM teacher_evaluations WHERE status = 'visible'
      GROUP BY teacher_id
    ) current ON current.teacher_id = t.id
    LEFT JOIN sections sec ON sec.teacher_id = t.id
    LEFT JOIN subjects s ON s.id = sec.subject_id
    LEFT JOIN careers c ON c.id = sec.career_id
    WHERE (? IS NULL OR c.slug = ?)
      AND (? IS NULL OR s.id = ?)
      AND (? IS NULL OR LOWER(t.display_name) LIKE ? OR LOWER(s.name) LIKE ?)
    GROUP BY t.id, t.display_name, ls.review_count, ls.general_score,
             current.evaluation_count, current.average_global_rating,
             s.id, s.code, s.name, s.semester
    ORDER BY t.display_name, s.semester, s.name`).bind(career, career, subjectId, subjectId, pattern, pattern, pattern).all<Row>();

  const grouped = new Map<number, Row>();
  for (const row of result.results) {
    const teacher = grouped.get(row.id) ?? {
      id: row.id,
      display_name: row.display_name,
      legacy_review_count: row.legacy_review_count,
      legacy_general_score: row.legacy_general_score,
      evaluation_count: row.evaluation_count,
      average_global_rating: row.average_global_rating,
      absolute_global_rating: row.absolute_global_rating,
      subjects: [],
    };
    if (row.subject_id !== null) {
      teacher.subjects.push({ id: row.subject_id, name: row.subject, course_code: row.course_code, semester: row.subject_semester });
    }
    grouped.set(row.id, teacher);
  }
  return jsonResponse({ teachers: [...grouped.values()] }, origin);
}

async function subjects(request: Request, env: Env, origin: string): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const career = query.has("career") ? validateSlug(query.get("career")!) : null;
  const term = query.has("term") ? validateSlug(query.get("term")!) : null;
  const termClause = term ? "tm.code = ?" : "1 = 1";
  const values: Array<string> = [];
  if (term) values.push(term);
  const careerClause = career ? " AND c.slug = ?" : "";
  if (career) values.push(career);
  const result = await env.DB.prepare(`
    SELECT DISTINCT s.id, s.semester, s.code AS course_code,
                    s.name, s.credits, c.slug AS career
    FROM subjects s
    JOIN careers c ON c.id = s.career_id
    JOIN sections sec ON sec.subject_id = s.id
    JOIN terms tm ON tm.id = sec.term_id
    WHERE ${termClause}${careerClause}
    ORDER BY s.semester, s.name`).bind(...values).all<Row>();
  return jsonResponse({ career, term, subjects: result.results }, origin);
}

async function catalog(request: Request, env: Env, origin: string): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const career = query.has("career") ? validateSlug(query.get("career")!) : null;
  const term = query.has("term") ? validateSlug(query.get("term")!) : null;
  const termClause = term ? "tm.code = ?" : "tm.is_active = 1";
  const values: Array<string | null> = term ? [term] : [];
  values.push(career, career);
  const result = await env.DB.prepare(`
    SELECT s.id AS subject_id, s.semester, s.code AS course_code,
           s.name AS subject, s.credits, sec.id AS section_id,
           sec.group_name AS group_name, t.id AS teacher_id,
           t.display_name AS teacher, ls.general_score AS teacher_legacy_general_score,
           CASE
             WHEN current.average_global_rating >= 0 AND ls.general_score >= 0
               THEN ROUND((current.average_global_rating * current.evaluation_count + ls.general_score * ls.review_count) / (current.evaluation_count + ls.review_count), 2)
             WHEN current.average_global_rating >= 0 THEN current.average_global_rating
             WHEN ls.general_score >= 0 THEN ls.general_score
             ELSE NULL
           END AS teacher_absolute_global_rating,
           cm.day_of_week, cm.start_time, cm.end_time, cm.room
    FROM sections sec
    JOIN subjects s ON s.id = sec.subject_id
    JOIN careers c ON c.id = sec.career_id
    JOIN teachers t ON t.id = sec.teacher_id
    LEFT JOIN legacy_teacher_summaries ls ON ls.teacher_id = t.id
    LEFT JOIN (
      SELECT teacher_id, COUNT(*) AS evaluation_count, ROUND(AVG(global_rating), 2) AS average_global_rating
      FROM teacher_evaluations WHERE status = 'visible'
      GROUP BY teacher_id
    ) current ON current.teacher_id = t.id
    JOIN terms tm ON tm.id = sec.term_id
    LEFT JOIN class_meetings cm ON cm.section_id = sec.id
    WHERE ${termClause} AND (? IS NULL OR c.slug = ?)
    ORDER BY s.semester, s.name, sec.group_name`).bind(...values).all<Row>();

  const offerings = new Map<number, Row>();
  for (const row of result.results) {
    const offering = offerings.get(row.section_id) ?? {
      subject_id: row.subject_id,
      semester: row.semester,
      course_code: row.course_code,
      subject: row.subject,
      credits: row.credits,
      section_id: row.section_id,
      group_name: row.group_name,
      teacher_id: row.teacher_id,
      teacher: row.teacher,
      teacher_legacy_general_score: row.teacher_legacy_general_score,
      teacher_absolute_global_rating: row.teacher_absolute_global_rating,
      meetings: [],
    };
    if (row.day_of_week !== null) {
      offering.meetings.push({ day_of_week: row.day_of_week, start_time: row.start_time, end_time: row.end_time, room: row.room });
    }
    offerings.set(row.section_id, offering);
  }
  return jsonResponse({ term, career, offerings: [...offerings.values()] }, origin);
}

async function teacher(teacherId: number, env: Env, origin: string): Promise<Response> {
  const result = await env.DB.prepare("SELECT id, display_name FROM teachers WHERE id = ?").bind(teacherId).first<Row>();
  if (!result) return jsonResponse({ error: "teacher not found" }, origin, 404);
  const subjects = await env.DB.prepare(`
    SELECT DISTINCT s.id, s.name, s.code AS course_code, s.semester, c.slug AS career
    FROM sections sec JOIN subjects s ON s.id = sec.subject_id JOIN careers c ON c.id = sec.career_id
    WHERE sec.teacher_id = ? ORDER BY c.name, s.semester, s.name`).bind(teacherId).all<Row>();
  const summary = await env.DB.prepare(`
    SELECT COUNT(*) AS evaluation_count, ROUND(AVG(global_rating), 2) AS average_global_rating
    FROM teacher_evaluations WHERE teacher_id = ? AND status = 'visible'`).bind(teacherId).first<Row>();
  const legacySummary = await env.DB.prepare("SELECT general_score, review_count FROM legacy_teacher_summaries WHERE teacher_id = ?").bind(teacherId).first<Row>();
  const quality = await env.DB.prepare(`
    SELECT ROUND(AVG(numeric_value), 2) AS quality_average
    FROM evaluation_answers ea JOIN teacher_evaluations te ON te.id = ea.evaluation_id
    WHERE te.teacher_id = ? AND te.status = 'visible'
      AND ea.question_key IN ('fairness', 'explains', 'attitude', 'accessibility')`).bind(teacherId).first<Row>();
  const difficulty = await env.DB.prepare(`
    SELECT ROUND(AVG(ea.numeric_value), 2) AS difficulty_average
    FROM evaluation_answers ea JOIN teacher_evaluations te ON te.id = ea.evaluation_id
    WHERE te.teacher_id = ? AND te.status = 'visible' AND ea.question_key = 'difficulty'`).bind(teacherId).first<Row>();
  return jsonResponse({
    teacher: { ...result, subjects: subjects.results },
    summary: {
      ...(summary ?? {}), ...(quality ?? {}), ...(difficulty ?? {}),
      absolute_global_rating: weightedGlobalRating(summary?.average_global_rating, summary?.evaluation_count, legacySummary?.general_score, legacySummary?.review_count),
    },
  }, origin);
}

async function evaluations(request: Request, env: Env, teacherId: number, origin: string): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const subjectId = query.has("subject_id") ? positiveId(query.get("subject_id"), "subject_id") : null;
  const termId = query.has("term_id") ? positiveId(query.get("term_id"), "term_id") : null;
  const filters = ["te.teacher_id = ?", "te.status = 'visible'"];
  const values: Array<number | null> = [teacherId];
  if (subjectId !== null) { filters.push("te.subject_id = ?"); values.push(subjectId); }
  if (termId !== null) { filters.push("te.term_id = ?"); values.push(termId); }
  const where = filters.join(" AND ");
  const result = await env.DB.prepare(`
    SELECT te.id, te.subject_id, s.name AS subject, te.term_id, tm.name AS term,
           te.global_rating, te.comment, te.created_at,
           (SELECT COUNT(*) FROM comment_votes cv WHERE cv.source = 'evaluation' AND cv.comment_id = te.id AND cv.vote = 'like') AS like_count,
           (SELECT COUNT(*) FROM comment_votes cv WHERE cv.source = 'evaluation' AND cv.comment_id = te.id AND cv.vote = 'dislike') AS dislike_count
    FROM teacher_evaluations te LEFT JOIN subjects s ON s.id = te.subject_id LEFT JOIN terms tm ON tm.id = te.term_id
    WHERE ${where} ORDER BY te.created_at DESC LIMIT 100`).bind(...values).all<Row>();
  const answers = await env.DB.prepare(`
    SELECT ea.evaluation_id, ea.question_key, ea.numeric_value
    FROM evaluation_answers ea JOIN teacher_evaluations te ON te.id = ea.evaluation_id
    WHERE ${where}`).bind(...values).all<Row>();
  const byEvaluation = new Map(result.results.map((row) => [row.id, row]));
  for (const answer of answers.results) {
    const evaluation = byEvaluation.get(answer.evaluation_id);
    if (evaluation) (evaluation.answers ??= {})[answer.question_key] = answer.numeric_value;
  }
  return jsonResponse({ evaluations: [...byEvaluation.values()] }, origin);
}

async function createEvaluation(request: Request, env: Env, teacherId: number, origin: string): Promise<Response> {
  const body = await request.json() as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("request body must be an object");
  const globalRating = validateGlobalRating(body.global_rating);
  const answers = validateAnswers(body.answers);
  const comment = validateComment(body.comment);
  const teacherRow = await env.DB.prepare("SELECT id FROM teachers WHERE id = ?").bind(teacherId).first<Row>();
  if (!teacherRow) return jsonResponse({ error: "teacher not found" }, origin, 404);
  let subjectId = body.subject_id === null || body.subject_id === undefined ? null : positiveId(body.subject_id, "subject_id");
  if (subjectId !== null) {
    const subject = await env.DB.prepare("SELECT 1 FROM sections WHERE teacher_id = ? AND subject_id = ? LIMIT 1").bind(teacherId, subjectId).first<Row>();
    if (!subject) return jsonResponse({ error: "subject is not associated with teacher" }, origin, 400);
  }
  let termId: number | null;
  if (body.term_id === null || body.term_id === undefined) {
    const activeTerm = await env.DB.prepare("SELECT id FROM terms WHERE is_active = 1 ORDER BY id DESC LIMIT 1").first<Row>();
    termId = activeTerm?.id ?? null;
  } else {
    termId = positiveId(body.term_id, "term_id");
    const term = await env.DB.prepare("SELECT id FROM terms WHERE id = ?").bind(termId).first<Row>();
    if (!term) return jsonResponse({ error: "term not found" }, origin, 400);
  }
  const inserted = await env.DB.prepare(`
    INSERT INTO teacher_evaluations (teacher_id, subject_id, term_id, global_rating, comment, status)
    VALUES (?, ?, ?, ?, ?, 'visible')`).bind(teacherId, subjectId, termId, globalRating, comment).run();
  const evaluationId = inserted.meta.last_row_id;
  if (evaluationId) {
    for (const [questionKey, numericValue] of Object.entries(answers)) {
      await env.DB.prepare("INSERT INTO evaluation_answers (evaluation_id, question_key, numeric_value) VALUES (?, ?, ?)").bind(evaluationId, questionKey, numericValue).run();
    }
  }
  return jsonResponse({ created: true, evaluation_id: evaluationId }, origin, 201);
}

async function legacy(teacherId: number, env: Env, origin: string): Promise<Response> {
  const summary = await env.DB.prepare(`
    SELECT review_count, fair_percent, explains_well_percent, hard_percent,
           homework_percent, attendance_percent, general_score, source_label, source_url
    FROM legacy_teacher_summaries WHERE teacher_id = ?`).bind(teacherId).first<Row>();
  const comments = await env.DB.prepare(`
    SELECT id, source_id, body, legacy_rating, published_at, source_label, source_url,
           (SELECT COUNT(*) FROM comment_votes cv WHERE cv.source = 'legacy' AND cv.comment_id = legacy_comments.id AND cv.vote = 'like') AS like_count,
           (SELECT COUNT(*) FROM comment_votes cv WHERE cv.source = 'legacy' AND cv.comment_id = legacy_comments.id AND cv.vote = 'dislike') AS dislike_count
    FROM legacy_comments WHERE teacher_id = ? ORDER BY published_at DESC, id DESC LIMIT 100`).bind(teacherId).all<Row>();
  return jsonResponse({ source: "HazTuHorario", summary, comments: comments.results }, origin);
}

async function voteComment(request: Request, env: Env, source: string, commentId: number, origin: string): Promise<Response> {
  if (source !== "evaluation" && source !== "legacy") return jsonResponse({ error: "invalid comment source" }, origin, 400);
  const body = await request.json() as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("request body must be an object");
  const voterKey = validateVoterKey(body.voter_id);
  const vote = validateVote(body.vote);
  const commentTable = source === "evaluation" ? "teacher_evaluations" : "legacy_comments";
  const visibleClause = source === "evaluation" ? " AND status = 'visible'" : "";
  const comment = await env.DB.prepare(`SELECT id FROM ${commentTable} WHERE id = ?${visibleClause}`).bind(commentId).first<Row>();
  if (!comment) return jsonResponse({ error: "comment not found" }, origin, 404);
  await env.DB.prepare("DELETE FROM comment_votes WHERE source = ? AND comment_id = ? AND voter_key = ?").bind(source, commentId, voterKey).run();
  if (vote !== "remove") {
    await env.DB.prepare("INSERT INTO comment_votes (source, comment_id, voter_key, vote) VALUES (?, ?, ?, ?)").bind(source, commentId, voterKey, vote).run();
  }
  const counts = await env.DB.prepare(`
    SELECT SUM(CASE WHEN vote = 'like' THEN 1 ELSE 0 END) AS like_count,
           SUM(CASE WHEN vote = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
    FROM comment_votes WHERE source = ? AND comment_id = ?`).bind(source, commentId).first<Row>();
  return jsonResponse({ source, comment_id: commentId, like_count: counts?.like_count ?? 0, dislike_count: counts?.dislike_count ?? 0, vote: vote === "remove" ? null : vote }, origin);
}

async function dispatch(request: Request, env: Env, origin: string): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/health") return jsonResponse({ status: "ok" }, origin);
  if (parts.join("/") === "api/v1/terms" && request.method === "GET") return terms(env, origin);
  if (parts.join("/") === "api/v1/careers" && request.method === "GET") return careers(env, origin);
  if (parts.join("/") === "api/v1/teachers" && request.method === "GET") return teachers(request, env, origin);
  if (parts.join("/") === "api/v1/subjects" && request.method === "GET") return subjects(request, env, origin);
  if (parts.join("/") === "api/v1/catalog" && request.method === "GET") return catalog(request, env, origin);
  if (parts.length === 5 && parts.slice(0, 3).join("/") === "api/v1/teachers" && parts[4] === "evaluations") {
    const teacherId = positiveId(parts[3], "teacher_id");
    if (request.method === "GET") return evaluations(request, env, teacherId, origin);
    if (request.method === "POST") return createEvaluation(request, env, teacherId, origin);
  }
  if (parts.length === 5 && parts.slice(0, 3).join("/") === "api/v1/teachers" && parts[4] === "legacy" && request.method === "GET") {
    return legacy(positiveId(parts[3], "teacher_id"), env, origin);
  }
  if (parts.length === 6 && parts.slice(0, 3).join("/") === "api/v1/comments" && parts[5] === "vote" && request.method === "POST") {
    return voteComment(request, env, parts[3], positiveId(parts[4], "comment_id"), origin);
  }
  if (parts.length === 4 && parts.slice(0, 3).join("/") === "api/v1/teachers" && request.method === "GET") {
    return teacher(positiveId(parts[3], "teacher_id"), env, origin);
  }
  return jsonResponse({ error: "not found" }, origin, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { origin, allowed } = originFor(request, env);
    if (!allowed) return jsonResponse({ error: "origin not allowed" }, origin, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    try {
      return await dispatch(request, env, origin);
    } catch (error) {
      if (error instanceof Error && error.message && !error.message.includes("SQL")) {
        const known = ["invalid identifier", "positive integer", "must be", "unknown answer", "request body", "vote must be", "comment must be"];
        if (known.some((message) => error.message.includes(message))) return jsonResponse({ error: error.message }, origin, 400);
      }
      console.error(error);
      return jsonResponse({ error: "internal server error" }, origin, 500);
    }
  },
};
