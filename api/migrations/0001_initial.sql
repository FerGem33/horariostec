PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS careers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  career_id INTEGER NOT NULL REFERENCES careers(id),
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
  code TEXT,
  name TEXT NOT NULL,
  credits INTEGER,
  UNIQUE(career_id, semester, code, name)
);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  normalized_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id),
  career_id INTEGER NOT NULL REFERENCES careers(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  group_name TEXT,
  source_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS class_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT
);

CREATE TABLE IF NOT EXISTS legacy_teacher_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  fair_percent REAL,
  explains_well_percent REAL,
  hard_percent REAL,
  homework_percent REAL,
  attendance_percent REAL,
  general_score REAL,
  source_label TEXT NOT NULL DEFAULT 'HazTuHorario',
  source_url TEXT,
  UNIQUE(teacher_id)
);

CREATE TABLE IF NOT EXISTS legacy_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  source_id TEXT,
  body TEXT NOT NULL,
  legacy_rating INTEGER,
  published_at TEXT,
  source_url TEXT,
  source_label TEXT NOT NULL DEFAULT 'HazTuHorario',
  UNIQUE(teacher_id, source_id)
);

CREATE TABLE IF NOT EXISTS teacher_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id),
  subject_id INTEGER REFERENCES subjects(id),
  term_id INTEGER REFERENCES terms(id),
  global_rating INTEGER NOT NULL CHECK (global_rating BETWEEN 0 AND 100),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evaluation_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id INTEGER NOT NULL REFERENCES teacher_evaluations(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  numeric_value INTEGER NOT NULL,
  UNIQUE(evaluation_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_terms_active ON terms(is_active);
CREATE INDEX IF NOT EXISTS idx_subjects_career_semester ON subjects(career_id, semester);
CREATE INDEX IF NOT EXISTS idx_sections_term_career ON sections(term_id, career_id);
CREATE INDEX IF NOT EXISTS idx_sections_subject ON sections(subject_id);
CREATE INDEX IF NOT EXISTS idx_sections_teacher ON sections(teacher_id);
CREATE INDEX IF NOT EXISTS idx_legacy_summary_teacher ON legacy_teacher_summaries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_legacy_comments_teacher ON legacy_comments(teacher_id, published_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_teacher_status ON teacher_evaluations(teacher_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_subject_term ON teacher_evaluations(subject_id, term_id);
CREATE INDEX IF NOT EXISTS idx_answers_evaluation_question ON evaluation_answers(evaluation_id, question_key);
