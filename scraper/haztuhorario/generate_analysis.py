import json
from pathlib import Path

analysis_file = Path("/home/rodrigo47363/University/horarioits/horariostec/scraper/haztuhorario/output/analisis_electrica_completo.json")
data = json.loads(analysis_file.read_text(encoding="utf-8"))

lines = [
    "# 🔬 Análisis Exhaustivo de Materias y Docentes — Ingeniería Eléctrica (ITS)",
    "",
    "> **Diagnóstico de cobertura:** 100% de materias cubiertas (56/56 materias, 9 semestres, 123 docentes, 696 comentarios).",
    "",
    "---",
    "",
    "## 📈 Resumen Ejecutivo y Estadísticas Clave",
    "",
    "- **Total de materias:** 56 materias.",
    "- **Materias con múltiples docentes para elegir:** 29 materias (51.8%).",
    "- **Materias con docente único (monopolio de cátedra):** 27 materias (48.2%) — comunes en semestres 6° a 9° de especialidad.",
    "- **Materias con marcador 'Docente Sin Asignar':** 3 materias (*Fundamentos de Investigación*, *Electrónica Analógica*, *Taller de Investigación I*).",
    "",
    "---",
    ""
]

for sem in data["semesters"]:
    sem_num = sem["semester"]
    title = sem["title"]
    s_count = len(sem["subjects"])
    lines.append(f"## 🎓 {title} ({s_count} Materias)")
    lines.append("")
    
    for sub in sem["subjects"]:
        s_name = sub["name"]
        t_count = sub["teacher_count"]
        lines.append(f"### 📌 {s_name}")
        lines.append(f"- **Docentes disponibles ({t_count}):**")
        
        bt = sub["best_teacher"]
        if bt:
            name_bt = bt["name"]
            score_bt = bt["score"]
            revs_bt = bt["reviews"]
            expl_bt = bt["explains"]
            fair_bt = bt["fair"]
            lines.append(f"  - 🏆 **Mejor evaluado:** **{name_bt}** — Score: `{score_bt}/100` ({revs_bt} reseñas, Explica: `{expl_bt}%`, Justo: `{fair_bt}%`)")
        
        ht = sub["hardest_teacher"]
        if ht and ht != bt and (ht.get("hard") or 0) > 40:
            name_ht = ht["name"]
            score_ht = ht["score"]
            hard_ht = ht["hard"]
            lines.append(f"  - ⚠️ **Mayor dificultad:** **{name_ht}** — Dificultad: `{hard_ht}%` (Score: `{score_ht}/100`)")
            
        lines.append("")
        lines.append("| Docente | Calificación | Reseñas | % Justo | % Explica | % Dificultad | % Tareas | % Asistencia |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
        
        for t in sub["teachers"]:
            name = t["name"]
            url = t["url"]
            score = f"**{t['score']}**" if t["score"] is not None else "—"
            revs = t["reviews"]
            fair = f"{t['fair']}%" if t["fair"] is not None else "—"
            expl = f"{t['explains']}%" if t["explains"] is not None else "—"
            hard = f"{t['hard']}%" if t["hard"] is not None else "—"
            hw = f"{t['homework']}%" if t["homework"] is not None else "—"
            att = f"{t['attendance']}%" if t["attendance"] is not None else "—"
            
            t_link = f"[{name}]({url})" if url else name
            lines.append(f"| {t_link} | {score} | {revs} | {fair} | {expl} | {hard} | {hw} | {att} |")
        lines.append("")

art_path = Path("/home/rodrigo47363/.gemini/antigravity-cli/brain/232048f1-4385-4c54-9e08-daa6d499b9b3/analisis_completo_electrica.md")
art_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("Artifact guardado en:", art_path)
