import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Bot,
  Boxes,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Cog,
  Cpu,
  Dices,
  Download,
  Factory,
  FileImage,
  FileText,
  GripVertical,
  Layers,
  LockKeyhole,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { api, type Career, type CatalogOffering, type Subject } from "./api";
import { useQuery } from "@tanstack/react-query";

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MAX_RESULTS = 15;
const MAX_TARGET = 10;
const DEFAULT_START = "07:00";
const DEFAULT_END = "22:00";

type Step = 1 | 2 | 3 | 4 | 5;
type Candidate = { offerings: CatalogOffering[]; sortKey: string };
type ExcludedOfferings = Record<string, number[]>;

function exclusionKey(subjectId: number, teacherId: number) {
  return `${subjectId}:${teacherId}`;
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function timeLabel(value: string) {
  return value.slice(0, 5);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function rankList<T>(
  items: T[],
  order: T[],
  key: (item: T) => string | number,
) {
  const positions = new Map(
    order.map((item, index) => [String(key(item)), index]),
  );
  return [...items].sort(
    (a, b) =>
      (positions.get(String(key(a))) ?? 999) -
      (positions.get(String(key(b))) ?? 999),
  );
}

function BuilderLoading() {
  return <div className="state">Cargando información...</div>;
}
function BuilderError({ message }: { message: string }) {
  return (
    <div className="state error-state">
      <strong>Algo no salió bien</strong>
      <span>{message}</span>
    </div>
  );
}

function CareerIcon({ career }: { career: Career }) {
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
  const Icon = icons[career.slug] ?? Boxes;
  return (
    <>
      <span className="career-pattern" aria-hidden="true">
        <Icon className="career-icon" strokeWidth={1.15} />
      </span>
      <span className="career-mark">
        <Icon className="career-icon" strokeWidth={1.6} />
      </span>
    </>
  );
}

function CareerSelection({
  careers,
  onSelect,
}: {
  careers: Career[];
  onSelect: (career: Career) => void;
}) {
  return (
    <div className="container page schedule-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ARMAR HORARIO</div>
          <h1>Elige tu carrera</h1>
          <p>
            Usaremos la oferta disponible para construir opciones compatibles.
          </p>
        </div>
        <span className="heading-rule" />
      </div>
      <div className="career-grid">
        {careers.map((career) => (
          <button
            type="button"
            className={`career-card career-${career.slug} schedule-career-card`}
            key={career.slug}
            onClick={() => onSelect(career)}
          >
            <CareerIcon career={career} />
            <span className="career-card-content">
              <strong>{career.name}</strong>
              <small>
                {career.teacher_count
                  ? `${career.teacher_count} docentes · ${career.subject_count} materias`
                  : "Seleccionar carrera"}
              </small>
            </span>
            <b className="schedule-card-arrow">→</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepHeader({
  step,
  career,
  onBack,
  onStep,
}: {
  step: Step;
  career: Career;
  onBack: () => void;
  onStep: (step: Step) => void;
}) {
  const labels = [
    "Carrera",
    "Materias",
    "Disponibilidad",
    "Prioridades",
    "Resultados",
  ];
  return (
    <>
      <div className="schedule-topline">
        <button
          type="button"
          className="back-link schedule-back"
          onClick={onBack}
        >
          ← Cambiar carrera
        </button>
        <span>{career.name}</span>
      </div>
      <div className="schedule-steps" aria-label="Progreso">
        <div className="schedule-step-count">0{step} / 05</div>
        {labels.map((label, index) => {
          const target = (index + 1) as Step;
          return (
            <button
              type="button"
              className={
                target === step
                  ? "schedule-step active"
                  : target < step
                    ? "schedule-step done"
                    : "schedule-step"
              }
              key={label}
              disabled={target > step}
              onClick={() => onStep(target)}
              aria-current={target === step ? "step" : undefined}
            >
              <i>{index + 1}</i>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function SubjectSelection({
  subjects,
  selected,
  setSelected,
  target,
  setTarget,
  strict,
  setStrict,
  onBack,
  onNext,
}: {
  subjects: Subject[];
  selected: number[];
  setSelected: (ids: number[]) => void;
  target: number;
  setTarget: (value: number) => void;
  strict: boolean;
  setStrict: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const grouped = useMemo(
    () =>
      subjects.reduce<Record<number, Subject[]>>((groups, subject) => {
        (groups[subject.semester] ??= []).push(subject);
        return groups;
      }, {}),
    [subjects],
  );
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 680;
    return Object.fromEntries(
      Object.keys(grouped).map((semester) => [semester, isMobile]),
    );
  });
  const toggle = (id: number) => {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    setSelected(next);
  };
  const strictInvalid = strict && selected.length < target;
  return (
    <div className="container page schedule-page">
      <div className="schedule-heading">
        <div>
          <div className="eyebrow">PASO 02 / RETÍCULA</div>
          <h1>¿Qué quieres cursar?</h1>
          <p>
            Selecciona más materias de las que planeas meter para que podamos
            comparar combinaciones.
          </p>
        </div>
        <div className="schedule-counter">
          <strong>{selected.length}</strong>
          <span>seleccionadas</span>
        </div>
      </div>
      <div className="schedule-selection-bar">
        <label className="field">
          <span>¿Cuántas materias quieres meter?</span>
          <input
            type="number"
            min="1"
            max={MAX_TARGET}
            value={target === 0 ? "" : target}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                setTarget(0);
                return;
              }
              setTarget(Math.max(1, Math.min(MAX_TARGET, Number(raw))));
            }}
            onBlur={() => {
              if (target < 1) setTarget(1);
            }}
          />
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={strict}
            onChange={(event) => setStrict(event.target.checked)}
          />
          <span>
            <strong>Estricto</strong>
            <small>
              ¿El horario debe contener exactamente esa cantidad de materias?
            </small>
          </span>
        </label>
        <button
          type="button"
          className="button button-light surprise-btn"
          data-tooltip="Seleccionar 5-7 materias al azar automáticamente (Fisher-Yates)"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            if (!subjects.length) return;
            const count = Math.min(subjects.length, Math.floor(Math.random() * 3) + 5);
            // Algoritmo Fisher-Yates para barajado insesgado estricto
            const shuffled = [...subjects];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const randomPicked = shuffled.slice(0, count).map((s) => s.id);
            setSelected(randomPicked);
            setTarget(count);
          }}
        >
          <Dices size={16} /> 🎲 Modo Azar
        </button>
      </div>
      <div className="reticula">
        {Object.entries(grouped).map(([semester, items]) => (
          <section
            className={
              collapsed[Number(semester)]
                ? "reticula-semester collapsed"
                : "reticula-semester"
            }
            key={semester}
          >
            <button
              type="button"
              className="reticula-title"
              onClick={() =>
                setCollapsed((current) => ({
                  ...current,
                  [Number(semester)]: !current[Number(semester)],
                }))
              }
            >
              <span>SEMESTRE {semester}</span>
              <small>
                {items.filter((item) => selected.includes(item.id)).length}/
                {items.length}{" "}
                {collapsed[Number(semester)] ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronUp size={16} />
                )}
              </small>
            </button>
            {!collapsed[Number(semester)] && (
              <div className="reticula-grid">
                {items.map((subject) => (
                  <label
                    className={
                      selected.includes(subject.id)
                        ? "reticula-card selected"
                        : "reticula-card"
                    }
                    key={subject.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(subject.id)}
                      onChange={() => toggle(subject.id)}
                    />
                    <span className="reticula-check">✓</span>
                    <span>
                      <strong>
                        {subject.course_code && (
                          <code>{subject.course_code}</code>
                        )}
                        {subject.name}
                      </strong>
                      <small>
                        {subject.credits
                          ? `${subject.credits} créditos`
                          : "Materia del plan"}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="schedule-actions">
        <button className="button button-light" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Volver
        </button>
        <div className="schedule-action-summary">
          <span>
            <b>{selected.length}</b> seleccionadas
          </span>
          <span>
            <b>{target || "—"}</b> deseadas
          </span>
          <label>
            <input
              type="checkbox"
              checked={strict}
              onChange={(event) => setStrict(event.target.checked)}
            />
            <strong>Estricto</strong>
          </label>
          {strictInvalid && (
            <small className="schedule-validation">
              Selecciona al menos {target} materias.
            </small>
          )}
        </div>
        <button
          className="button button-dark"
          type="button"
          disabled={!selected.length || target < 1 || strictInvalid}
          onClick={onNext}
        >
          Continuar <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [hour, minute] = value.split(":");
  return (
    <label className="field time-select">
      <span>{label}</span>
      <div>
        <select
          aria-label={`${label}: hora`}
          value={hour}
          onChange={(event) => onChange(`${event.target.value}:${minute}`)}
        >
          {Array.from({ length: 24 }, (_, index) => (
            <option key={index} value={String(index).padStart(2, "0")}>
              {String(index).padStart(2, "0")}
            </option>
          ))}
        </select>
        <b>:</b>
        <select
          aria-label={`${label}: minutos`}
          value={minute}
          onChange={(event) => onChange(`${hour}:${event.target.value}`)}
        >
          {["00", "15", "30", "45"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function Availability({
  offerings,
  start,
  end,
  setStart,
  setEnd,
  blocked,
  setBlocked,
  includeSaturday,
  setIncludeSaturday,
  onBack,
  onNext,
}: {
  offerings: CatalogOffering[];
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  blocked: string[];
  setBlocked: (value: string[]) => void;
  includeSaturday: boolean;
  setIncludeSaturday: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasSaturday = offerings.some((offering) =>
    offering.meetings.some((meeting) => meeting.day_of_week === 5),
  );
  const slots = useMemo(() => {
    const result: string[] = [];
    for (let value = minutes(start); value < minutes(end); value += 60)
      result.push(
        `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`,
      );
    return result;
  }, [start, end]);
  const validRange = minutes(start) < minutes(end);
  const toggleBlocked = (slot: string) =>
    setBlocked(
      blocked.includes(slot)
        ? blocked.filter((item) => item !== slot)
        : [...blocked, slot],
    );
  return (
    <div className="container page schedule-page">
      <div className="schedule-heading">
        <div>
          <div className="eyebrow">PASO 03 / DISPONIBILIDAD</div>
          <h1>Define tus horas</h1>
          <p>Establece en qué horas te gustaría meter materias.</p>
        </div>
      </div>
      <div className="availability-panel">
        <div className="availability-range">
          <TimeSelect label="Desde" value={start} onChange={setStart} />
          <span className="range-dash">—</span>
          <TimeSelect label="Hasta" value={end} onChange={setEnd} />
        </div>
        <div className="shift-presets">
          <span className="shift-presets-title"><Clock size={15} /> Presets rápidos:</span>
          <div className="shift-presets-buttons">
            <button
              type="button"
              className={start === "07:00" && end === "14:00" ? "shift-btn active" : "shift-btn"}
              onClick={() => { setStart("07:00"); setEnd("14:00"); }}
            >
              🌅 Matutino (07:00–14:00)
            </button>
            <button
              type="button"
              className={start === "14:00" && end === "21:00" ? "shift-btn active" : "shift-btn"}
              onClick={() => { setStart("14:00"); setEnd("21:00"); }}
            >
              🌇 Vespertino (14:00–21:00)
            </button>
            <button
              type="button"
              className={start === "07:00" && end === "22:00" ? "shift-btn active" : "shift-btn"}
              onClick={() => { setStart("07:00"); setEnd("22:00"); }}
            >
              ☀️ Jornada Completa
            </button>
          </div>
        </div>
        {hasSaturday && (
          <label className="toggle-field saturday-toggle">
            <input
              type="checkbox"
              checked={includeSaturday}
              onChange={(event) => setIncludeSaturday(event.target.checked)}
            />
            <span>
              <strong>Tomar en cuenta el sábado</strong>
              <small>Hay materias de esta carrera con clases sabatinas.</small>
            </span>
          </label>
        )}
        <div className="blocked-heading">
          <div>
            <h2>Horas libres</h2>
            <p>Selecciona horas en las que no quieras meter clases.</p>
          </div>
          <span>
            {blocked.length
              ? `${blocked.length} bloque${blocked.length === 1 ? "" : "s"}`
              : "Ninguno"}
          </span>
        </div>
        {validRange ? (
          <div className="blocked-grid">
            {slots.map((slot) => (
              <label
                className={
                  blocked.includes(slot)
                    ? "blocked-slot selected"
                    : "blocked-slot"
                }
                key={slot}
              >
                <input
                  type="checkbox"
                  checked={blocked.includes(slot)}
                  onChange={() => toggleBlocked(slot)}
                />
                <span>{slot}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="form-error">
            La hora inicial debe ser menor que la hora final.
          </div>
        )}
      </div>
      <div className="schedule-actions">
        <button className="button button-light" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Volver
        </button>
        <span className="range-summary">
          <b>Rango disponible</b>
          {start} — {end}
        </span>
        <button
          className="button button-dark"
          type="button"
          disabled={!validRange}
          onClick={onNext}
        >
          Ordenar prioridades <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function ReorderList<T>({
  items,
  getLabel,
  getMeta,
  renderActions,
  onChange,
}: {
  items: T[];
  getLabel: (item: T) => string;
  getMeta?: (item: T) => string;
  renderActions?: (item: T) => ReactNode;
  onChange: (items: T[]) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return (
    <div className="reorder-list">
      {items.map((item, index) => (
        <div
          className={dragged === index ? "reorder-row dragging" : "reorder-row"}
          draggable
          onDragStart={() => setDragged(index)}
          onDragEnd={() => setDragged(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragged !== null) move(dragged, index);
            setDragged(null);
          }}
          key={index}
        >
          <GripVertical size={17} className="drag-icon" aria-hidden="true" />
          <span className="reorder-number">{index + 1}</span>
          <span className="reorder-copy">
            <strong>{getLabel(item)}</strong>
            {getMeta && <small>{getMeta(item)}</small>}
          </span>
          {renderActions?.(item)}
          <span className="reorder-buttons">
            <button
              type="button"
              aria-label="Subir"
              disabled={!index}
              onClick={() => move(index, index - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Bajar"
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
            >
              ↓
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function ExclusionModal({
  subject,
  teacher,
  offerings,
  selected,
  onSave,
  onClose,
}: {
  subject: Subject;
  teacher: CatalogOffering;
  offerings: CatalogOffering[];
  selected: number[];
  onSave: (sectionIds: number[]) => void;
  onClose: () => void;
}) {
  const teacherOfferings = offerings.filter(
    (item) =>
      item.subject_id === subject.id && item.teacher_id === teacher.teacher_id,
  );
  const [draft, setDraft] = useState<Set<number>>(() => new Set(selected));
  const toggle = (sectionId: number) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="exclusion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exclusion-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">EXCLUIR GRUPOS</span>
            <h2 id="exclusion-title">{teacher.teacher}</h2>
            <p>{subject.name}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="modal-toolbar">
          <strong>
            {draft.size} de {teacherOfferings.length} seleccionados
          </strong>
          <div>
            <button
              type="button"
              onClick={() =>
                setDraft(
                  new Set(teacherOfferings.map((item) => item.section_id)),
                )
              }
            >
              Todos
            </button>
            <button type="button" onClick={() => setDraft(new Set())}>
              Ninguno
            </button>
          </div>
        </div>
        <div className="exclusion-list">
          {teacherOfferings.map((item) => (
            <label className="exclusion-option" key={item.section_id}>
              <input
                type="checkbox"
                checked={draft.has(item.section_id)}
                onChange={() => toggle(item.section_id)}
              />
              <span>
                <strong>Grupo {item.group_name ?? "sin grupo"}</strong>
                <small>
                  {item.meetings.length
                    ? item.meetings
                        .map(
                          (meeting) =>
                            `${DAY_NAMES[meeting.day_of_week]} ${timeLabel(meeting.start_time)}–${timeLabel(meeting.end_time)}${meeting.room ? ` · ${meeting.room}` : ""}`,
                        )
                        .join(" · ")
                    : "Sin horario registrado"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-light"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="button button-dark"
            onClick={() => {
              onSave([...draft]);
              onClose();
            }}
          >
            Guardar grupos excluidos
          </button>
        </div>
      </section>
    </div>
  );
}

function Priorities({
  subjects,
  offerings,
  subjectOrder,
  setSubjectOrder,
  teacherOrders,
  setTeacherOrders,
  excludedOfferings,
  setExcludedOfferings,
  onBack,
  onNext,
}: {
  subjects: Subject[];
  offerings: CatalogOffering[];
  subjectOrder: number[];
  setSubjectOrder: (ids: number[]) => void;
  teacherOrders: Record<number, number[]>;
  setTeacherOrders: (orders: Record<number, number[]>) => void;
  excludedOfferings: ExcludedOfferings;
  setExcludedOfferings: (value: ExcludedOfferings) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selectedSubjects = rankList(
    subjects,
    subjectOrder
      .map((id) => subjects.find((subject) => subject.id === id)!)
      .filter(Boolean),
    (subject) => subject.id,
  );
  const bySubject = useMemo(
    () =>
      offerings.reduce<Record<number, CatalogOffering[]>>(
        (groups, offering) => {
          (groups[offering.subject_id] ??= []).push(offering);
          return groups;
        },
        {},
      ),
    [offerings],
  );
  const [modal, setModal] = useState<{
    subject: Subject;
    teacher: CatalogOffering;
  } | null>(null);
  const teacherItems = (subjectId: number) => {
    const seen = new Set<number>();
    return (bySubject[subjectId] ?? []).filter((offering) => {
      if (seen.has(offering.teacher_id)) return false;
      seen.add(offering.teacher_id);
      return true;
    });
  };
  const updateTeachers = (subjectId: number, items: CatalogOffering[]) =>
    setTeacherOrders({
      ...teacherOrders,
      [subjectId]: items.map((item) => item.teacher_id),
    });
  return (
    <div className="container page schedule-page">
      <div className="schedule-heading">
        <div>
          <div className="eyebrow">PASO 04 / PRIORIDADES</div>
          <h1>Ordena tus preferencias</h1>
          <p>Usaremos este orden para crear el mejor horario para ti:</p>
          <ul>
            <li>Ordena de mayor a menor importancia tus materias y maestros.</li>
            <li>
              Excluye grupos que ya se hayan cerrado o con docentes que
              prefieras no llevar clase.
            </li>
          </ul>
        </div>
      </div>
      <section className="priority-section">
        <div className="priority-section-heading">
          <div>
            <span className="section-kicker">01 / MATERIAS</span>
            <h2>Ordena las materias según tus prioridades</h2>
          </div>
          <small>Arrastra o usa las flechas</small>
        </div>
        <ReorderList
          items={selectedSubjects}
          getLabel={(subject) => subject.name}
          getMeta={(subject) =>
            `${subject.credits ?? 0} créditos · ${subject.course_code ?? ""} · semestre ${subject.semester}`
          }
          onChange={(items) => setSubjectOrder(items.map((item) => item.id))}
        />
      </section>
      <section className="priority-section">
        <div className="priority-section-heading">
          <div>
            <span className="section-kicker">02 / DOCENTES</span>
            <h2>Ordena los docentes según tus preferencias</h2>
          </div>
          <small>Por materia</small>
        </div>
        <div className="teacher-priority-sections">
          {selectedSubjects.map((subject) => {
            const items = rankList(
              teacherItems(subject.id),
              (teacherOrders[subject.id] ?? [])
                .map((id) =>
                  teacherItems(subject.id).find(
                    (item) => item.teacher_id === id,
                  )!,
                )
                .filter(Boolean),
              (item) => item.teacher_id,
            );
            return (
              <div className="teacher-priority" key={subject.id}>
                <div className="teacher-priority-title">
                  <strong>{subject.name}</strong>
                  <span>
                    {items.length}{" "}
                    {items.length === 1
                      ? "docente disponible"
                      : "docentes disponibles"}
                  </span>
                </div>
                {items.length ? (
                  <ReorderList
                    items={items}
                    getLabel={(item) => item.teacher}
                    getMeta={(item) => {
                      const excluded =
                        excludedOfferings[
                          exclusionKey(subject.id, item.teacher_id)
                        ]?.length ?? 0;
                      return `${item.teacher_absolute_global_rating == null ? "Sin calificación global" : `Calificación global: ${Math.round(item.teacher_absolute_global_rating)}/100`}${excluded ? ` · ${excluded} grupo${excluded === 1 ? "" : "s"} excluido${excluded === 1 ? "" : "s"}` : ""}`;
                    }}
                    renderActions={(item) => (
                      <button
                        type="button"
                        className="exclude-button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ subject, teacher: item });
                        }}
                      >
                        Excluir grupos
                      </button>
                    )}
                    onChange={(next) => updateTeachers(subject.id, next)}
                  />
                ) : (
                  <div className="empty-panel">
                    No hay docentes disponibles para esta materia.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <div className="schedule-actions">
        <div className="schedule-action-left">
          <button
            className="button button-light"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={17} /> Volver
          </button>
          <span>El orden guardado se usará para puntuar los resultados.</span>
        </div>
        <button className="button button-dark" type="button" onClick={onNext}>
          Generar horarios <ArrowRight size={17} />
        </button>
      </div>
      {modal && (
        <ExclusionModal
          subject={modal.subject}
          teacher={modal.teacher}
          offerings={offerings}
          selected={
            excludedOfferings[
              exclusionKey(modal.subject.id, modal.teacher.teacher_id)
            ] ?? []
          }
          onSave={(sectionIds) => {
            const key = exclusionKey(
              modal.subject.id,
              modal.teacher.teacher_id,
            );
            const next = { ...excludedOfferings };
            if (sectionIds.length) next[key] = sectionIds;
            else delete next[key];
            setExcludedOfferings(next);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function isAllowedOffering(
  offering: CatalogOffering,
  start: number,
  end: number,
  blocked: string[],
  includeSaturday: boolean,
) {
  if (!offering.meetings.length) return false;
  return offering.meetings.every((meeting) => {
    if (meeting.day_of_week === 5 && !includeSaturday) return false;
    if (meeting.day_of_week > 5) return false;
    const meetingStart = minutes(meeting.start_time);
    const meetingEnd = minutes(meeting.end_time);
    return (
      meetingStart >= start &&
      meetingEnd <= end &&
      !blocked.some((slot) =>
        overlaps(meetingStart, meetingEnd, minutes(slot), minutes(slot) + 60),
      )
    );
  });
}

function conflicts(candidate: CatalogOffering, chosen: CatalogOffering[]) {
  return candidate.meetings.some((meeting) =>
    chosen.some((other) =>
      other.meetings.some(
        (otherMeeting) =>
          meeting.day_of_week === otherMeeting.day_of_week &&
          overlaps(
            minutes(meeting.start_time),
            minutes(meeting.end_time),
            minutes(otherMeeting.start_time),
            minutes(otherMeeting.end_time),
          ),
      ),
    ),
  );
}

function compactScheduleRange(
  candidate: CatalogOffering[],
  start: string,
  end: string,
) {
  const meetings = candidate.flatMap((item) => item.meetings);
  if (!meetings.length) return [minutes(start), minutes(end)];
  const first = Math.max(
    minutes(start),
    Math.floor(
      Math.min(...meetings.map((meeting) => minutes(meeting.start_time))) / 60,
    ) * 60,
  );
  const last = Math.min(
    minutes(end),
    Math.ceil(
      Math.max(...meetings.map((meeting) => minutes(meeting.end_time))) / 60,
    ) * 60,
  );
  return [first, Math.max(first + 60, last)];
}

function candidateScore(
  candidate: CatalogOffering[],
  subjectOrder: number[],
  teacherOrders: Record<number, number[]>,
  target: number,
  strict: boolean,
) {
  const selected = new Set(candidate.map((item) => item.subject_id));
  const inclusion = subjectOrder
    .map((id) => (selected.has(id) ? 1 : 0))
    .join("");
  const teacherScore = subjectOrder
    .map((id) => {
      const offering = candidate.find((item) => item.subject_id === id);
      if (!offering) return "999";
      return String(
        (teacherOrders[id] ?? []).indexOf(offering.teacher_id),
      ).padStart(3, "0");
    })
    .join("");
  const ratings = candidate.reduce(
    (sum, item) => sum + (item.teacher_absolute_global_rating ?? 0),
    0,
  );
  const missingFirst = inclusion
    .split("")
    .map((bit) => (bit === "1" ? "0" : "1"))
    .join("");
  return `${strict ? "000" : String(999 - candidate.length).padStart(3, "0")}|${missingFirst}|${teacherScore}|${String(99999 - Math.round(ratings)).padStart(5, "0")}`;
}

function generateSchedules(
  offerings: CatalogOffering[],
  subjectOrder: number[],
  teacherOrders: Record<number, number[]>,
  excludedOfferings: ExcludedOfferings,
  target: number,
  strict: boolean,
  start: string,
  end: string,
  blocked: string[],
  includeSaturday: boolean,
): Candidate[] {
  const excludedSections = new Set(Object.values(excludedOfferings).flat());
  const allowed = offerings.filter(
    (offering) =>
      !excludedSections.has(offering.section_id) &&
      isAllowedOffering(
        offering,
        minutes(start),
        minutes(end),
        blocked,
        includeSaturday,
      ),
  );
  const grouped = new Map<number, CatalogOffering[]>();
  for (const subjectId of subjectOrder)
    grouped.set(
      subjectId,
      rankList(
        allowed.filter((item) => item.subject_id === subjectId),
        (teacherOrders[subjectId] ?? [])
          .map((id) => allowed.find((item) => item.teacher_id === id)!)
          .filter(Boolean),
        (item) => item.teacher_id,
      ),
    );
  const results: Candidate[] = [];
  const visit = (subjectIndex: number, chosen: CatalogOffering[]) => {
    if (results.length >= MAX_RESULTS) return;
    if (chosen.length > target) return;
    if (subjectIndex === subjectOrder.length) {
      if (
        chosen.length &&
        (strict ? chosen.length === target : chosen.length <= target)
      )
        results.push({
          offerings: chosen,
          sortKey: candidateScore(
            chosen,
            subjectOrder,
            teacherOrders,
            target,
            strict,
          ),
        });
      return;
    }
    const remaining = subjectOrder.length - subjectIndex;
    if (strict && chosen.length + remaining < target) return;
    const subjectId = subjectOrder[subjectIndex];
    for (const offering of grouped.get(subjectId) ?? []) {
      if (!conflicts(offering, chosen))
        visit(subjectIndex + 1, [...chosen, offering]);
      if (results.length >= MAX_RESULTS) return;
    }
    if (!strict) visit(subjectIndex + 1, chosen);
  };
  visit(0, []);
  return results.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function ScheduleGrid({
  candidate,
  start,
  end,
}: {
  candidate: CatalogOffering[];
  start: string;
  end: string;
}) {
  const showSaturday = candidate.some((item) =>
    item.meetings.some((meeting) => meeting.day_of_week === 5),
  );
  const days = showSaturday ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
  const [compactStart, compactEnd] = compactScheduleRange(
    candidate,
    start,
    end,
  );
  const slots = Array.from(
    { length: Math.max(1, Math.ceil((compactEnd - compactStart) / 60)) },
    (_, index) => compactStart + index * 60,
  );
  const formatSlot = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const cell = (slot: number, day: number) => {
    const meetings = candidate.flatMap((item) =>
      item.meetings
        .filter((meeting) => meeting.day_of_week === day)
        .map((meeting) => ({ item, meeting })),
    );
    if (
      meetings.some(
        ({ meeting }) =>
          minutes(meeting.start_time) < slot &&
          minutes(meeting.end_time) > slot,
      )
    )
      return null;
    const starts = meetings.filter(
      ({ meeting }) =>
        minutes(meeting.start_time) >= slot &&
        minutes(meeting.start_time) < slot + 60,
    );
    const first = starts[0];
    const span = first
      ? Math.max(
          1,
          Math.ceil(
            (minutes(first.meeting.end_time) -
              minutes(first.meeting.start_time)) /
              60,
          ),
        )
      : undefined;
    return (
      <td rowSpan={span} key={day}>
        {starts.map(({ item, meeting }) => (
          <div
            className={`schedule-table-class schedule-color-${item.subject_id % 8}`}
            style={
              span && span > 1 ? { minHeight: `${span * 45 - 6}px` } : undefined
            }
            key={`${item.section_id}-${meeting.start_time}`}
          >
            <strong>{item.subject}</strong>
            <small>{item.teacher}</small>
          </div>
        ))}
      </td>
    );
  };
  return (
    <div className="schedule-table-wrap">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Hora</th>
            {days.map((day) => (
              <th key={day}>{DAY_NAMES[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <th>{formatSlot(slot)}</th>
              {days.map((day) => cell(slot, day))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultFilter({
  counts,
  value,
  onChange,
  allLabel,
  disabled = false,
}: {
  counts: number[];
  value: "all" | number;
  onChange: (value: "all" | number) => void;
  allLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allOptionLabel =
    allLabel ??
    (counts.length === 1 ? String(counts[0]) : String(counts[0] ?? 0));
  const label = value === "all" ? allOptionLabel : String(value);
  return (
    <div
      className={disabled ? "result-filter disabled-filter" : "result-filter"}
    >
      <span>Materias</span>
      <button
        type="button"
        className="result-filter-button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <ChevronDown size={14} />
      </button>
      {open && !disabled && (
        <div className="result-filter-menu" role="menu">
          <button
            type="button"
            className={value === "all" ? "selected" : ""}
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
          >
            {allOptionLabel}
          </button>
          {counts.map((count) => (
            <button
              type="button"
              className={value === count ? "selected" : ""}
              key={count}
              onClick={() => {
                onChange(count);
                setOpen(false);
              }}
            >
              {count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleReport({
  candidate,
  start,
  end,
  pdf = false,
}: {
  candidate: CatalogOffering[];
  start: string;
  end: string;
  pdf?: boolean;
}) {
  const subjects = [
    ...new Map(candidate.map((item) => [item.subject_id, item])).values(),
  ];
  const details = (
    <div
      className={pdf ? "schedule-report-subjects" : "schedule-preview-subjects"}
    >
      {subjects.map((item) => (
        <div
          className={`${pdf ? "schedule-report-subject" : "schedule-preview-subject"} schedule-color-border-${item.subject_id % 8}`}
          key={item.section_id}
        >
          <strong>
            {item.course_code && <code>{item.course_code}</code>}
            {item.subject}
          </strong>
          <b>
            {item.credits ? `${item.credits} créditos` : "Materia"} ·{" "}
            {item.group_name ? `Grupo ${item.group_name}` : "Sin grupo"}
          </b>
          <small>{item.teacher}</small>
        </div>
      ))}
    </div>
  );
  if (!pdf)
    return (
      <div className="schedule-preview">
        <ScheduleGrid candidate={candidate} start={start} end={end} />
        {details}
      </div>
    );
  return (
    <div className="schedule-report">
      <div className="schedule-report-header">
        <div className="schedule-report-brand">
          <img src="/icon.png" alt="" />
          <div>
            <strong>
              Horarios<span>Tec</span>
            </strong>
          </div>
        </div>
      </div>
      <ScheduleGrid candidate={candidate} start={start} end={end} />
      {details}
      <div className="schedule-report-footer">
        <span>Generado por HorariosTec</span>
        <span>
          {new Date().toLocaleDateString("es-MX")} ·{" "}
          {new Date().toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export type SavedSchedule = {
  id: string;
  name: string;
  createdAt: string;
  careerName: string;
  offerings: CatalogOffering[];
  totalGapsMinutes: number;
};

function computeTotalGapMinutes(offerings: CatalogOffering[]) {
  let totalGaps = 0;
  const meetingsByDay: Record<number, { start: number; end: number }[]> = {};
  offerings
    .flatMap((item) => item.meetings)
    .forEach((m) => {
      (meetingsByDay[m.day_of_week] ??= []).push({
        start: minutes(m.start_time),
        end: minutes(m.end_time),
      });
    });
  Object.values(meetingsByDay).forEach((dayMeetings) => {
    dayMeetings.sort((a, b) => a.start - b.start);
    for (let i = 0; i < dayMeetings.length - 1; i++) {
      const gap = dayMeetings[i + 1].start - dayMeetings[i].end;
      if (gap > 0) totalGaps += gap;
    }
  });
  return totalGaps;
}

async function exportPdf(element: HTMLElement | null) {
  if (!element) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: isDark ? "#0f172a" : "#fffdfb",
    imageTimeout: 0,
  });
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
    compress: true,
  });
  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.97),
    "JPEG",
    0,
    0,
    canvas.width,
    canvas.height,
    undefined,
    "MEDIUM",
  );
  pdf.save("horario-horariostec.pdf");
}

async function exportPng(element: HTMLElement | null, careerName = "horariostec") {
  if (!element) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: isDark ? "#0f172a" : "#fffdfb",
    imageTimeout: 0,
  });
  const link = document.createElement("a");
  link.download = `horario-${careerName.toLowerCase().replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function exportIcs(offerings: CatalogOffering[], careerName = "Tec") {
  if (!offerings.length) return;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HorariosTec//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Horario de Clases - HorariosTec",
    "X-WR-TIMEZONE:America/Mexico_City",
  ];

  const dayMap: Record<number, string> = {
    0: "MO",
    1: "TU",
    2: "WE",
    3: "TH",
    4: "FR",
    5: "SA",
  };

  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7));

  offerings.forEach((offering) => {
    offering.meetings.forEach((meeting) => {
      const dayOffset = meeting.day_of_week;
      const eventDate = new Date(nextMonday);
      eventDate.setDate(nextMonday.getDate() + dayOffset);

      const [sH, sM] = meeting.start_time.split(":").map(Number);
      const [eH, eM] = meeting.end_time.split(":").map(Number);

      const dtStart = new Date(eventDate);
      dtStart.setHours(sH, sM, 0);
      const dtEnd = new Date(eventDate);
      dtEnd.setHours(eH, eM, 0);

      const formatIcsTime = (d: Date) =>
        d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      const byDay = dayMap[meeting.day_of_week] || "MO";

      lines.push(
        "BEGIN:VEVENT",
        `SUMMARY:${offering.subject}`,
        `DESCRIPTION:Docente: ${offering.teacher} \\nGrupo: ${offering.group_name || "Único"}`,
        `LOCATION:${meeting.room || "Aula por asignar"}`,
        `DTSTART:${formatIcsTime(dtStart)}`,
        `DTEND:${formatIcsTime(dtEnd)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
        "END:VEVENT",
      );
    });
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `horario-${careerName.toLowerCase().replace(/\s+/g, "_")}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function CompareSavedModal({
  savedList,
  onRemove,
  onClose,
  start,
  end,
}: {
  savedList: SavedSchedule[];
  onRemove: (id: string) => void;
  onClose: () => void;
  start: string;
  end: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    savedList.slice(0, 2).map((item: SavedSchedule) => item.id),
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev: string[]) =>
      prev.includes(id)
        ? prev.filter((item: string) => item !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  };

  const selectedSchedules = savedList.filter((item: SavedSchedule) =>
    selectedIds.includes(item.id),
  );

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="compare-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <span className="eyebrow">HORARIOS GUARDADOS Y COMPARADOR</span>
            <h2>Tus opciones guardadas ({savedList.length})</h2>
            <p>Selecciona hasta 3 horarios para compararlos lado a lado.</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="saved-chips-list">
          {savedList.map((item: SavedSchedule) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`saved-chip ${isSelected ? "active" : ""}`}
                onClick={() => toggleSelect(item.id)}
              >
                <div className="chip-content">
                  <strong>{item.name}</strong>
                  <small>
                    {item.offerings.length} materias ·{" "}
                    {item.totalGapsMinutes > 0
                      ? `${item.totalGapsMinutes} min libres`
                      : "Sin huecos"}
                  </small>
                </div>
                <button
                  type="button"
                  className="chip-delete"
                  data-tooltip="Eliminar favorito"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {selectedSchedules.length > 0 ? (
          <div
            className="compare-grid"
            style={{
              gridTemplateColumns: `repeat(${selectedSchedules.length}, 1fr)`,
            }}
          >
            {selectedSchedules.map((item: SavedSchedule) => (
              <div className="compare-column" key={item.id}>
                <div className="compare-col-header">
                  <h3>{item.name}</h3>
                  <span>{item.careerName}</span>
                  <div className="compare-stats">
                    <span className="stat-badge">
                      📚 {item.offerings.length} materias
                    </span>
                    <span className="stat-badge">
                      ⏱️ {item.totalGapsMinutes} min libres
                    </span>
                  </div>
                </div>
                <ScheduleGrid
                  candidate={item.offerings}
                  start={start}
                  end={end}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Selecciona al menos 1 horario guardado de la lista para visualizarlo.
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="button button-light"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
}

function Results({
  candidates,
  target,
  strict,
  onStrictChange,
  start,
  end,
  careerName = "Tec",
  onBack,
}: {
  candidates: Candidate[];
  target: number;
  strict: boolean;
  onStrictChange: (value: boolean) => void;
  start: string;
  end: string;
  careerName?: string;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState<"all" | number>("all");
  const [sortMode, setSortMode] = useState<"score" | "gaps" | "earliest" | "latest">("score");
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>(() => {
    try {
      const raw = localStorage.getItem("horariostec_favorites");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [randomNotice, setRandomNotice] = useState<string | null>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const pickRandomCandidate = () => {
    if (visibleCandidates.length > 0) {
      let nextIndex = Math.floor(Math.random() * visibleCandidates.length);
      if (visibleCandidates.length > 1 && nextIndex === index) {
        nextIndex = (nextIndex + 1) % visibleCandidates.length;
      }
      setIndex(nextIndex);
      setRandomNotice(`🎲 ¡Opción #${nextIndex + 1} de ${visibleCandidates.length} elegida al azar!`);
      setTimeout(() => setRandomNotice(null), 3000);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("horariostec_favorites", JSON.stringify(savedSchedules));
    } catch (e) {
      console.error("Failed to save favorites", e);
    }
  }, [savedSchedules]);

  useEffect(() => setIndex(0), [candidates, sortMode]);

  const sortedCandidates = useMemo(() => {
    const list = [...candidates];
    if (sortMode === "gaps") {
      return list.sort(
        (a: Candidate, b: Candidate) => computeTotalGapMinutes(a.offerings) - computeTotalGapMinutes(b.offerings)
      );
    } else if (sortMode === "earliest") {
      return list.sort((a: Candidate, b: Candidate) => {
        const minA = Math.min(...a.offerings.flatMap((i) => i.meetings.map((m) => minutes(m.start_time))));
        const minB = Math.min(...b.offerings.flatMap((i) => i.meetings.map((m) => minutes(m.start_time))));
        return minA - minB;
      });
    } else if (sortMode === "latest") {
      return list.sort((a: Candidate, b: Candidate) => {
        const maxA = Math.max(...a.offerings.flatMap((i) => i.meetings.map((m) => minutes(m.end_time))));
        const maxB = Math.max(...b.offerings.flatMap((i) => i.meetings.map((m) => minutes(m.end_time))));
        return maxB - maxA;
      });
    }
    return list;
  }, [candidates, sortMode]);

  const counts: number[] = [
    ...new Set(sortedCandidates.map((item: Candidate) => item.offerings.length)),
  ].sort((a: number, b: number) => a - b);

  const visibleCandidates =
    subjectFilter === "all"
      ? sortedCandidates
      : sortedCandidates.filter((item: Candidate) => item.offerings.length === subjectFilter);

  const candidate = visibleCandidates[index];

  const currentGaps = candidate ? computeTotalGapMinutes(candidate.offerings) : 0;

  const isSaved = candidate
    ? savedSchedules.some((s: SavedSchedule) => JSON.stringify(s.offerings) === JSON.stringify(candidate.offerings))
    : false;

  const toggleSaveCurrent = () => {
    if (!candidate) return;
    if (isSaved) {
      setSavedSchedules((prev: SavedSchedule[]) =>
        prev.filter((s: SavedSchedule) => JSON.stringify(s.offerings) !== JSON.stringify(candidate.offerings))
      );
    } else {
      const newItem: SavedSchedule = {
        id: Date.now().toString(),
        name: `Horario #${savedSchedules.length + 1} (${candidate.offerings.length} mat.)`,
        createdAt: new Date().toLocaleDateString("es-MX"),
        careerName,
        offerings: candidate.offerings,
        totalGapsMinutes: currentGaps,
      };
      setSavedSchedules((prev: SavedSchedule[]) => [newItem, ...prev]);
    }
  };

  const move = (delta: number) =>
    setIndex((current: number) =>
      visibleCandidates.length
        ? (current + delta + visibleCandidates.length) % visibleCandidates.length
        : 0
    );

  return (
    <div className="container page schedule-page">
      <div className="schedule-heading">
        <div>
          <div className="eyebrow">PASO 05 / RESULTADOS</div>
          <h1>Tus opciones de horario</h1>
          <p>
            {visibleCandidates.length
              ? `${visibleCandidates.length} ${visibleCandidates.length === 1 ? "opción compatible" : "opciones compatibles"} encontradas${subjectFilter === "all" && strict ? ` con ${target} materias` : ""}.`
              : "No encontramos una combinación compatible con este filtro."}
          </p>
        </div>
        <div className="result-tools">
          <div className="sort-filter">
            <span><SlidersHorizontal size={14} /> Orden:</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="result-filter-select"
            >
              <option value="score">🏆 Mejor puntuación</option>
              <option value="gaps">⚡ Menos horas libres</option>
              <option value="earliest">🌅 Clases temprano</option>
              <option value="latest">🌇 Clases tarde</option>
            </select>
          </div>

          <ResultFilter
            counts={counts}
            value={subjectFilter}
            allLabel={String(target)}
            disabled={strict}
            onChange={(value) => {
              setSubjectFilter(value);
              setIndex(0);
            }}
          />

          <label className="result-strict-toggle">
            <input
              type="checkbox"
              checked={strict}
              onChange={(event) => onStrictChange(event.target.checked)}
            />
            <span>
              <strong>Estricto</strong>
              <small>Cantidad exacta</small>
            </span>
          </label>

          {visibleCandidates.length > 1 && (
            <button
              type="button"
              className="button button-light random-btn"
              data-tooltip="Elige una combinación de horario al azar"
              onClick={pickRandomCandidate}
            >
              <Dices size={16} /> Horario al azar
            </button>
          )}

          {savedSchedules.length > 0 && (
            <button
              type="button"
              className="button button-light compare-btn"
              data-tooltip="Compara tus horarios guardados lado a lado"
              onClick={() => setShowCompareModal(true)}
            >
              <Layers size={16} /> Comparar ({savedSchedules.length})
            </button>
          )}
        </div>
      </div>

      {randomNotice && (
        <div className="random-notice-banner">
          <span>{randomNotice}</span>
        </div>
      )}

      {candidate ? (
        <>
          <div className="result-stats-bar">
            <div className="gap-indicator">
              ⏱️ <strong>{currentGaps > 0 ? `${currentGaps} minutos libres` : "0 minutos libres (Horario compacto)"}</strong>
            </div>
            <div className="export-actions">
              <button
                type="button"
                className={`favorite-btn ${isSaved ? "saved" : ""}`}
                data-tooltip={isSaved ? "Quitar de favoritos" : "Guardar este horario en tus favoritos del navegador"}
                onClick={toggleSaveCurrent}
              >
                <Star size={16} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "Guardado en Favoritos" : "Guardar opción"}
              </button>
              <button
                type="button"
                className="button button-light export-btn"
                data-tooltip="Descargar horario como imagen PNG"
                onClick={() => void exportPng(pdfRef.current, `horario-${careerName}`)}
              >
                <FileImage size={16} /> PNG
              </button>
              <button
                type="button"
                className="button button-light export-btn"
                data-tooltip="Descargar reporte oficial en formato PDF"
                onClick={() => void exportPdf(pdfRef.current)}
              >
                <FileText size={16} /> PDF
              </button>
              <button
                type="button"
                className="button button-light export-btn"
                data-tooltip="Exportar archivo .ics para Google Calendar, Apple u Outlook"
                onClick={() => exportIcs(candidate.offerings, careerName)}
              >
                <Calendar size={16} /> Calendario (.ics)
              </button>
            </div>
          </div>

          <div className="result-viewer">
            <div className="result-navigation">
              <button
                type="button"
                className="result-arrow"
                onClick={() => move(-1)}
                aria-label="Horario anterior"
              >
                <ArrowLeft size={19} />
              </button>
              <span>
                <strong>{String(index + 1).padStart(2, "0")}</strong> /{" "}
                {String(visibleCandidates.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                className="result-arrow"
                onClick={() => move(1)}
                aria-label="Siguiente horario"
              >
                <ArrowRight size={19} />
              </button>
            </div>
            <article className="result-card open" ref={scheduleRef}>
              <ScheduleReport
                candidate={candidate.offerings}
                start={start}
                end={end}
              />
            </article>
            <div className="pdf-render-host" ref={pdfRef} aria-hidden="true">
              <ScheduleReport
                candidate={candidate.offerings}
                start={start}
                end={end}
                pdf
              />
            </div>
          </div>
          <div className="schedule-actions result-actions">
            <button
              className="button button-light"
              type="button"
              onClick={onBack}
            >
              <ArrowLeft size={17} /> Volver
            </button>
            <span>Usa las flechas para explorar y comparar horarios.</span>
          </div>
        </>
      ) : (
        <>
          <div className="empty-panel results-empty">
            <strong>Prueba con alguno de estos cambios:</strong>
            <span>
              Amplía tu rango, quita una hora libre, incluye el sábado o desactiva “Cantidad estricta”.
            </span>
          </div>
          <div className="schedule-actions result-actions">
            <button
              className="button button-light"
              type="button"
              onClick={onBack}
            >
              <ArrowLeft size={17} /> Volver
            </button>
          </div>
        </>
      )}

      {showCompareModal && (
        <CompareSavedModal
          savedList={savedSchedules}
          onRemove={(id) => setSavedSchedules((prev) => prev.filter((s) => s.id !== id))}
          onClose={() => setShowCompareModal(false)}
          start={start}
          end={end}
        />
      )}
    </div>
  );
}

export default function ScheduleBuilder() {
  const [career, setCareer] = useState<Career | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState(7);
  const [strict, setStrict] = useState(true);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [includeSaturday, setIncludeSaturday] = useState(true);
  const [subjectOrder, setSubjectOrder] = useState<number[]>([]);
  const [teacherOrders, setTeacherOrders] = useState<Record<number, number[]>>(
    {},
  );
  const [excludedOfferings, setExcludedOfferings] = useState<ExcludedOfferings>(
    {},
  );
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const careersQuery = useQuery({
    queryKey: ["careers"],
    queryFn: api.careers,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", career?.slug ?? ""],
    enabled: !!career,
    queryFn: () => api.subjects(career!.slug),
  });
  const catalogQuery = useQuery({
    queryKey: ["catalog", career?.slug ?? ""],
    enabled: !!career,
    queryFn: () => api.catalog(career!.slug),
  });
  const careers = careersQuery.data?.careers ?? [];
  const subjects = subjectsQuery.data?.subjects ?? [];
  const offerings = catalogQuery.data?.offerings ?? [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const chooseCareer = (next: Career) => {
    setCareer(next);
    setSelected([]);
    setTarget(7);
    setExcludedOfferings({});
    setStep(2);
  };
  const startPriorities = () => {
    const order = [...selected].sort((a, b) => {
      const left = subjects.find((subject) => subject.id === a)!;
      const right = subjects.find((subject) => subject.id === b)!;
      return (
        (right.credits ?? 0) - (left.credits ?? 0) ||
        left.semester - right.semester ||
        left.name.localeCompare(right.name, "es")
      );
    });
    const nextTeachers: Record<number, number[]> = {};
    for (const subjectId of order) {
      const seen = new Set<number>();
      nextTeachers[subjectId] = offerings
        .filter((item) => item.subject_id === subjectId)
        .sort(
          (a, b) =>
            (b.teacher_absolute_global_rating ?? -1) -
              (a.teacher_absolute_global_rating ?? -1) ||
            a.teacher.localeCompare(b.teacher, "es"),
        )
        .filter((item) => {
          if (seen.has(item.teacher_id)) return false;
          seen.add(item.teacher_id);
          return true;
        })
        .map((item) => item.teacher_id);
    }
    setSubjectOrder(order);
    setTeacherOrders(nextTeachers);
    setStep(4);
  };
  const generate = () => {
    setCandidates(
      generateSchedules(
        offerings,
        subjectOrder,
        teacherOrders,
        excludedOfferings,
        target,
        strict,
        start,
        end,
        blocked,
        includeSaturday,
      ),
    );
    setStep(5);
  };
  const changeStrict = (value: boolean) => {
    setStrict(value);
    if (step === 5)
      setCandidates(
        generateSchedules(
          offerings,
          subjectOrder,
          teacherOrders,
          excludedOfferings,
          target,
          value,
          start,
          end,
          blocked,
          includeSaturday,
        ),
      );
  };
  const reset = () => {
    setCareer(null);
    setStep(1);
    setSelected([]);
    setExcludedOfferings({});
    setCandidates([]);
  };
  const directoryError = subjectsQuery.error ?? catalogQuery.error;
  const directoryPending = subjectsQuery.isPending || catalogQuery.isPending;
  if (careersQuery.isPending && !career)
    return (
      <div className="container page">
        <BuilderLoading />
      </div>
    );
  if (careersQuery.error && !career)
    return (
      <div className="container page">
        <BuilderError message={careersQuery.error.message} />
      </div>
    );
  if (!career)
    return (
      <CareerSelection careers={careers} onSelect={chooseCareer} />
    );
  return (
    <>
      <div className="container schedule-shell">
        <StepHeader
          step={step}
          career={career}
          onBack={reset}
          onStep={(next) => (next === 1 ? reset() : setStep(next))}
        />
      </div>
      {directoryError ? (
        <div className="container page">
          <BuilderError message={directoryError.message} />
        </div>
      ) : directoryPending ? (
        <div className="container page">
          <BuilderLoading />
        </div>
      ) : step === 2 ? (
        <SubjectSelection
          subjects={subjects}
          selected={selected}
          setSelected={setSelected}
          target={target}
          setTarget={setTarget}
          strict={strict}
          setStrict={changeStrict}
          onBack={reset}
          onNext={() => setStep(3)}
        />
      ) : step === 3 ? (
        <Availability
          offerings={offerings}
          start={start}
          end={end}
          setStart={setStart}
          setEnd={setEnd}
          blocked={blocked}
          setBlocked={setBlocked}
          includeSaturday={includeSaturday}
          setIncludeSaturday={setIncludeSaturday}
          onBack={() => setStep(2)}
          onNext={startPriorities}
        />
      ) : step === 4 ? (
        <Priorities
          subjects={subjects.filter((subject) => selected.includes(subject.id))}
          offerings={offerings}
          subjectOrder={subjectOrder}
          setSubjectOrder={setSubjectOrder}
          teacherOrders={teacherOrders}
          setTeacherOrders={setTeacherOrders}
          excludedOfferings={excludedOfferings}
          setExcludedOfferings={setExcludedOfferings}
          onBack={() => setStep(3)}
          onNext={generate}
        />
      ) : step === 5 ? (
        <Results
          candidates={candidates}
          target={target}
          strict={strict}
          onStrictChange={changeStrict}
          start={start}
          end={end}
          careerName={career.name}
          onBack={() => setStep(4)}
        />
      ) : null}
    </>
  );
}
