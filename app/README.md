# HorariosTec web

React + TypeScript + Vite frontend for the HorariosTec schedule builder and
teacher directory. It only talks to the API; it never connects to D1 directly.

## Development

```bash
cd app
pnpm install
cp .env.example .env.local
pnpm dev
```

Create and preview the production bundle with:

```bash
pnpm build
pnpm preview
```

Set `VITE_API_BASE_URL` to the local Worker URL or the deployed API URL. The
frontend only communicates with the API; it never accesses D1 directly.

When `VITE_API_BASE_URL` is empty in a production build, requests use the same
origin. During development, the default API URL is `http://localhost:8787`.

Current routes are:

- `/` — landing page
- `/horario` — schedule builder and PDF export
- `/docentes` — career and teacher directory
- `/docentes/:id` — teacher profile, current evaluations, and legacy data
- `/docentes/:id/evaluar` — evaluation form
- `/nosotros` — project information

The schedule builder downloads the active catalog and generates compatible
combinations in the browser. It does not write schedules to the server.
