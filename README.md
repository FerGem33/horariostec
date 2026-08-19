# HorariosTec 🎓

<div align="center">

![React](https://img.shields.io/badge/Frontend-React_19_%2B_Vite-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Backend-Cloudflare_Workers_%2B_D1-F38020?logo=cloudflare&logoColor=white)
![Python](https://img.shields.io/badge/Scraper-Python_3.13_%2B_uv-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

**Planificador inteligente de horarios universitarios y plataforma comunitaria de evaluaciones docentes para estudiantes del Instituto Tecnológico de Saltillo (ITS).**

[🌐 Probar Aplicación Web](http://localhost:5173/) • [📖 Documentación](#-documentación-y-arquitectura) • [🚀 Inicio Rápido](#-inicio-rápido) • [👥 Carreras](#-carreras-soportadas)

</div>

---

## 💡 ¿Qué es HorariosTec?

**HorariosTec** es una solución web integral y de código abierto diseñada para resolver la complejidad al momento de inscribir materias en el **Instituto Tecnológico de Saltillo**.

Combina en una sola plataforma:
1. **La oferta horaria oficial:** Procesada directamente del portal académico **Mindbox ITS**.
2. **Historial de opiniones y calificaciones:** Base de datos con más de **15,500 evaluaciones** y **3,000 comentarios** de docentes (migrados de HazTuHorario).
3. **Generador algorítmico de combinaciones:** Calcula instantáneamente todas las opciones de horario viables sin traslapes ni choques de hora.

---

## ✨ Características Principales

### 📅 Generador de Horarios
* **Combinaciones automáticas:** Encuentra todas las alternativas posibles de inscripción en milisegundos.
* **Filtros avanzados:** Selecciona materias indispensables, descarta profesores específicos o limita rangos de horario (matutino / vespertino).
* **Generador de horarios aleatorios:** Para inspirarte con combinaciones válidas en un solo clic.
* **Exportación profesional:** Descarga tu horario generado en **PNG de alta resolución** o **documento PDF** listo para imprimir.

### 👨‍🏫 Directorio y Evaluaciones Docentes
* **Directorio General:** Acceso a los **559 profesores** de la institución con buscador instantáneo por nombre o materia.
* **Métricas detalladas:** Calificación general (/100), % califica de manera justa, % explica bien, % dificultad, % tareas y % asistencia.
* **Opiniones verificadas:** Lee comentarios históricos y registra nuevas evaluaciones con control de votos y feedback constructivo.
* **Comparador de profesores:** Compara hasta 2 profesores frente a frente para elegir la mejor opción académica.

### 🌓 Experiencia de Usuario & Rendimiento
* **Modo Oscuro / Modo Claro:** Diseño de alto contraste adaptado con la identidad visual del Tecnológico de Saltillo (Guinda/Vino y Dorado).
* **Caché Inteligente & Modo Offline:** Persistencia local mediante `@tanstack/react-query-persist-client` para navegación instantánea sin peticiones repetidas.
* **Datos Resilientes (Static Fallback):** La web funciona plenamente tanto conectada al backend de Cloudflare D1 como en despliegues estáticos (GitHub Pages).

---

## 🏛️ Estructura del Monorepo

```text
horariostec/
├── app/                  # Frontend en React 19 + TypeScript + Vite + TanStack Query
├── api/                  # Backend en Python Cloudflare Worker + Base de Datos SQLite D1
├── scraper/
│   ├── haztuhorario/     # Scraper de planes de estudio y reseñas históricas (App Router SSR)
│   └── mindbox/          # Scraper autenticado en Playwright para oferta oficial de Mindbox ITS
└── docs/                 # Documentación técnica y guías operativas
```

---

## 🎓 Carreras Soportadas

HorariosTec incluye el catálogo completo de **465 materias** y **1,623 asignaciones docentes** de los 9 semestres de:

| Carrera | Materias | Docentes Registrados |
| :--- | :---: | :---: |
| 💻 **Ingeniería en Sistemas Computacionales** | 58 | 138 |
| ⚡ **Ingeniería Eléctrica** | 56 | 123 |
| 🏭 **Ingeniería Industrial** | 61 | 236 |
| 🤖 **Ingeniería Mecatrónica** | 50 | 202 |
| ⚙️ **Ingeniería Mecánica** | 55 | 134 |
| 🔌 **Ingeniería Electrónica** | 59 | 133 |
| 💼 **Ingeniería en Gestión Empresarial** | 57 | 157 |
| 📦 **Ingeniería en Materiales** | 69 | 125 |

---

## 🚀 Inicio Rápido

### Requisitos previos
* **Node.js** v20+ y **pnpm** (o npm).
* **Python** 3.12+ y **uv** (`curl -LsSf https://astral.sh/uv/install.sh | sh`).

---

### 1. Iniciar la API local (Cloudflare D1)

```bash
cd api

# 1. Instalar dependencias con uv
uv sync

# 2. Aplicar migraciones en la base de datos local SQLite
npx wrangler d1 migrations apply horariostec --local

# 3. Importar catálogo académico y reseñas
uv run python importer.py legacy --input ../scraper/haztuhorario/output/reviews.json

# 4. Iniciar servidor de desarrollo en el puerto 8787
npx wrangler dev --port 8787
```

---

### 2. Iniciar el Frontend (Web)

En otra terminal:

```bash
cd app

# 1. Instalar dependencias
pnpm install

# 2. Iniciar servidor Vite (puerto 5173)
pnpm dev
```

Abre en tu navegador: **`http://localhost:5173/`**

---

## 🧪 Pruebas y Calidad de Código

### Probar el Scraper:
```bash
cd scraper/haztuhorario
PYTHONPATH=. uv run pytest
```

### Probar la Compilación del Frontend:
```bash
cd app
pnpm build
```

---

## 📖 Documentación Técnica

* 🏗️ **[Arquitectura del Sistema](docs/architecture.md):** Componentes, flujo de datos y modelo de dominio.
* 🔌 **[Referencia de la API](docs/api-reference.md):** Endpoints REST, parámetros de consulta y formatos JSON.
* 🔄 **[Guía de Actualización de Datos (Runbook)](docs/data-update.md):** Pasos para raspar un nuevo semestre de Mindbox y publicarlo en D1.
* 💻 **[Guía de Desarrollo](docs/development.md):** Entorno de trabajo, configuración local y pruebas.
* 🛡️ **[Seguridad y Privacidad](docs/security.md):** Manejo de credenciales, tokens y controles de moderación.

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si deseas colaborar:
1. Haz un **Fork** del proyecto.
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`).
3. Realiza tus cambios y haz commit (`git commit -m 'feat: Agregar nueva funcionalidad'`).
4. Haz push a tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un **Pull Request**.

---

## 📜 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

<div align="center">
Desarrollado para la comunidad del <strong>Instituto Tecnológico de Saltillo</strong> 🦅
</div>
