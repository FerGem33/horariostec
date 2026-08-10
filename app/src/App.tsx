import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Cog,
  Compass,
  Cpu,
  Database,
  Factory,
  Info,
  LockKeyhole,
  MessageSquare,
  Moon,
  Search,
  Sun,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  type Career,
  type Evaluation,
  type Legacy,
  type Teacher,
} from "./api";
import ScheduleBuilder from "./ScheduleBuilder";
import AnimatedScheduleIllustration from "./AnimatedScheduleIllustration";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const Github = Code2;

function CareerIcon({ career }: { career: string }) {
  const icons: Record<string, LucideIcon> = {
    sistemas: Code2,
    mecatronica: Bot,
    mecanica: Cog,
    industrial: Factory,
    electrica: Zap,
    electronica: Cpu,
    gestion: BriefcaseBusiness,
    materiales: Boxes,
  };

  const Icon = icons[career] ?? Boxes;
  return <Icon className="career-icon" strokeWidth={1.6} aria-hidden="true" />;
}

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isSchedule = location.pathname.startsWith("/horario");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark";
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <div className={`app-shell ${isSchedule ? "schedule-layout" : ""}`}>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/icon.png" alt="" />
            <span>
              Horarios<span className="brand-accent">Tec</span>
            </span>
          </Link>
          <nav>
            <NavLink to="/horario" data-tooltip="Generador de Horarios" data-tooltip-pos="bottom">Horarios</NavLink>
            <NavLink to="/docentes" data-tooltip="Directorio de Docentes" data-tooltip-pos="bottom">Docentes</NavLink>
            <NavLink
              className="about-nav-link"
              to="/nosotros"
              aria-label="Nosotros"
              data-tooltip="Acerca de HorariosTec"
              data-tooltip-pos="bottom"
            >
              <span className="nav-label">Nosotros</span>
              <Info
                className="nav-info-icon"
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />
            </NavLink>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              data-tooltip={theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
              data-tooltip-pos="bottom"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer>
        <div className="container footer-inner">
          <div className="footer-brand">
            <strong>HorariosTec</strong> — Planificador de Horarios & Evaluaciones Docentes
          </div>
          <div className="footer-meta">
            Instituto Tecnológico de Saltillo • Proyecto Open Source
          </div>
        </div>
      </footer>
    </div>
  );
}
function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="state error-state">
      <strong>Algo no salió bien</strong>
      <span>{message}</span>
    </div>
  );
}
function Loading() {
  return <div className="state">Cargando información...</div>;
}

function Home() {
  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-copy-block">
          <div className="eyebrow">INSTITUTO TECNOLÓGICO DE SALTILLO</div>
          <h1>
            Conoce a tus docentes.
            <br />
            <em>Decide mejor.</em>
          </h1>
          <p className="hero-copy">
            Consulta evaluaciones de estudiantes y comparte tu experiencia con
            la comunidad tecnológica.
          </p>
          <div className="home-actions">
            <Link className="choice-card choice-card-primary" to="/horario">
              <span className="choice-index">01</span>
              <span>
                <strong>Hacer horario</strong>
                <small>Organiza tu próximo semestre</small>
              </span>
              <b>→</b>
            </Link>
            <Link className="choice-card choice-card-primary" to="/docentes">
              <span className="choice-index">02</span>
              <span>
                <strong>Ver docentes</strong>
                <small>Conoce experiencias de estudiantes</small>
              </span>
              <b>→</b>
            </Link>
          </div>
        </div>
        <div className="hero-board">
          <AnimatedScheduleIllustration />
        </div>
      </section>
    </div>
  );
}

function Nosotros() {
  return (
    <div className="about-page">
      <section className="about-hero container">
        <div className="about-copy">
          <div className="eyebrow">NOSOTROS</div>
          <h1>
            Una comunidad
            <br />
            <em>decide mejor.</em>
          </h1>
          <p>
            HorariosTec reúne datos de HazTuHorario y experiencias actuales para
            ayudarte a elegir con más claridad.
          </p>
        </div>

        <div className="about-calendar-art" aria-hidden="true">
          <div className="about-browser">
            <span>
              <i />
              <i />
              <i />
            </span>
            <div className="about-calendar">
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <b />
              <strong>
                <Check size={18} />
              </strong>
            </div>
            <div className="about-chat">
              <i />
              <i />
              <i />
              <b />
            </div>
          </div>
          <span className="about-orbit about-orbit-one" />
          <span className="about-orbit about-orbit-two" />
        </div>
      </section>

      <section className="about-origin container">
        <div className="about-origin-icon">
          <Database size={45} strokeWidth={1.4} />
        </div>
        <div className="about-origin-copy">
          <div className="eyebrow">NUESTRO PUNTO DE PARTIDA</div>
          <h2>Inspirado en HazTuHorario</h2>
          <p>
            HorariosTec utiliza datos de HazTuHorario como base para ofrecer
            información útil a una nueva generación de estudiantes.
          </p>
          <span className="about-chip">Datos importados</span>
        </div>

        <div className="about-flow-art" aria-hidden="true">
          <div className="flow-list">
            <i />
            <i />
            <i />
          </div>
          <ArrowRight className="flow-arrow" size={54} strokeWidth={1.1} />
          <div className="flow-people">
            <i>
              <UserRound />
            </i>
            <i>
              <UserRound />
            </i>
            <i>
              <UserRound />
            </i>
          </div>
        </div>
      </section>

      <section className="about-cards container">
        <article>
          <span className="about-card-icon about-card-petrol">
            <Database size={34} strokeWidth={1.4} />
          </span>
          <div>
            <h3>Datos importados</h3>
            <p>Datos provenientes de HazTuHorario.</p>
          </div>
        </article>

        <article>
          <span className="about-card-icon about-card-coral">
            <MessageSquare size={34} strokeWidth={1.4} />
          </span>
          <div>
            <h3>Evaluaciones actuales</h3>
            <p>Experiencias publicadas en HorariosTec.</p>
          </div>
        </article>

        <article>
          <span className="about-card-icon about-card-mustard">
            <Compass size={34} strokeWidth={1.4} />
          </span>
          <div>
            <h3>Nuestro propósito</h3>
            <p>Ayudarte a comparar, planear y decidir.</p>
          </div>
        </article>
      </section>

      <section className="about-open-source container">
        <div className="about-open-source-icon">
          <Github size={38} strokeWidth={1.5} />
        </div>
        <div className="about-open-source-copy">
          <div className="eyebrow">CÓDIGO ABIERTO</div>
          <h2>Construido en comunidad</h2>
          <p>
            HorariosTec es un proyecto open source. Conoce el código, propón
            mejoras y ayuda a construir una mejor herramienta para estudiantes.
          </p>
        </div>
        <a
          className="button button-dark about-open-source-link"
          href="https://github.com/FerGem33/horariostec"
          target="_blank"
          rel="noreferrer"
        >
          Ver repositorio <ArrowRight size={17} />
        </a>
      </section>
    </div>
  );
}

function CareerCard({ career }: { career: Career }) {
  const content = (
    <>
      <span className="career-pattern" aria-hidden="true">
        <CareerIcon career={career.slug} />
      </span>
      <span className="career-mark">
        <CareerIcon career={career.slug} />
      </span>
      <span className="career-card-content">
        <strong>{career.name}</strong>
        <small>
          {career.teacher_count
            ? `${career.teacher_count} docentes · ${career.subject_count} materias`
            : "Explorar docentes"}
        </small>
      </span>
    </>
  );
  return (
    <Link
      to={`/docentes/carrera/${career.slug}`}
      className={`career-card career-${career.slug}`}
    >
      {content}
    </Link>
  );
}
function Teachers() {
  const { data, isPending, error } = useQuery({
    queryKey: ["careers"],
    queryFn: api.careers,
  });
  const careers = data?.careers ?? [];
  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DIRECTORIO</div>
          <h1>Docentes</h1>
          <p>Elige una carrera para explorar sus materias y docentes.</p>
        </div>
        <span className="heading-rule" />
      </div>
      {error ? (
        <ErrorMessage message={error.message} />
      ) : isPending || !careers.length ? (
        <Loading />
      ) : (
        <div className="career-grid">
          {careers.map((career) => (
            <CareerCard key={career.slug} career={career} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const rating = teacher.absolute_global_rating;
  const tone =
    rating == null
      ? "unknown"
      : rating <= 30
        ? "red"
        : rating <= 70
          ? "yellow"
          : "green";
  return (
    <Link to={`/docentes/${teacher.id}`} className="teacher-card">
      <div className={`rating-badge ${tone}`}>
        {rating == null ? "—" : Math.round(rating)}
      </div>
      <div className="teacher-card-body">
        <h2>{teacher.display_name}</h2>
        <div className="teacher-tags">
          {(teacher.subjects ?? []).slice(0, 2).map((subject) => (
            <span key={subject.id}>{subject.name}</span>
          ))}
          {(teacher.subjects ?? []).length > 2 && (
            <span>+{(teacher.subjects ?? []).length - 2}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CareerDirectory() {
  const { career = "" } = useParams();
  const teachersQuery = useQuery({
    queryKey: ["teachers", career],
    queryFn: () => api.teachers({ career }),
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", career],
    queryFn: () => api.subjects(career),
  });
  const [subjectSearch, setSubjectSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [semesterSelection, setSemesterSelection] = useState<SemesterSelection>(
    () => readSemesterSelection(career),
  );
  const teachers = teachersQuery.data?.teachers ?? [];
  const subjects = subjectsQuery.data?.subjects ?? [];
  const error = teachersQuery.error ?? subjectsQuery.error;
  const isPending = teachersQuery.isPending || subjectsQuery.isPending;
  const groups = useMemo(() => {
    const subjectTerm = searchKey(subjectSearch);
    const teacherTerm = searchKey(teacherSearch);
    return subjects
      .filter((subject) => semesterMatches(semesterSelection, subject.semester))
      .filter(
        (subject) =>
          !subjectTerm || searchKey(subject.name).includes(subjectTerm),
      )
      .map((subject) => ({
        subject,
        teachers: teachers.filter(
          (teacher) =>
            searchKey(teacher.display_name).includes(teacherTerm) &&
            (teacher.subjects ?? []).some((item) => item.id === subject.id),
        ),
      }))
      .filter((group) => group.teachers.length);
  }, [subjects, teachers, subjectSearch, teacherSearch, semesterSelection]);
  return (
    <div className="container page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CARRERA</div>
          <h1>{careerName(career)}</h1>
          <p>Docentes que dan o han dado clases en esta carrera.</p>
        </div>
      </div>
      <div className="directory-filters">
        <label className="search-box">
          <Search size={19} strokeWidth={1.8} aria-hidden="true" />
          <input
            value={subjectSearch}
            onChange={(event) => setSubjectSearch(event.target.value)}
            placeholder="Buscar materia..."
            aria-label="Buscar materia"
          />
        </label>
        <label className="search-box">
          <Search size={19} strokeWidth={1.8} aria-hidden="true" />
          <input
            value={teacherSearch}
            onChange={(event) => setTeacherSearch(event.target.value)}
            placeholder="Buscar docente..."
            aria-label="Buscar docente"
          />
        </label>
        <SemesterPicker
          value={semesterSelection}
          onChange={(value) => {
            setSemesterSelection(value);
            saveSemesterSelection(career, value);
          }}
        />
      </div>
      {error ? (
        <ErrorMessage message={error.message} />
      ) : isPending ? (
        <Loading />
      ) : !teachers.length ? (
        <div className="empty-panel">
          Todavía no hay datos Mindbox importados para esta carrera.
        </div>
      ) : !groups.length ? (
        <div className="state">
          No encontramos materias o docentes con estos filtros.
        </div>
      ) : (
        <div className="subject-sections">
          {groups.map((group) => (
            <section className="subject-section" key={group.subject.id}>
              <div className="subject-heading">
                <div>
                  <span>SEMESTRE {group.subject.semester}</span>
                  <h2>
                    {group.subject.course_code && (
                      <code>{group.subject.course_code}</code>
                    )}
                    {group.subject.name}
                  </h2>
                </div>
                <small>{group.teachers.length} docentes</small>
              </div>
              <div className="teacher-grid">
                {group.teachers.map((teacher) => (
                  <TeacherCard key={teacher.id} teacher={teacher} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
type SemesterSelection = "all" | "none" | number[];
const SEMESTERS = Array.from({ length: 12 }, (_, index) => index + 1);
function semesterStorageKey(career: string) {
  return `horariostec:semester-filter:${career}`;
}
function readSemesterSelection(career: string): SemesterSelection {
  try {
    const stored = window.localStorage.getItem(semesterStorageKey(career));
    if (stored === "all" || stored === "none") return stored;
    const parsed = JSON.parse(stored ?? "null");
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (value) =>
          Number.isInteger(value) && value >= 1 && value <= SEMESTERS.length,
      )
    )
      return parsed;
  } catch {
    /* Use the default filter when storage is unavailable. */
  }
  return "all";
}
function saveSemesterSelection(career: string, selection: SemesterSelection) {
  try {
    window.localStorage.setItem(
      semesterStorageKey(career),
      JSON.stringify(selection),
    );
  } catch {
    /* Filtering still works when storage is unavailable. */
  }
}
function semesterMatches(selection: SemesterSelection, semester: number) {
  return (
    selection === "all" ||
    (Array.isArray(selection) && selection.includes(semester))
  );
}
function searchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .trim();
}
function SemesterPicker({
  value,
  onChange,
}: {
  value: SemesterSelection;
  onChange: (value: SemesterSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    value === "all"
      ? new Set(SEMESTERS)
      : value === "none"
        ? new Set<number>()
        : new Set(value);
  const label =
    value === "all"
      ? "Todos"
      : value === "none"
        ? "Ninguno"
        : value.length === 1
          ? `${value[0]}°`
          : `${value.length} semestres`;
  const toggle = (semester: number) => {
    const next = new Set(selected);
    if (next.has(semester)) next.delete(semester);
    else next.add(semester);
    onChange(
      next.size === 0
        ? "none"
        : next.size === SEMESTERS.length
          ? "all"
          : [...next].sort((a, b) => a - b),
    );
  };
  return (
    <div className="semester-select semester-picker">
      <span>Semestre</span>
      <button
        type="button"
        className="semester-picker-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <b>⌄</b>
      </button>
      {open && (
        <div className="semester-menu" role="menu">
          <div className="semester-menu-actions">
            <button type="button" onClick={() => onChange("all")}>
              Todos
            </button>
            <button type="button" onClick={() => onChange("none")}>
              Ninguno
            </button>
          </div>
          {SEMESTERS.map((semester) => (
            <label key={semester} className="semester-option">
              <input
                type="checkbox"
                checked={selected.has(semester)}
                onChange={() => toggle(semester)}
              />
              <span>{semester}°</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
function careerName(slug: string) {
  return (
    {
      sistemas: "Sistemas",
      mecatronica: "Mecatrónica",
      mecanica: "Mecánica",
      industrial: "Industrial",
      electrica: "Eléctrica",
      electronica: "Electrónica",
      gestion: "Gestión Empresarial",
      materiales: "Materiales",
    }[slug] ?? slug
  );
}

function TeacherPage() {
  const { id = "" } = useParams();
  const teacherQuery = useQuery({
    queryKey: ["teacher", id],
    queryFn: () => api.teacher(id),
  });
  const evaluationsQuery = useQuery({
    queryKey: ["evaluations", id],
    queryFn: () => api.evaluations(id),
  });
  const legacyQuery = useQuery({
    queryKey: ["legacy", id],
    queryFn: () => api.legacy(id),
  });
  const teacher = teacherQuery.data?.teacher ?? null;
  const summary = teacherQuery.data?.summary ?? {};
  const evaluations = evaluationsQuery.data?.evaluations ?? [];
  const legacy = legacyQuery.data ?? null;
  if (teacherQuery.error)
    return (
      <div className="container page">
        <ErrorMessage message={teacherQuery.error.message} />
      </div>
    );
  if (!teacher)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  const legacyComments = legacy?.comments ?? [];
  return (
    <div className="container page teacher-page">
      <Link to="/docentes" className="back-link">
        ← Volver al directorio
      </Link>
      <section className="profile-header">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            {teacher.display_name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
          </div>
          <div>
            <div className="eyebrow">PERFIL DOCENTE</div>
            <h1>{teacher.display_name}</h1>
            <p className="muted">
              Información basada en la experiencia de estudiantes.
            </p>
          </div>
        </div>
        <Link className="button button-dark" to={`/docentes/${id}/evaluar`}>
          Evaluar docente
        </Link>
      </section>
      {evaluationsQuery.error && (
        <ErrorMessage
          message={`No pudimos cargar las evaluaciones: ${evaluationsQuery.error.message}`}
        />
      )}
      {legacyQuery.error && (
        <ErrorMessage
          message={`No pudimos cargar las reseñas históricas: ${legacyQuery.error.message}`}
        />
      )}
      <div className="profile-panels">
        <CurrentPanel summary={summary} evaluationCount={evaluations.length} />
        <LegacyPanel legacy={legacy} />
      </div>
      <NewReviews evaluations={evaluations} />
      <TeacherSubjects teacher={teacher} />
      <CombinedComments
        evaluations={evaluations}
        legacyComments={legacyComments}
      />
    </div>
  );
}
function TeacherSubjects({ teacher }: { teacher: Teacher }) {
  const grouped = new Map<
    string,
    Array<{ name: string; semester: number; course_code?: string | null }>
  >();
  (teacher.subjects ?? []).forEach((subject) => {
    const career = subject.career
      ? careerName(subject.career)
      : "Otras materias";
    const list = grouped.get(career) ?? [];
    if (
      !list.some(
        (item) =>
          item.name === subject.name && item.semester === subject.semester,
      )
    )
      list.push({
        name: subject.name,
        semester: subject.semester,
        course_code: subject.course_code,
      });
    grouped.set(career, list);
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  return (
    <section
      className={
        sectionCollapsed
          ? "section-block teacher-subjects collapsed"
          : "section-block teacher-subjects"
      }
    >
      <div className="section-title">
        <div>
          <span className="section-kicker">03 / TRAYECTORIA</span>
          <h2>Materias</h2>
        </div>
        <div className="section-title-actions">
          <span className="section-caption">Según el catálogo histórico</span>
          <button
            type="button"
            className="section-collapse-button"
            onClick={() => setSectionCollapsed((current) => !current)}
            aria-expanded={!sectionCollapsed}
            aria-label={
              sectionCollapsed ? "Expandir materias" : "Colapsar materias"
            }
          >
            {sectionCollapsed ? (
              <ChevronDown size={19} />
            ) : (
              <ChevronUp size={19} />
            )}
          </button>
        </div>
      </div>
      {!sectionCollapsed &&
        (grouped.size ? (
          <div className="subject-history">
            {[...grouped].map(([career, subjects]) => (
              <div
                className={
                  collapsed[career]
                    ? "subject-history-group collapsed"
                    : "subject-history-group"
                }
                key={career}
              >
                <button
                  type="button"
                  className="subject-history-toggle"
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [career]: !current[career],
                    }))
                  }
                  aria-expanded={!collapsed[career]}
                >
                  <h3>{career}</h3>
                  <span>
                    {collapsed[career] ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronUp size={18} />
                    )}
                  </span>
                </button>
                {!collapsed[career] && (
                  <div>
                    {subjects
                      .sort(
                        (a, b) =>
                          a.semester - b.semester ||
                          a.name.localeCompare(b.name, "es"),
                      )
                      .map((subject) => (
                        <span
                          className="history-pill"
                          key={`${career}-${subject.semester}-${subject.name}`}
                        >
                          <small>{subject.semester}°</small>
                          {subject.course_code && (
                            <em>{subject.course_code}</em>
                          )}
                          {subject.name}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            No hay materias históricas disponibles.
          </div>
        ))}
    </section>
  );
}
function averageAnswer(evaluations: Evaluation[], key: string) {
  const values = evaluations
    .map((evaluation) => evaluation.answers?.[key])
    .filter((value): value is number => typeof value === "number");
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}
function ReviewAverage({
  label,
  value,
  suffix,
  scale,
}: {
  label: string;
  value: number | null;
  suffix: string;
  scale: 5 | 100;
}) {
  return (
    <div className="review-average">
      <span>{label}</span>
      <strong>
        {value == null ? "—" : value.toFixed(1)}
        <small>{value == null ? "Sin datos" : suffix}</small>
      </strong>
      <i
        className={
          value == null
            ? "unknown"
            : value <= scale * 0.3
              ? "red"
              : value <= scale * 0.7
                ? "yellow"
                : "green"
        }
      />
    </div>
  );
}
function NewReviews({ evaluations }: { evaluations: Evaluation[] }) {
  const method = [
    ["Asistencia", "attendance_weight"],
    ["Actividades o tareas", "assignments_weight"],
    ["Exámenes", "exams_weight"],
    ["Proyectos", "projects_weight"],
  ] as const;
  const experience = [
    ["Califica de manera justa", "fairness"],
    ["Explica bien los temas", "explains"],
    ["Tiene buena actitud", "attitude"],
    ["Es accesible", "accessibility"],
    ["Es difícil pasar su materia", "difficulty"],
  ] as const;
  return (
    <section className="section-block new-reviews-block">
      <div className="section-title">
        <div>
          <span className="section-kicker">03 / RESEÑAS</span>
          <h2>Detalles de reseñas</h2>
        </div>
        <span className="section-caption">
          Promedios de las reseñas publicadas
        </span>
      </div>
      {evaluations.length ? (
        <div className="review-average-groups">
          <div>
            <h3>Método de evaluación</h3>
            <div className="review-average-grid">
              {method.map(([label, key]) => (
                <ReviewAverage
                  key={key}
                  label={label}
                  value={averageAnswer(evaluations, key)}
                  suffix="/100"
                  scale={100}
                />
              ))}
            </div>
          </div>
          <div>
            <h3>Sobre el docente</h3>
            <div className="review-average-grid">
              {experience.map(([label, key]) => (
                <ReviewAverage
                  key={key}
                  label={label}
                  value={averageAnswer(evaluations, key)}
                  suffix="/5"
                  scale={5}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-panel">Todavía no hay reseñas nuevas.</div>
      )}
    </section>
  );
}
function CombinedComments({
  evaluations,
  legacyComments,
}: {
  evaluations: Evaluation[];
  legacyComments: Legacy["comments"];
}) {
  const comments = [
    ...evaluations.filter((evaluation) => evaluation.comment),
    ...legacyComments,
  ].sort((a, b) => {
    const aDate = "created_at" in a ? a.created_at : (a.published_at ?? "");
    const bDate = "created_at" in b ? b.created_at : (b.published_at ?? "");
    return bDate.localeCompare(aDate);
  });
  return (
    <section className="section-block comments-block">
      <div className="section-title">
        <div>
          <span className="section-kicker">04 / COMENTARIOS</span>
          <h2>Comentarios</h2>
        </div>
        <span className="section-caption">
          Experiencias compartidas por estudiantes
        </span>
      </div>
      {comments.length ? (
        <div className="comments-list">
          {comments.map((comment, index) =>
            "created_at" in comment ? (
              <EvaluationCard
                key={`evaluation-${comment.id}-${index}`}
                evaluation={comment}
              />
            ) : (
              <LegacyComment
                key={`legacy-${comment.id}-${index}`}
                comment={comment}
              />
            ),
          )}
        </div>
      ) : (
        <div className="empty-panel">Todavía no hay comentarios.</div>
      )}
    </section>
  );
}
function CurrentPanel({
  summary,
  evaluationCount,
}: {
  summary: Record<string, number | null>;
  evaluationCount: number;
}) {
  return (
    <section className="profile-panel current-panel">
      <div className="panel-label">01 / RESEÑAS NUEVAS</div>
      <h2>Reseñas nuevas</h2>
      <p className="panel-copy">Opiniones publicadas en HorariosTec.</p>
      <div className="panel-metrics">
        <Metric
          label="Calificación global"
          value={summary.absolute_global_rating}
          suffix="/100"
          featured
        />
        <Metric
          label="Calidad docente"
          value={summary.quality_average}
          suffix="/5"
        />
        <Metric
          label="Dificultad"
          value={summary.difficulty_average}
          suffix="/5"
        />
      </div>
      <span className="panel-count">{evaluationCount} evaluaciones</span>
    </section>
  );
}
function LegacyPanel({ legacy }: { legacy: Legacy | null }) {
  const summary = legacy?.summary;
  return (
    <section className="profile-panel legacy-panel">
      <div className="panel-label">02 / RESEÑAS HAZTUHORARIO</div>
      <div className="panel-heading-row">
        <h2>Reseñas HazTuHorario</h2>
      </div>
      <p className="panel-copy">Datos extraídos de la plataforma original.</p>
      {summary ? (
        <>
          <div className="panel-metrics">
            <Metric
              label="Calificación general"
              value={summary.general_score}
              suffix="/100"
              featured
            />
            <Metric
              label="Califica justamente"
              value={summary.fair_percent}
              suffix="%"
            />
            <Metric
              label="Explica bien"
              value={summary.explains_well_percent}
              suffix="%"
            />
            <Metric
              label="Toma asistencia"
              value={summary.attendance_percent}
              suffix="%"
            />
          </div>
          <span className="panel-count">{summary.review_count} reseñas</span>
        </>
      ) : (
        <span className="muted">No hay datos.</span>
      )}
    </section>
  );
}
function Metric({
  label,
  value,
  suffix,
  featured = false,
}: {
  label: string;
  value?: number | null;
  suffix: string;
  featured?: boolean;
}) {
  const tone =
    value == null
      ? "unknown"
      : value <= 30
        ? "red"
        : value <= 70
          ? "yellow"
          : "green";
  return (
    <div
      className={`metric metric-${tone}${featured ? " metric-featured" : ""}`}
    >
      <span>{label}</span>
      <strong>{value == null ? "—" : value}</strong>
      <small>{value == null ? "Sin datos" : suffix}</small>
    </div>
  );
}
function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <article className="review-card">
      <div className="review-meta">
        <time>
          {new Date(evaluation.created_at).toLocaleDateString("es-MX")}
        </time>
      </div>
      <div className="review-score">
        {evaluation.global_rating}
        <small>/100</small>
      </div>
      {evaluation.comment && <p>{evaluation.comment}</p>}
      <div className="review-actions">
        <CommentVotes
          source="evaluation"
          commentId={evaluation.id}
          likeCount={evaluation.like_count}
          dislikeCount={evaluation.dislike_count}
        />
      </div>
    </article>
  );
}
function LegacyComment({ comment }: { comment: Legacy["comments"][number] }) {
  return (
    <article className="review-card legacy-review">
      <div className="review-meta">
        <span className="comment-mark" aria-hidden="true">
          ✦
        </span>
        <time>
          {comment.published_at
            ? new Date(comment.published_at).toLocaleDateString("es-MX")
            : "Fecha no disponible"}
        </time>
      </div>
      <p>{comment.body}</p>
      <div className="review-actions">
        <CommentVotes
          source="legacy"
          commentId={comment.id}
          likeCount={comment.like_count}
          dislikeCount={comment.dislike_count}
        />
      </div>
    </article>
  );
}

type VoteChoice = "like" | "dislike";
function anonymousVoterId() {
  if (typeof window === "undefined") return "local-voter-placeholder";
  const key = "horariostec:anonymous-voter";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return "local-voter-fallback";
  }
}
function CommentVotes({
  source,
  commentId,
  likeCount = 0,
  dislikeCount = 0,
}: {
  source: "evaluation" | "legacy";
  commentId: number;
  likeCount?: number;
  dislikeCount?: number;
}) {
  const preferenceKey = `horariostec:comment-vote:${source}:${commentId}`;
  const [selected, setSelected] = useState<VoteChoice | null>(() => {
    try {
      const stored = window.localStorage.getItem(preferenceKey);
      return stored === "like" || stored === "dislike" ? stored : null;
    } catch {
      return null;
    }
  });
  const [counts, setCounts] = useState({
    like: likeCount,
    dislike: dislikeCount,
  });
  const voteMutation = useMutation({
    mutationFn: (vote: "like" | "dislike" | "remove") =>
      api.voteComment(source, commentId, anonymousVoterId(), vote),
    onSuccess: (result) => {
      setCounts({ like: result.like_count, dislike: result.dislike_count });
      const active =
        result.vote === "like" || result.vote === "dislike"
          ? result.vote
          : null;
      setSelected(active);
      if (active) window.localStorage.setItem(preferenceKey, active);
      else window.localStorage.removeItem(preferenceKey);
    },
  });
  const vote = (choice: VoteChoice) => {
    if (voteMutation.isPending) return;
    voteMutation.mutate(selected === choice ? "remove" : choice);
  };
  return (
    <div className="comment-votes" aria-label="Valorar comentario">
      <button
        type="button"
        className={selected === "like" ? "vote-button selected" : "vote-button"}
        onClick={() => void vote("like")}
        disabled={voteMutation.isPending}
        aria-pressed={selected === "like"}
        aria-label="Me gusta"
      >
        <ThumbsUp size={15} strokeWidth={1.8} />
        <span>{counts.like}</span>
      </button>
      <button
        type="button"
        className={
          selected === "dislike"
            ? "vote-button selected dislike"
            : "vote-button dislike"
        }
        onClick={() => void vote("dislike")}
        disabled={voteMutation.isPending}
        aria-pressed={selected === "dislike"}
        aria-label="No me gusta"
      >
        <ThumbsDown size={15} strokeWidth={1.8} />
        <span>{counts.dislike}</span>
      </button>
    </div>
  );
}

function Evaluate() {
  const { id = "" } = useParams();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    subject_id: "",
    global_rating: "",
    attendance_weight: "",
    assignments_weight: "",
    exams_weight: "",
    projects_weight: "",
    fairness: "",
    explains: "",
    attitude: "",
    accessibility: "",
    difficulty: "",
    comment: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api
      .teacher(id)
      .then((data) => setTeacher(data.teacher))
      .catch((e) => setMessage(e.message));
  }, [id]);
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const answers: Record<string, number> = {};
    for (const key of [
      "attendance_weight",
      "assignments_weight",
      "exams_weight",
      "projects_weight",
      "fairness",
      "explains",
      "attitude",
      "accessibility",
      "difficulty",
    ])
      if (form[key]) answers[key] = Number(form[key]);
    try {
      await api.submitEvaluation(id, {
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        global_rating: Number(form.global_rating),
        answers,
        comment: form.comment || null,
      });
      setMessage("Tu evaluación se publicó correctamente.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos guardar tu evaluación.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (!teacher)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  return (
    <div className="container page form-page">
      <Link to={`/docentes/${id}`} className="back-link">
        ← Volver al perfil
      </Link>
      <div className="form-heading">
        <div className="eyebrow">COMPARTE TU EXPERIENCIA</div>
        <h1>Evalúa a {teacher.display_name}</h1>
        <p>Tu evaluación será anónima y visible inmediatamente.</p>
      </div>
      <form onSubmit={submit} className="evaluation-form">
        <FormSection
          title="Contexto"
          note="Puedes evaluar al docente en general o elegir una materia específica."
        >
          <div className="field">
            <label htmlFor="subject_id">Esta evaluación corresponde a</label>
            <select
              id="subject_id"
              value={form.subject_id}
              onChange={(e) => update("subject_id", e.target.value)}
            >
              <option value="">Todas sus materias</option>
              {(teacher.subjects ?? []).map((subject) => (
                <option
                  key={`${subject.career}-${subject.id}`}
                  value={subject.id}
                >
                  {subject.name}
                  {subject.career ? ` · ${careerName(subject.career)}` : ""}
                </option>
              ))}
            </select>
          </div>
        </FormSection>
        <FormSection title="Calificación global" note="Muy mala · Excelente">
          <div className="field">
            <label htmlFor="global_rating">
              ¿Cómo calificarías tu experiencia general?
            </label>
            <input
              id="global_rating"
              type="number"
              min="0"
              max="100"
              required
              value={form.global_rating}
              onChange={(e) => update("global_rating", e.target.value)}
              placeholder="0 — 100"
            />
          </div>
        </FormSection>
        <FormSection
          title="Método de evaluación"
          note="Porcentajes aproximados; no necesitan sumar 100%"
        >
          <div className="field-grid">
            {[
              ["attendance_weight", "Asistencia"],
              ["assignments_weight", "Actividades o tareas"],
              ["exams_weight", "Exámenes"],
              ["projects_weight", "Proyectos"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="number"
                  min="0"
                  max="100"
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder="%"
                />
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection
          title="Sobre el docente"
          note="Selecciona una calificación del 1 al 5"
        >
          <div className="field-grid">
            {[
              ["fairness", "Califica de manera justa"],
              ["explains", "Explica bien los temas"],
              ["attitude", "Tiene buena actitud"],
              ["accessibility", "Es accesible"],
              ["difficulty", "Es difícil pasar su materia"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <select
                  id={key}
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection title="Comentario" note="Opcional">
          <textarea
            maxLength={1000}
            value={form.comment}
            onChange={(e) => update("comment", e.target.value)}
            placeholder="¿Qué te gustaría contarle a otros estudiantes?"
          />
        </FormSection>
        {message && (
          <div
            className={
              message.includes("correctamente") ? "form-success" : "form-error"
            }
          >
            {message}
          </div>
        )}
        <button className="button button-dark submit-button" disabled={saving}>
          {saving ? "Guardando..." : "Publicar evaluación"}
        </button>
      </form>
    </div>
  );
}
function FormSection({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <p className="field-note">{note}</p>
      {children}
    </fieldset>
  );
}
function AgreementScale({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="agreement-field">
      <div className="agreement-label">
        <span>
          {label} <b>*</b>
        </span>
        <output>{value ? `${value}/5` : "?/5"}</output>
      </div>
      <div className="agreement-scale">
        <div className="agreement-options">
          {[1, 2, 3, 4, 5].map((option) => (
            <label
              key={option}
              className={`agreement-option option-${option}`}
              title={`${option} de 5`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={value === String(option)}
                onChange={(event) => onChange(event.target.value)}
                required
              />
              <span aria-label={`${option} de 5`} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
function SubjectPicker({
  subjects,
  value,
  onChange,
}: {
  subjects: NonNullable<Teacher["subjects"]>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = subjects.find((subject) => String(subject.id) === value);
  return (
    <div className="subject-picker">
      <button
        type="button"
        className="subject-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.name ?? "Todas sus materias"}</span>
        <b>⌄</b>
      </button>
      {open && (
        <div className="subject-picker-menu" role="listbox">
          <button
            type="button"
            className={!value ? "selected" : ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Todas sus materias
          </button>
          {subjects.map((subject) => (
            <button
              type="button"
              className={String(subject.id) === value ? "selected" : ""}
              key={`${subject.career}-${subject.id}`}
              onClick={() => {
                onChange(String(subject.id));
                setOpen(false);
              }}
            >
              {subject.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function EvaluationForm() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ["teacher", id],
    queryFn: () => api.teacher(id),
  });
  const teacher = data?.teacher ?? null;

  const [form, setForm] = useState<Record<string, string>>({
    subject_id: "",
    global_rating: "50",
    attendance_weight: "50",
    assignments_weight: "50",
    exams_weight: "50",
    projects_weight: "50",
    fairness: "",
    explains: "",
    attitude: "",
    accessibility: "",
    difficulty: "",
    comment: "",
  });
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submitEvaluation = useMutation({
    mutationFn: () => {
      const answers: Record<string, number> = {};
      for (const key of [
        "attendance_weight",
        "assignments_weight",
        "exams_weight",
        "projects_weight",
        "fairness",
        "explains",
        "attitude",
        "accessibility",
        "difficulty",
      ])
        if (form[key]) answers[key] = Number(form[key]);
      return api.submitEvaluation(id, {
        subject_id: form.subject_id ? Number(form.subject_id) : null,
        global_rating: Number(form.global_rating),
        answers,
        comment: form.comment || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["teacher", id],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["evaluations", id],
          exact: true,
        }),
      ]);
      navigate(`/docentes/${id}`);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (submitEvaluation.isPending) return;
    submitEvaluation.mutate();
  };
  if (error)
    return (
      <div className="container page">
        <ErrorMessage message={error.message} />
      </div>
    );
  if (isPending || !teacher)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  return (
    <div className="container page form-page">
      <div className="form-heading">
        <div className="eyebrow">COMPARTE TU EXPERIENCIA</div>
        <h1>Evalúa a {teacher.display_name}</h1>
        <p>Los campos con * son obligatorios. Tu evaluación será anónima.</p>
      </div>
      <form onSubmit={submit} className="evaluation-form">
        <FormSection
          title="Contexto"
          note="Puedes evaluar al docente en general o elegir una materia específica."
        >
          <div className="field">
            <label htmlFor="subject_id">Esta evaluación corresponde a</label>
            <SubjectPicker
              subjects={teacher.subjects ?? []}
              value={form.subject_id}
              onChange={(value) => update("subject_id", value)}
            />
          </div>
        </FormSection>
        <FormSection title="Calificación global" note="">
          <div className="range-field">
            <div className="range-heading">
              <label htmlFor="global_rating">
                ¿Cómo calificarías tu experiencia general? <b>*</b>
              </label>
              <output>
                {form.global_rating}
                <small>/100</small>
              </output>
            </div>
            <div className="range-endpoints">
              <span>Muy mala</span>
              <span>Excelente</span>
            </div>
            <input
              id="global_rating"
              className="range-input"
              type="range"
              min="0"
              max="100"
              value={form.global_rating}
              onChange={(e) => update("global_rating", e.target.value)}
              required
            />
          </div>
        </FormSection>
        <FormSection
          title="Método de evaluación"
          note="¿Qué tanto toma en cuenta los siguientes apartados?"
        >
          <div className="weight-grid">
            {[
              ["attendance_weight", "Asistencia"],
              ["assignments_weight", "Actividades o tareas"],
              ["exams_weight", "Exámenes"],
              ["projects_weight", "Proyectos"],
            ].map(([key, label]) => (
              <div className="range-field" key={key}>
                <div className="range-heading">
                  <label htmlFor={key}>{label}</label>
                  <output>
                    {form[key]}
                    <small>%</small>
                  </output>
                </div>
                <input
                  id={key}
                  className="range-input"
                  type="range"
                  min="0"
                  max="100"
                  value={form[key]}
                  onChange={(e) => update(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection
          title="Sobre el docente"
          note="Selecciona una opción en cada afirmación"
        >
          <div className="agreement-legend">
            <span>Nada de acuerdo</span>
            <span>Completamente de acuerdo</span>
          </div>
          <div className="agreement-grid">
            <AgreementScale
              name="fairness"
              label="Califica de manera justa"
              value={form.fairness}
              onChange={(value) => update("fairness", value)}
            />
            <AgreementScale
              name="explains"
              label="Explica bien los temas"
              value={form.explains}
              onChange={(value) => update("explains", value)}
            />
            <AgreementScale
              name="attitude"
              label="Tiene buena actitud"
              value={form.attitude}
              onChange={(value) => update("attitude", value)}
            />
            <AgreementScale
              name="accessibility"
              label="Es accesible"
              value={form.accessibility}
              onChange={(value) => update("accessibility", value)}
            />
            <AgreementScale
              name="difficulty"
              label="Es difícil pasar su materia"
              value={form.difficulty}
              onChange={(value) => update("difficulty", value)}
            />
          </div>
        </FormSection>
        <FormSection title="Comentario" note="">
          <textarea
            maxLength={1000}
            value={form.comment}
            onChange={(e) => update("comment", e.target.value)}
            placeholder="¿Qué te gustaría contarle a otros estudiantes?"
          />
        </FormSection>
        {submitEvaluation.isError && (
          <div className="form-error">
            {submitEvaluation.error?.message ??
              "No pudimos guardar tu evaluación."}
          </div>
        )}
        <button
          className="button button-dark submit-button"
          disabled={submitEvaluation.isPending}
        >
          {submitEvaluation.isPending ? "Guardando..." : "Publicar evaluación"}
        </button>
      </form>
    </div>
  );
}
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/horario" element={<ScheduleBuilder />} />
        <Route path="/docentes" element={<Teachers />} />
        <Route path="/docentes/carrera/:career" element={<CareerDirectory />} />
        <Route path="/docentes/:id" element={<TeacherPage />} />
        <Route path="/docentes/:id/evaluar" element={<EvaluationForm />} />
        <Route path="/nosotros" element={<Nosotros />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
