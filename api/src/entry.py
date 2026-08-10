from __future__ import annotations

from asyncio import Lock
from urllib.parse import parse_qs, urlparse

from workers import Response, WorkerEntrypoint

from cors import configured_origins
from validation import (
    validate_answers,
    validate_comment,
    validate_global_rating,
    validate_slug,
    validate_vote,
    validate_voter_key,
)


def weighted_global_rating(current_average: object, current_count: object, legacy_average: object, legacy_count: object) -> float | None:
    sources = []
    for average, count in ((current_average, current_count), (legacy_average, legacy_count)):
        if average is not None and float(average) >= 0 and count is not None and int(count) > 0:
            sources.append((float(average), int(count)))
    total_reviews = sum(count for _, count in sources)
    if not total_reviews:
        return None
    return round(sum(average * count for average, count in sources) / total_reviews, 2)


API_PREFIX = "/api/v1"

# Python Workers execute through Pyodide. Keep application code from overlapping
# inside the same isolate, where concurrent requests can otherwise trigger
# Pyodide GIL/task errors while awaiting D1 operations.
DISPATCH_LOCK = Lock()


def cors_headers(origin: str = "*") -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Cache-Control": "no-store",
    }


def json_response(data: object, *, status: int = 200, origin: str = "*") -> Response:
    return Response.json(data, status=status, headers=cors_headers(origin))


def route(path: str) -> list[str]:
    return [part for part in path.split("/") if part]


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        parsed = urlparse(request.url)
        configured = getattr(
            self.env,
            "ALLOWED_ORIGINS",
            getattr(self.env, "ALLOWED_ORIGIN", "*"),
        )
        origins = configured_origins(configured)
        request_origin = request.headers.get("Origin")
        normalized_request_origin = request_origin.rstrip("/") if request_origin else None
        fallback_origin = next(iter(origins - {"*"}), "*")
        if "*" not in origins and normalized_request_origin not in origins:
            return json_response(
                {"error": "origin not allowed"}, status=403, origin=fallback_origin
            )
        origin = request_origin if request_origin else fallback_origin
        if request.method == "OPTIONS":
            return Response("", status=204, headers=cors_headers(origin))

        try:
            async with DISPATCH_LOCK:
                return await self._dispatch(request, parsed.path, origin)
        except ValueError as error:
            return json_response({"error": str(error)}, status=400, origin=origin)
        except Exception:
            # Do not leak SQL errors or request data to public clients.
            return json_response({"error": "internal server error"}, status=500, origin=origin)

    async def _dispatch(self, request, path: str, origin: str) -> Response:
        parts = route(path)
        if path == "/api/health":
            return json_response({"status": "ok"}, origin=origin)
        if parts == ["api", "v1", "terms"] and request.method == "GET":
            return await self.terms(origin)
        if parts == ["api", "v1", "careers"] and request.method == "GET":
            return await self.careers(origin)
        if parts == ["api", "v1", "teachers"] and request.method == "GET":
            return await self.teachers(request, origin)
        if parts == ["api", "v1", "subjects"] and request.method == "GET":
            return await self.subjects(request, origin)
        if parts == ["api", "v1", "catalog"] and request.method == "GET":
            return await self.catalog(request, origin)
        if len(parts) == 5 and parts[:3] == ["api", "v1", "teachers"] and parts[4] == "evaluations":
            teacher_id = int(parts[3])
            if request.method == "GET":
                return await self.evaluations(request, teacher_id, origin)
            if request.method == "POST":
                return await self.create_evaluation(request, teacher_id, origin)
        if len(parts) == 5 and parts[:3] == ["api", "v1", "teachers"] and parts[4] == "legacy":
            if request.method == "GET":
                return await self.legacy(int(parts[3]), origin)
        if len(parts) == 6 and parts[:3] == ["api", "v1", "comments"] and parts[5] == "vote":
            if request.method == "POST":
                return await self.vote_comment(request, parts[3], int(parts[4]), origin)
        if len(parts) == 4 and parts[:3] == ["api", "v1", "teachers"] and request.method == "GET":
            return await self.teacher(int(parts[3]), origin)
        return json_response({"error": "not found"}, status=404, origin=origin)

    async def terms(self, origin: str) -> Response:
        result = await self.env.DB.prepare(
            """SELECT id, code, name, is_active
               FROM terms
               ORDER BY is_active DESC, id DESC"""
        ).all()
        return json_response({"terms": result.results}, origin=origin)

    async def careers(self, origin: str) -> Response:
        result = await self.env.DB.prepare(
            """SELECT c.id, c.slug, c.name,
                      COUNT(DISTINCT s.id) AS subject_count,
                      COUNT(DISTINCT sec.teacher_id) AS teacher_count
               FROM careers c
               LEFT JOIN subjects s ON s.career_id = c.id
               LEFT JOIN sections sec ON sec.career_id = c.id
               GROUP BY c.id, c.slug, c.name
               ORDER BY c.name"""
        ).all()
        return json_response({"careers": result.results}, origin=origin)

    async def teachers(self, request, origin: str) -> Response:
        query = parse_qs(urlparse(request.url).query)
        career = validate_slug(query["career"][0]) if query.get("career") else None
        subject_id = query.get("subject_id", [None])[0]
        if subject_id is not None:
            subject_id = self._positive_id(subject_id, "subject_id")
        search = query.get("search", [None])[0]
        if search is not None:
            search = search.strip()
            if len(search) > 80:
                raise ValueError("search must be at most 80 characters")
        pattern = f"%{search.lower()}%" if search else None
        result = await self.env.DB.prepare(
            """SELECT t.id, t.display_name,
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
                 FROM teacher_evaluations
                 WHERE status = 'visible'
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
               ORDER BY t.display_name, s.semester, s.name"""
        ).bind(career, career, subject_id, subject_id, pattern, pattern, pattern).all()
        teachers: dict[int, dict] = {}
        for row in result.results:
            teacher = teachers.setdefault(
                row["id"],
                {
                    "id": row["id"],
                    "display_name": row["display_name"],
                    "legacy_review_count": row["legacy_review_count"],
                    "legacy_general_score": row["legacy_general_score"],
                    "evaluation_count": row["evaluation_count"],
                    "average_global_rating": row["average_global_rating"],
                    "absolute_global_rating": row["absolute_global_rating"],
                    "subjects": [],
                },
            )
            if row["subject_id"] is not None:
                teacher["subjects"].append(
                    {"id": row["subject_id"], "name": row["subject"], "course_code": row["course_code"], "semester": row["subject_semester"]}
                )
        return json_response({"teachers": list(teachers.values())}, origin=origin)

    async def subjects(self, request, origin: str) -> Response:
        query = parse_qs(urlparse(request.url).query)
        career = validate_slug(query["career"][0]) if query.get("career") else None
        term = validate_slug(query["term"][0]) if query.get("term") else None
        term_clause = "tm.code = ?" if term else "1 = 1"
        values: list[object] = []
        career_clause = ""
        if term:
            values.append(term)
        if career:
            career_clause = " AND c.slug = ?"
            values.append(career)
        result = await self.env.DB.prepare(
            f"""SELECT DISTINCT s.id, s.semester, s.code AS course_code,
                              s.name, s.credits, c.slug AS career
                    FROM subjects s
                    JOIN careers c ON c.id = s.career_id
                    JOIN sections sec ON sec.subject_id = s.id
                    JOIN terms tm ON tm.id = sec.term_id
                    WHERE {term_clause}{career_clause}
                    ORDER BY s.semester, s.name"""
        ).bind(*values).all()
        return json_response(
            {"career": career, "term": term, "subjects": result.results}, origin=origin
        )

    async def catalog(self, request, origin: str) -> Response:
        query = parse_qs(urlparse(request.url).query)
        career = validate_slug(query["career"][0]) if query.get("career") else None
        term = validate_slug(query["term"][0]) if query.get("term") else None
        term_clause = "tm.code = ?" if term else "tm.is_active = 1"
        sql = f"""
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
                 cm.day_of_week,
                 cm.start_time, cm.end_time, cm.room
          FROM sections sec
          JOIN subjects s ON s.id = sec.subject_id
          JOIN careers c ON c.id = sec.career_id
          JOIN teachers t ON t.id = sec.teacher_id
          LEFT JOIN legacy_teacher_summaries ls ON ls.teacher_id = t.id
          LEFT JOIN (
            SELECT teacher_id, COUNT(*) AS evaluation_count, ROUND(AVG(global_rating), 2) AS average_global_rating
            FROM teacher_evaluations
            WHERE status = 'visible'
            GROUP BY teacher_id
          ) current ON current.teacher_id = t.id
          JOIN terms tm ON tm.id = sec.term_id
          LEFT JOIN class_meetings cm ON cm.section_id = sec.id
          WHERE {term_clause}
            AND (? IS NULL OR c.slug = ?)
          ORDER BY s.semester, s.name, sec.group_name
        """
        values: list[object] = [term] if term else []
        values.extend([career, career])
        result = await self.env.DB.prepare(sql).bind(*values).all()
        offerings = {}
        for row in result.results:
            section_id = row["section_id"]
            offering = offerings.setdefault(
                section_id,
                {
                    "subject_id": row["subject_id"],
                    "semester": row["semester"],
                    "course_code": row["course_code"],
                    "subject": row["subject"],
                    "credits": row["credits"],
                    "section_id": section_id,
                    "group_name": row["group_name"],
                    "teacher_id": row["teacher_id"],
                    "teacher": row["teacher"],
                    "teacher_legacy_general_score": row["teacher_legacy_general_score"],
                    "teacher_absolute_global_rating": row["teacher_absolute_global_rating"],
                    "meetings": [],
                },
            )
            if row["day_of_week"] is not None:
                offering["meetings"].append(
                    {
                        "day_of_week": row["day_of_week"],
                        "start_time": row["start_time"],
                        "end_time": row["end_time"],
                        "room": row["room"],
                    }
                )
        return json_response({"term": term, "career": career, "offerings": list(offerings.values())}, origin=origin)

    async def teacher(self, teacher_id: int, origin: str) -> Response:
        result = await self.env.DB.prepare(
            "SELECT id, display_name FROM teachers WHERE id = ?"
        ).bind(teacher_id).first()
        if not result:
            return json_response({"error": "teacher not found"}, status=404, origin=origin)
        subjects = await self.env.DB.prepare(
            """SELECT DISTINCT s.id, s.name, s.code AS course_code, s.semester, c.slug AS career
               FROM sections sec
               JOIN subjects s ON s.id = sec.subject_id
               JOIN careers c ON c.id = sec.career_id
               WHERE sec.teacher_id = ?
               ORDER BY c.name, s.semester, s.name"""
        ).bind(teacher_id).all()
        summary = await self.env.DB.prepare(
            """SELECT COUNT(*) AS evaluation_count,
                      ROUND(AVG(global_rating), 2) AS average_global_rating
               FROM teacher_evaluations
               WHERE teacher_id = ? AND status = 'visible'"""
        ).bind(teacher_id).first()
        legacy_summary = await self.env.DB.prepare(
            "SELECT general_score, review_count FROM legacy_teacher_summaries WHERE teacher_id = ?"
        ).bind(teacher_id).first()
        quality = await self.env.DB.prepare(
            """SELECT ROUND(AVG(numeric_value), 2) AS quality_average
               FROM evaluation_answers ea
               JOIN teacher_evaluations te ON te.id = ea.evaluation_id
               WHERE te.teacher_id = ? AND te.status = 'visible'
                 AND ea.question_key IN ('fairness', 'explains', 'attitude', 'accessibility')"""
        ).bind(teacher_id).first()
        difficulty = await self.env.DB.prepare(
            """SELECT ROUND(AVG(ea.numeric_value), 2) AS difficulty_average
               FROM evaluation_answers ea
               JOIN teacher_evaluations te ON te.id = ea.evaluation_id
               WHERE te.teacher_id = ? AND te.status = 'visible'
                 AND ea.question_key = 'difficulty'"""
        ).bind(teacher_id).first()
        return json_response(
            {
                "teacher": {**result, "subjects": subjects.results},
                "summary": {
                    **(summary or {}),
                    **(quality or {}),
                    **(difficulty or {}),
                      "absolute_global_rating": weighted_global_rating(
                        (summary or {}).get("average_global_rating"),
                        (summary or {}).get("evaluation_count"),
                        (legacy_summary or {}).get("general_score"),
                        (legacy_summary or {}).get("review_count"),
                    ),
                },
            },
            origin=origin,
        )

    async def evaluations(self, request, teacher_id: int, origin: str) -> Response:
        query = parse_qs(urlparse(request.url).query)
        subject_id = query.get("subject_id", [None])[0]
        term_id = query.get("term_id", [None])[0]
        filters = ["te.teacher_id = ?", "te.status = 'visible'"]
        values: list[object] = [teacher_id]
        if subject_id is not None:
            subject_id = self._positive_id(subject_id, "subject_id")
            filters.append("te.subject_id = ?")
            values.append(subject_id)
        if term_id is not None:
            term_id = self._positive_id(term_id, "term_id")
            filters.append("te.term_id = ?")
            values.append(term_id)
        result = await self.env.DB.prepare(
            f"""SELECT te.id, te.subject_id, s.name AS subject,
                          te.term_id, tm.name AS term, te.global_rating,
                          te.comment, te.created_at,
                          (SELECT COUNT(*) FROM comment_votes cv
                           WHERE cv.source = 'evaluation' AND cv.comment_id = te.id AND cv.vote = 'like') AS like_count,
                          (SELECT COUNT(*) FROM comment_votes cv
                           WHERE cv.source = 'evaluation' AND cv.comment_id = te.id AND cv.vote = 'dislike') AS dislike_count
                   FROM teacher_evaluations te
                   LEFT JOIN subjects s ON s.id = te.subject_id
                   LEFT JOIN terms tm ON tm.id = te.term_id
                   WHERE {' AND '.join(filters)}
                   ORDER BY te.created_at DESC LIMIT 100"""
        ).bind(*values).all()
        answers = await self.env.DB.prepare(
            f"""SELECT ea.evaluation_id, ea.question_key, ea.numeric_value
                FROM evaluation_answers ea
                JOIN teacher_evaluations te ON te.id = ea.evaluation_id
                WHERE {' AND '.join(filters)}"""
        ).bind(*values).all()
        by_evaluation = {row["id"]: row for row in result.results}
        for answer in answers.results:
            evaluation = by_evaluation.get(answer["evaluation_id"])
            if evaluation is not None:
                evaluation.setdefault("answers", {})[answer["question_key"]] = answer["numeric_value"]
        return json_response({"evaluations": list(by_evaluation.values())}, origin=origin)

    async def create_evaluation(self, request, teacher_id: int, origin: str) -> Response:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("request body must be an object")
        global_rating = validate_global_rating(body.get("global_rating"))
        answers = validate_answers(body.get("answers"))
        comment = validate_comment(body.get("comment"))
        teacher = await self.env.DB.prepare(
            "SELECT id FROM teachers WHERE id = ?"
        ).bind(teacher_id).first()
        if not teacher:
            return json_response({"error": "teacher not found"}, status=404, origin=origin)
        subject_id = body.get("subject_id")
        if subject_id is not None:
            subject_id = self._positive_id(subject_id, "subject_id")
            subject = await self.env.DB.prepare(
                """SELECT 1 FROM sections
                   WHERE teacher_id = ? AND subject_id = ? LIMIT 1"""
            ).bind(teacher_id, subject_id).first()
            if not subject:
                return json_response({"error": "subject is not associated with teacher"}, status=400, origin=origin)
        term_id = body.get("term_id")
        if term_id is None:
            active_term = await self.env.DB.prepare(
                "SELECT id FROM terms WHERE is_active = 1 ORDER BY id DESC LIMIT 1"
            ).first()
            term_id = active_term["id"] if active_term else None
        else:
            term_id = self._positive_id(term_id, "term_id")
            term = await self.env.DB.prepare("SELECT id FROM terms WHERE id = ?").bind(term_id).first()
            if not term:
                return json_response({"error": "term not found"}, status=400, origin=origin)
        inserted_result = await self.env.DB.prepare(
            """INSERT INTO teacher_evaluations
               (teacher_id, subject_id, term_id, global_rating, comment, status)
               VALUES (?, ?, ?, ?, ?, 'visible')"""
        ).bind(teacher_id, subject_id, term_id, global_rating, comment).run()
        evaluation_id = inserted_result.meta.last_row_id
        if evaluation_id:
            for question_key, numeric_value in answers.items():
                await self.env.DB.prepare(
                    """INSERT INTO evaluation_answers (evaluation_id, question_key, numeric_value)
                       VALUES (?, ?, ?)"""
                ).bind(evaluation_id, question_key, numeric_value).run()
        return json_response({"created": True, "evaluation_id": evaluation_id}, status=201, origin=origin)

    async def legacy(self, teacher_id: int, origin: str) -> Response:
        summary = await self.env.DB.prepare(
            """SELECT review_count, fair_percent, explains_well_percent,
                      hard_percent, homework_percent, attendance_percent,
                      general_score, source_label, source_url
               FROM legacy_teacher_summaries
               WHERE teacher_id = ?"""
        ).bind(teacher_id).first()
        comments = await self.env.DB.prepare(
            """SELECT id, source_id, body, legacy_rating, published_at,
                      source_label, source_url
                      ,(SELECT COUNT(*) FROM comment_votes cv
                        WHERE cv.source = 'legacy' AND cv.comment_id = legacy_comments.id AND cv.vote = 'like') AS like_count
                      ,(SELECT COUNT(*) FROM comment_votes cv
                        WHERE cv.source = 'legacy' AND cv.comment_id = legacy_comments.id AND cv.vote = 'dislike') AS dislike_count
               FROM legacy_comments
               WHERE teacher_id = ? ORDER BY published_at DESC, id DESC
               LIMIT 100"""
        ).bind(teacher_id).all()
        return json_response(
            {"source": "HazTuHorario", "summary": summary, "comments": comments.results},
            origin=origin,
        )

    async def vote_comment(self, request, source: str, comment_id: int, origin: str) -> Response:
        if source not in ("evaluation", "legacy"):
            return json_response({"error": "invalid comment source"}, status=400, origin=origin)
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("request body must be an object")
        voter_key = validate_voter_key(body.get("voter_id"))
        vote = validate_vote(body.get("vote"))
        comment_table = "teacher_evaluations" if source == "evaluation" else "legacy_comments"
        visible_clause = " AND status = 'visible'" if source == "evaluation" else ""
        comment = await self.env.DB.prepare(
            f"SELECT id FROM {comment_table} WHERE id = ?{visible_clause}"
        ).bind(comment_id).first()
        if not comment:
            return json_response({"error": "comment not found"}, status=404, origin=origin)

        if vote == "remove":
            await self.env.DB.prepare(
                "DELETE FROM comment_votes WHERE source = ? AND comment_id = ? AND voter_key = ?"
            ).bind(source, comment_id, voter_key).run()
        else:
            await self.env.DB.prepare(
                "DELETE FROM comment_votes WHERE source = ? AND comment_id = ? AND voter_key = ?"
            ).bind(source, comment_id, voter_key).run()
            await self.env.DB.prepare(
                "INSERT INTO comment_votes (source, comment_id, voter_key, vote) VALUES (?, ?, ?, ?)"
            ).bind(source, comment_id, voter_key, vote).run()

        counts = await self.env.DB.prepare(
            """SELECT
                 SUM(CASE WHEN vote = 'like' THEN 1 ELSE 0 END) AS like_count,
                 SUM(CASE WHEN vote = 'dislike' THEN 1 ELSE 0 END) AS dislike_count
               FROM comment_votes WHERE source = ? AND comment_id = ?"""
        ).bind(source, comment_id).first()
        return json_response(
            {
                "source": source,
                "comment_id": comment_id,
                "like_count": counts["like_count"] or 0,
                "dislike_count": counts["dislike_count"] or 0,
                "vote": None if vote == "remove" else vote,
            },
            origin=origin,
        )

    @staticmethod
    def _positive_id(value: object, field: str) -> int:
        if isinstance(value, bool):
            raise ValueError(f"{field} must be a positive integer")
        try:
            parsed = int(value)
        except (TypeError, ValueError) as error:
            raise ValueError(f"{field} must be a positive integer") from error
        if parsed <= 0:
            raise ValueError(f"{field} must be a positive integer")
        return parsed
