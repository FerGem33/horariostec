import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Bot, Boxes, ChevronDown, ChevronUp, Code2, Cog, Cpu, Download, Factory, GripVertical, Zap, type LucideIcon } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { api, type Career, type CatalogOffering, type Subject } from "./api";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
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

function rankList<T>(items: T[], order: T[], key: (item: T) => string | number) {
  const positions = new Map(order.map((item, index) => [String(key(item)), index]));
  return [...items].sort((a, b) => (positions.get(String(key(a))) ?? 999) - (positions.get(String(key(b))) ?? 999));
}

function BuilderLoading() { return <div className="state">Cargando información...</div>; }
function BuilderError({ message }: { message: string }) { return <div className="state error-state"><strong>Algo no salió bien</strong><span>{message}</span></div>; }

function CareerIcon({ career }: { career: Career }) {
  const icons: Record<string, LucideIcon> = { sistemas: Code2, mecatronica: Bot, mecanica: Cog, industrial: Factory, electrica: Zap, electronica: Cpu, gestion: BriefcaseBusiness, materiales: Boxes };
  const Icon = icons[career.slug] ?? Boxes;
  return <><span className="career-pattern" aria-hidden="true"><Icon className="career-icon" strokeWidth={1.15} /></span><span className="career-mark"><Icon className="career-icon" strokeWidth={1.6} /></span></>;
}

function CareerSelection({ careers, onSelect }: { careers: Career[]; onSelect: (career: Career) => void }) {
  return <div className="container page schedule-page">
    <div className="page-heading"><div><div className="eyebrow">ARMAR HORARIO</div><h1>Elige tu carrera</h1><p>Usaremos la oferta disponible para construir opciones compatibles.</p></div><span className="heading-rule" /></div>
    <div className="career-grid">{careers.map((career) => <button type="button" className={`career-card career-${career.slug} schedule-career-card`} key={career.slug} onClick={() => onSelect(career)}><CareerIcon career={career} /><span className="career-card-content"><strong>{career.name}</strong><small>{career.teacher_count ? `${career.teacher_count} docentes · ${career.subject_count} materias` : "Aún sin datos importados"}</small></span><b className="schedule-card-arrow">→</b></button>)}</div>
  </div>;
}

function StepHeader({ step, career, strict, setStrict, onBack, onStep }: { step: Step; career: Career; strict: boolean; setStrict: (value: boolean) => void; onBack: () => void; onStep: (step: Step) => void }) {
  const labels = ["Carrera", "Materias", "Disponibilidad", "Prioridades", "Resultados"];
  return <><div className="schedule-topline"><button type="button" className="back-link schedule-back" onClick={onBack}>← Cambiar carrera</button><span>{career.name}</span>{step >= 3 && <label className="header-strict-toggle"><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} /><span><strong>Estricto</strong><small>Exactamente {step >= 3 ? "la cantidad elegida" : "N"} de materias</small></span></label>}</div><div className="schedule-steps" aria-label="Progreso"><div className="schedule-step-count">0{step} / 05</div>{labels.map((label, index) => { const target = (index + 1) as Step; return <button type="button" className={target === step ? "schedule-step active" : target < step ? "schedule-step done" : "schedule-step"} key={label} disabled={target > step} onClick={() => onStep(target)} aria-current={target === step ? "step" : undefined}><i>{index + 1}</i><span>{label}</span></button>; })}</div></>;
}

function SubjectSelection({ subjects, selected, setSelected, target, setTarget, strict, setStrict, onBack, onNext }: { subjects: Subject[]; selected: number[]; setSelected: (ids: number[]) => void; target: number; setTarget: (value: number) => void; strict: boolean; setStrict: (value: boolean) => void; onBack: () => void; onNext: () => void }) {
  const grouped = useMemo(() => subjects.reduce<Record<number, Subject[]>>((groups, subject) => { (groups[subject.semester] ??= []).push(subject); return groups; }, {}), [subjects]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() => { const isMobile = typeof window !== "undefined" && window.innerWidth <= 680; return Object.fromEntries(Object.keys(grouped).map((semester) => [semester, isMobile])); });
  const toggle = (id: number) => { const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]; setSelected(next); };
  const strictInvalid = strict && selected.length < target;
  return <div className="container page schedule-page"><div className="schedule-heading"><div><div className="eyebrow">PASO 02 / RETÍCULA</div><h1>¿Qué quieres cursar?</h1><p>Selecciona más materias de las que planeas meter para que podamos comparar combinaciones.</p></div><div className="schedule-counter"><strong>{selected.length}</strong><span>seleccionadas</span></div></div><div className="schedule-selection-bar"><label className="field"><span>Materias que quieres meter</span><input type="number" min="1" max={MAX_TARGET} value={target === 0 ? "" : target} onChange={(event) => { const raw = event.target.value; if (raw === "") { setTarget(0); return; } setTarget(Math.max(1, Math.min(MAX_TARGET, Number(raw)))); }} onBlur={() => { if (target < 1) setTarget(1); }} /></label><label className="toggle-field"><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} /><span><strong>Estricto</strong><small>¿El horario debe contener exactamente esa cantidad de materias?</small></span></label></div><div className="reticula">{Object.entries(grouped).map(([semester, items]) => <section className={collapsed[Number(semester)] ? "reticula-semester collapsed" : "reticula-semester"} key={semester}><button type="button" className="reticula-title" onClick={() => setCollapsed((current) => ({ ...current, [Number(semester)]: !current[Number(semester)] }))}><span>SEMESTRE {semester}</span><small>{items.filter((item) => selected.includes(item.id)).length}/{items.length} {collapsed[Number(semester)] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</small></button>{!collapsed[Number(semester)] && <div className="reticula-grid">{items.map((subject) => <label className={selected.includes(subject.id) ? "reticula-card selected" : "reticula-card"} key={subject.id}><input type="checkbox" checked={selected.includes(subject.id)} onChange={() => toggle(subject.id)} /><span className="reticula-check">✓</span><span><strong>{subject.course_code && <code>{subject.course_code}</code>}{subject.name}</strong><small>{subject.credits ? `${subject.credits} créditos` : "Materia del plan"}</small></span></label>)}</div>}</section>)}</div><div className="schedule-actions"><button className="button button-light" type="button" onClick={onBack}><ArrowLeft size={17} /> Volver</button><div className="schedule-action-summary"><span><b>{selected.length}</b> seleccionadas</span><span><b>{target || "—"}</b> deseadas</span><label><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} /><strong>Estricto</strong></label>{strictInvalid && <small className="schedule-validation">Selecciona al menos {target} materias.</small>}</div><button className="button button-dark" type="button" disabled={!selected.length || target < 1 || strictInvalid} onClick={onNext}>Continuar <ArrowRight size={17} /></button></div></div>;
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [hour, minute] = value.split(":");
  return <label className="field time-select"><span>{label}</span><div><select aria-label={`${label}: hora`} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>{Array.from({ length: 24 }, (_, index) => <option key={index} value={String(index).padStart(2, "0")}>{String(index).padStart(2, "0")}</option>)}</select><b>:</b><select aria-label={`${label}: minutos`} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>{["00", "15", "30", "45"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div></label>;
}

function Availability({ offerings, start, end, setStart, setEnd, blocked, setBlocked, includeSaturday, setIncludeSaturday, onBack, onNext }: { offerings: CatalogOffering[]; start: string; end: string; setStart: (value: string) => void; setEnd: (value: string) => void; blocked: string[]; setBlocked: (value: string[]) => void; includeSaturday: boolean; setIncludeSaturday: (value: boolean) => void; onBack: () => void; onNext: () => void }) {
  const hasSaturday = offerings.some((offering) => offering.meetings.some((meeting) => meeting.day_of_week === 5));
  const slots = useMemo(() => { const result: string[] = []; for (let value = minutes(start); value < minutes(end); value += 60) result.push(`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`); return result; }, [start, end]);
  const validRange = minutes(start) < minutes(end);
  const toggleBlocked = (slot: string) => setBlocked(blocked.includes(slot) ? blocked.filter((item) => item !== slot) : [...blocked, slot]);
  return <div className="container page schedule-page"><div className="schedule-heading"><div><div className="eyebrow">PASO 03 / DISPONIBILIDAD</div><h1>Define tus horas</h1><p>Las horas bloqueadas no se usarán ningún día de la semana.</p></div></div><div className="availability-panel"><div className="availability-range"><TimeSelect label="Desde" value={start} onChange={setStart} /><span className="range-dash">—</span><TimeSelect label="Hasta" value={end} onChange={setEnd} /></div>{hasSaturday && <label className="toggle-field saturday-toggle"><input type="checkbox" checked={includeSaturday} onChange={(event) => setIncludeSaturday(event.target.checked)} /><span><strong>Tomar en cuenta el sábado</strong><small>Hay materias de esta carrera con clases sabatinas.</small></span></label>}<div className="blocked-heading"><div><h2>Horas que quieres dejar libres</h2><p>Selecciona bloques de una hora dentro de tu rango.</p></div><span>{blocked.length ? `${blocked.length} bloque${blocked.length === 1 ? "" : "s"}` : "Ninguno"}</span></div>{validRange ? <div className="blocked-grid">{slots.map((slot) => <label className={blocked.includes(slot) ? "blocked-slot selected" : "blocked-slot"} key={slot}><input type="checkbox" checked={blocked.includes(slot)} onChange={() => toggleBlocked(slot)} /><span>{slot}</span></label>)}</div> : <div className="form-error">La hora inicial debe ser menor que la hora final.</div>}</div><div className="schedule-actions"><button className="button button-light" type="button" onClick={onBack}><ArrowLeft size={17} /> Volver</button><span className="range-summary"><b>Rango disponible</b>{start} — {end}</span><button className="button button-dark" type="button" disabled={!validRange} onClick={onNext}>Ordenar prioridades <ArrowRight size={17} /></button></div></div>;
}

function ReorderList<T>({ items, getLabel, getMeta, renderActions, onChange }: { items: T[]; getLabel: (item: T) => string; getMeta?: (item: T) => string; renderActions?: (item: T) => ReactNode; onChange: (items: T[]) => void }) {
  const [dragged, setDragged] = useState<number | null>(null);
  const move = (from: number, to: number) => { if (to < 0 || to >= items.length || from === to) return; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); onChange(next); };
  return <div className="reorder-list">{items.map((item, index) => <div className={dragged === index ? "reorder-row dragging" : "reorder-row"} draggable onDragStart={() => setDragged(index)} onDragEnd={() => setDragged(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) move(dragged, index); setDragged(null); }} key={index}><GripVertical size={17} className="drag-icon" aria-hidden="true" /><span className="reorder-number">{index + 1}</span><span className="reorder-copy"><strong>{getLabel(item)}</strong>{getMeta && <small>{getMeta(item)}</small>}</span>{renderActions?.(item)}<span className="reorder-buttons"><button type="button" aria-label="Subir" disabled={!index} onClick={() => move(index, index - 1)}>↑</button><button type="button" aria-label="Bajar" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>↓</button></span></div>)}</div>;
}

function ExclusionModal({ subject, teacher, offerings, selected, onSave, onClose }: { subject: Subject; teacher: CatalogOffering; offerings: CatalogOffering[]; selected: number[]; onSave: (sectionIds: number[]) => void; onClose: () => void }) {
  const teacherOfferings = offerings.filter((item) => item.subject_id === subject.id && item.teacher_id === teacher.teacher_id);
  const [draft, setDraft] = useState<Set<number>>(() => new Set(selected));
  const toggle = (sectionId: number) => setDraft((current) => { const next = new Set(current); if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId); return next; });
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="exclusion-modal" role="dialog" aria-modal="true" aria-labelledby="exclusion-title"><div className="modal-header"><div><span className="eyebrow">EXCLUIR GRUPOS</span><h2 id="exclusion-title">{teacher.teacher}</h2><p>{subject.name}</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button></div><div className="modal-toolbar"><strong>{draft.size} de {teacherOfferings.length} seleccionados</strong><div><button type="button" onClick={() => setDraft(new Set(teacherOfferings.map((item) => item.section_id)))}>Todos</button><button type="button" onClick={() => setDraft(new Set())}>Ninguno</button></div></div><div className="exclusion-list">{teacherOfferings.map((item) => <label className="exclusion-option" key={item.section_id}><input type="checkbox" checked={draft.has(item.section_id)} onChange={() => toggle(item.section_id)} /><span><strong>Grupo {item.group_name ?? "sin grupo"}</strong><small>{item.meetings.length ? item.meetings.map((meeting) => `${DAY_NAMES[meeting.day_of_week]} ${timeLabel(meeting.start_time)}–${timeLabel(meeting.end_time)}${meeting.room ? ` · ${meeting.room}` : ""}`).join(" · ") : "Sin horario registrado"}</small></span></label>)}</div><div className="modal-actions"><button type="button" className="button button-light" onClick={onClose}>Cancelar</button><button type="button" className="button button-dark" onClick={() => { onSave([...draft]); onClose(); }}>Guardar grupos excluidos</button></div></section></div>;
}

function Priorities({ subjects, offerings, subjectOrder, setSubjectOrder, teacherOrders, setTeacherOrders, excludedOfferings, setExcludedOfferings, onBack, onNext }: { subjects: Subject[]; offerings: CatalogOffering[]; subjectOrder: number[]; setSubjectOrder: (ids: number[]) => void; teacherOrders: Record<number, number[]>; setTeacherOrders: (orders: Record<number, number[]>) => void; excludedOfferings: ExcludedOfferings; setExcludedOfferings: (value: ExcludedOfferings) => void; onBack: () => void; onNext: () => void }) {
  const selectedSubjects = rankList(subjects, subjectOrder.map((id) => subjects.find((subject) => subject.id === id)!).filter(Boolean), (subject) => subject.id);
  const bySubject = useMemo(() => offerings.reduce<Record<number, CatalogOffering[]>>((groups, offering) => { (groups[offering.subject_id] ??= []).push(offering); return groups; }, {}), [offerings]);
  const [modal, setModal] = useState<{ subject: Subject; teacher: CatalogOffering } | null>(null);
  const teacherItems = (subjectId: number) => { const seen = new Set<number>(); return (bySubject[subjectId] ?? []).filter((offering) => { if (seen.has(offering.teacher_id)) return false; seen.add(offering.teacher_id); return true; }); };
  const updateTeachers = (subjectId: number, items: CatalogOffering[]) => setTeacherOrders({ ...teacherOrders, [subjectId]: items.map((item) => item.teacher_id) });
  return <div className="container page schedule-page"><div className="schedule-heading"><div><div className="eyebrow">PASO 04 / PRIORIDADES</div><h1>Ordena tus preferencias</h1><p>La primera posición tiene mayor prioridad. El orden inicial de docentes usa la calificación global absoluta. También puedes excluir grupos cerrados antes de generar.</p></div></div><section className="priority-section"><div className="priority-section-heading"><div><span className="section-kicker">01 / MATERIAS</span><h2>¿Qué materias prefieres?</h2></div><small>Arrastra o usa las flechas</small></div><ReorderList items={selectedSubjects} getLabel={(subject) => subject.name} getMeta={(subject) => `${subject.credits ?? 0} créditos · ${subject.course_code ?? ""} · semestre ${subject.semester}`} onChange={(items) => setSubjectOrder(items.map((item) => item.id))} /></section><section className="priority-section"><div className="priority-section-heading"><div><span className="section-kicker">02 / DOCENTES</span><h2>Elige a tus docentes</h2></div><small>Por materia</small></div><div className="teacher-priority-sections">{selectedSubjects.map((subject) => { const items = rankList(teacherItems(subject.id), (teacherOrders[subject.id] ?? []).map((id) => teacherItems(subject.id).find((item) => item.teacher_id === id)!).filter(Boolean), (item) => item.teacher_id); return <div className="teacher-priority" key={subject.id}><div className="teacher-priority-title"><strong>{subject.name}</strong><span>{items.length} {items.length === 1 ? "docente disponible" : "docentes disponibles"}</span></div>{items.length ? <ReorderList items={items} getLabel={(item) => item.teacher} getMeta={(item) => { const excluded = excludedOfferings[exclusionKey(subject.id, item.teacher_id)]?.length ?? 0; return `${item.teacher_absolute_global_rating == null ? "Sin calificación global" : `Calificación global: ${Math.round(item.teacher_absolute_global_rating)}/100`}${excluded ? ` · ${excluded} grupo${excluded === 1 ? "" : "s"} excluido${excluded === 1 ? "" : "s"}` : ""}`; }} renderActions={(item) => <button type="button" className="exclude-button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setModal({ subject, teacher: item }); }}>Excluir grupos</button>} onChange={(next) => updateTeachers(subject.id, next)} /> : <div className="empty-panel">No hay docentes disponibles para esta materia.</div>}</div>; })}</div></section><div className="schedule-actions"><div className="schedule-action-left"><button className="button button-light" type="button" onClick={onBack}><ArrowLeft size={17} /> Volver</button><span>El orden guardado se usará para puntuar los resultados.</span></div><button className="button button-dark" type="button" onClick={onNext}>Generar horarios <ArrowRight size={17} /></button></div>{modal && <ExclusionModal subject={modal.subject} teacher={modal.teacher} offerings={offerings} selected={excludedOfferings[exclusionKey(modal.subject.id, modal.teacher.teacher_id)] ?? []} onSave={(sectionIds) => { const key = exclusionKey(modal.subject.id, modal.teacher.teacher_id); const next = { ...excludedOfferings }; if (sectionIds.length) next[key] = sectionIds; else delete next[key]; setExcludedOfferings(next); }} onClose={() => setModal(null)} />}</div>;
}

function isAllowedOffering(offering: CatalogOffering, start: number, end: number, blocked: string[], includeSaturday: boolean) {
  if (!offering.meetings.length) return false;
  return offering.meetings.every((meeting) => {
    if (meeting.day_of_week === 5 && !includeSaturday) return false;
    if (meeting.day_of_week > 5) return false;
    const meetingStart = minutes(meeting.start_time);
    const meetingEnd = minutes(meeting.end_time);
    return meetingStart >= start && meetingEnd <= end && !blocked.some((slot) => overlaps(meetingStart, meetingEnd, minutes(slot), minutes(slot) + 60));
  });
}

function conflicts(candidate: CatalogOffering, chosen: CatalogOffering[]) {
  return candidate.meetings.some((meeting) => chosen.some((other) => other.meetings.some((otherMeeting) => meeting.day_of_week === otherMeeting.day_of_week && overlaps(minutes(meeting.start_time), minutes(meeting.end_time), minutes(otherMeeting.start_time), minutes(otherMeeting.end_time)) )));
}

function compactScheduleRange(candidate: CatalogOffering[], start: string, end: string) {
  const meetings = candidate.flatMap((item) => item.meetings);
  if (!meetings.length) return [minutes(start), minutes(end)];
  const first = Math.max(minutes(start), Math.floor(Math.min(...meetings.map((meeting) => minutes(meeting.start_time))) / 60) * 60);
  const last = Math.min(minutes(end), Math.ceil(Math.max(...meetings.map((meeting) => minutes(meeting.end_time))) / 60) * 60);
  return [first, Math.max(first + 60, last)];
}

function candidateScore(candidate: CatalogOffering[], subjectOrder: number[], teacherOrders: Record<number, number[]>, target: number, strict: boolean) {
  const selected = new Set(candidate.map((item) => item.subject_id));
  const inclusion = subjectOrder.map((id) => selected.has(id) ? 1 : 0).join("");
  const teacherScore = subjectOrder.map((id) => { const offering = candidate.find((item) => item.subject_id === id); if (!offering) return "999"; return String((teacherOrders[id] ?? []).indexOf(offering.teacher_id)).padStart(3, "0"); }).join("");
  const ratings = candidate.reduce((sum, item) => sum + (item.teacher_absolute_global_rating ?? 0), 0);
  const missingFirst = inclusion.split("").map((bit) => bit === "1" ? "0" : "1").join("");
  return `${strict ? "000" : String(999 - candidate.length).padStart(3, "0")}|${missingFirst}|${teacherScore}|${String(99999 - Math.round(ratings)).padStart(5, "0")}`;
}

function generateSchedules(offerings: CatalogOffering[], subjectOrder: number[], teacherOrders: Record<number, number[]>, excludedOfferings: ExcludedOfferings, target: number, strict: boolean, start: string, end: string, blocked: string[], includeSaturday: boolean): Candidate[] {
  const excludedSections = new Set(Object.values(excludedOfferings).flat());
  const allowed = offerings.filter((offering) => !excludedSections.has(offering.section_id) && isAllowedOffering(offering, minutes(start), minutes(end), blocked, includeSaturday));
  const grouped = new Map<number, CatalogOffering[]>();
  for (const subjectId of subjectOrder) grouped.set(subjectId, rankList(allowed.filter((item) => item.subject_id === subjectId), (teacherOrders[subjectId] ?? []).map((id) => allowed.find((item) => item.teacher_id === id)!).filter(Boolean), (item) => item.teacher_id));
  const results: Candidate[] = [];
  const visit = (subjectIndex: number, chosen: CatalogOffering[]) => {
    if (results.length >= MAX_RESULTS) return;
    if (chosen.length > target) return;
    if (subjectIndex === subjectOrder.length) { if (chosen.length && (strict ? chosen.length === target : chosen.length <= target)) results.push({ offerings: chosen, sortKey: candidateScore(chosen, subjectOrder, teacherOrders, target, strict) }); return; }
    const remaining = subjectOrder.length - subjectIndex;
    if (strict && chosen.length + remaining < target) return;
    const subjectId = subjectOrder[subjectIndex];
    for (const offering of grouped.get(subjectId) ?? []) { if (!conflicts(offering, chosen)) visit(subjectIndex + 1, [...chosen, offering]); if (results.length >= MAX_RESULTS) return; }
    if (!strict) visit(subjectIndex + 1, chosen);
  };
  visit(0, []);
  return results.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function ScheduleGrid({ candidate, start, end }: { candidate: CatalogOffering[]; start: string; end: string }) {
  const showSaturday = candidate.some((item) => item.meetings.some((meeting) => meeting.day_of_week === 5));
  const days = showSaturday ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4];
  const [compactStart, compactEnd] = compactScheduleRange(candidate, start, end);
  const slots = Array.from({ length: Math.max(1, Math.ceil((compactEnd - compactStart) / 60)) }, (_, index) => compactStart + index * 60);
  const formatSlot = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const cell = (slot: number, day: number) => {
    const meetings = candidate.flatMap((item) => item.meetings.filter((meeting) => meeting.day_of_week === day).map((meeting) => ({ item, meeting })));
    if (meetings.some(({ meeting }) => minutes(meeting.start_time) < slot && minutes(meeting.end_time) > slot)) return null;
    const starts = meetings.filter(({ meeting }) => minutes(meeting.start_time) >= slot && minutes(meeting.start_time) < slot + 60);
    const first = starts[0];
    const span = first ? Math.max(1, Math.ceil((minutes(first.meeting.end_time) - minutes(first.meeting.start_time)) / 60)) : undefined;
    return <td rowSpan={span} key={day}>{starts.map(({ item, meeting }) => <div className={`schedule-table-class schedule-color-${item.subject_id % 8}`} style={span && span > 1 ? { minHeight: `${span * 45 - 6}px` } : undefined} key={`${item.section_id}-${meeting.start_time}`}><strong>{item.subject}</strong><small>{item.teacher}</small></div>)}</td>;
  };
  return <div className="schedule-table-wrap"><table className="schedule-table"><thead><tr><th>Hora</th>{days.map((day) => <th key={day}>{DAY_NAMES[day]}</th>)}</tr></thead><tbody>{slots.map((slot) => <tr key={slot}><th>{formatSlot(slot)}</th>{days.map((day) => cell(slot, day))}</tr>)}</tbody></table></div>;
}

function ScheduleReport({ candidate, start, end }: { candidate: CatalogOffering[]; start: string; end: string }) {
  const subjects = [...new Map(candidate.map((item) => [item.subject_id, item])).values()];
  return <div className="schedule-report"><div className="schedule-report-header"><div className="schedule-report-brand"><img src="/icon.png" alt="" /><div><strong>Horarios<span>Tec</span></strong></div></div></div><ScheduleGrid candidate={candidate} start={start} end={end} /><div className="schedule-report-subjects">{subjects.map((item) => <div className={`schedule-report-subject schedule-color-border-${item.subject_id % 8}`} key={item.section_id}><strong>{item.subject}</strong><b>{item.credits ? `${item.credits} créditos` : "Materia"} · {item.group_name ? `Grupo ${item.group_name}` : "Sin grupo"}</b><small>{item.teacher}</small></div>)}</div><div className="schedule-report-footer"><span>Generado por HorariosTec</span><span>{new Date().toLocaleDateString("es-MX")} · {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span></div></div>;
}

async function exportPdf(element: HTMLElement | null) {
  if (!element) return;
  const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: "#fffdfb", imageTimeout: 0 });
  const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height], compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, canvas.width, canvas.height, undefined, "MEDIUM");
  pdf.save("horario.pdf");
}

function Results({ candidates, target, strict, start, end, onBack }: { candidates: Candidate[]; target: number; strict: boolean; start: string; end: string; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState<"all" | number>("all");
  const scheduleRef = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [candidates]);
  const counts = [...new Set(candidates.map((item) => item.offerings.length))].sort((a, b) => a - b);
  const visibleCandidates = subjectFilter === "all" ? candidates : candidates.filter((item) => item.offerings.length === subjectFilter);
  const candidate = visibleCandidates[index];
  const move = (delta: number) => setIndex((current) => Math.max(0, Math.min(visibleCandidates.length - 1, current + delta)));
  return <div className="container page schedule-page"><div className="schedule-heading"><div><div className="eyebrow">PASO 05 / RESULTADOS</div><h1>Tus opciones</h1><p>{visibleCandidates.length ? `${visibleCandidates.length} ${visibleCandidates.length === 1 ? "opción compatible" : "opciones compatibles"} encontradas${subjectFilter === "all" && strict ? ` con ${target} materias` : ""}.` : "No encontramos una combinación compatible con este filtro."}</p></div><div className="result-tools"><label className="result-filter"><span>Materias</span><select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value === "all" ? "all" : Number(event.target.value)); setIndex(0); }}><option value="all">Todas</option>{counts.map((count) => <option key={count} value={count}>{count}</option>)}</select></label><button type="button" className="button button-light" onClick={() => void exportPdf(scheduleRef.current)} disabled={!candidate}><Download size={16} /> PDF</button></div></div>{candidate ? <><div className="result-viewer"><div className="result-navigation"><button type="button" className="result-arrow" onClick={() => move(-1)} disabled={index === 0} aria-label="Horario anterior"><ArrowLeft size={19} /></button><span><strong>{String(index + 1).padStart(2, "0")}</strong> / {String(visibleCandidates.length).padStart(2, "0")}</span><button type="button" className="result-arrow" onClick={() => move(1)} disabled={index === visibleCandidates.length - 1} aria-label="Siguiente horario"><ArrowRight size={19} /></button></div><article className="result-card open" ref={scheduleRef}><ScheduleReport candidate={candidate.offerings} start={start} end={end} /></article></div><div className="schedule-actions"><button className="button button-light" type="button" onClick={onBack}><ArrowLeft size={17} /> Volver</button><span>Usa las flechas para comparar horarios.</span></div></> : <><div className="empty-panel results-empty"><strong>Prueba con alguno de estos cambios:</strong><span>Amplía tu rango, quita una hora libre, incluye el sábado o desactiva “Cantidad estricta”.</span></div><div className="schedule-actions"><button className="button button-light" type="button" onClick={onBack}><ArrowLeft size={17} /> Volver</button></div></>}</div>;
}

export default function ScheduleBuilder() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [career, setCareer] = useState<Career | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [offerings, setOfferings] = useState<CatalogOffering[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState(1);
  const [strict, setStrict] = useState(true);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [includeSaturday, setIncludeSaturday] = useState(true);
  const [subjectOrder, setSubjectOrder] = useState<number[]>([]);
  const [teacherOrders, setTeacherOrders] = useState<Record<number, number[]>>({});
  const [excludedOfferings, setExcludedOfferings] = useState<ExcludedOfferings>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { api.careers().then((data) => setCareers(data.careers)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const chooseCareer = async (next: Career) => { setCareer(next); setLoading(true); setError(""); try { const [subjectData, catalogData] = await Promise.all([api.subjects(next.slug), api.catalog(next.slug)]); setSubjects(subjectData.subjects); setOfferings(catalogData.offerings); setSelected([]); setTarget(1); setExcludedOfferings({}); setStep(2); } catch (err) { setError(err instanceof Error ? err.message : "No pudimos cargar la carrera."); } finally { setLoading(false); } };
  const startPriorities = () => { const order = [...selected].sort((a, b) => { const left = subjects.find((subject) => subject.id === a)!; const right = subjects.find((subject) => subject.id === b)!; return (right.credits ?? 0) - (left.credits ?? 0) || left.semester - right.semester || left.name.localeCompare(right.name, "es"); }); const nextTeachers: Record<number, number[]> = {}; for (const subjectId of order) { const seen = new Set<number>(); nextTeachers[subjectId] = offerings.filter((item) => item.subject_id === subjectId).sort((a, b) => (b.teacher_absolute_global_rating ?? -1) - (a.teacher_absolute_global_rating ?? -1) || a.teacher.localeCompare(b.teacher, "es")).filter((item) => { if (seen.has(item.teacher_id)) return false; seen.add(item.teacher_id); return true; }).map((item) => item.teacher_id); } setSubjectOrder(order); setTeacherOrders(nextTeachers); setStep(4); };
  const generate = () => { setCandidates(generateSchedules(offerings, subjectOrder, teacherOrders, excludedOfferings, target, strict, start, end, blocked, includeSaturday)); setStep(5); };
  const changeStrict = (value: boolean) => { setStrict(value); if (step === 5) setCandidates(generateSchedules(offerings, subjectOrder, teacherOrders, excludedOfferings, target, value, start, end, blocked, includeSaturday)); };
  const reset = () => { setCareer(null); setStep(1); setSubjects([]); setOfferings([]); setSelected([]); setExcludedOfferings({}); setCandidates([]); };
  if (loading && !career && !careers.length) return <div className="container page"><BuilderLoading /></div>;
  if (error && !career) return <div className="container page"><BuilderError message={error} /></div>;
  if (!career) return <CareerSelection careers={careers} onSelect={(next) => void chooseCareer(next)} />;
  return <><div className="container schedule-shell"><StepHeader step={step} career={career} strict={strict} setStrict={changeStrict} onBack={reset} onStep={(next) => next === 1 ? reset() : setStep(next)} /></div>{error ? <div className="container page"><BuilderError message={error} /></div> : loading ? <div className="container page"><BuilderLoading /></div> : step === 2 ? <SubjectSelection subjects={subjects} selected={selected} setSelected={setSelected} target={target} setTarget={setTarget} strict={strict} setStrict={changeStrict} onBack={reset} onNext={() => setStep(3)} /> : step === 3 ? <Availability offerings={offerings} start={start} end={end} setStart={setStart} setEnd={setEnd} blocked={blocked} setBlocked={setBlocked} includeSaturday={includeSaturday} setIncludeSaturday={setIncludeSaturday} onBack={() => setStep(2)} onNext={startPriorities} /> : step === 4 ? <Priorities subjects={subjects.filter((subject) => selected.includes(subject.id))} offerings={offerings} subjectOrder={subjectOrder} setSubjectOrder={setSubjectOrder} teacherOrders={teacherOrders} setTeacherOrders={setTeacherOrders} excludedOfferings={excludedOfferings} setExcludedOfferings={setExcludedOfferings} onBack={() => setStep(3)} onNext={generate} /> : step === 5 ? <Results candidates={candidates} target={target} strict={strict} start={start} end={end} onBack={() => setStep(4)} /> : null}</>;
}
