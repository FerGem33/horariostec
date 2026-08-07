# HorariosTec web

React + TypeScript + Vite frontend for the reviews MVP.

## Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Create the production bundle with `pnpm build`.

Set `VITE_API_BASE_URL` to the local Worker URL or the deployed API URL. The
frontend only communicates with the API; it never accesses D1 directly.

The schedule builder is intentionally not included in this first frontend
iteration. Current routes focus on teacher discovery, current evaluations,
historical HazTuHorario data, and evaluation submission.
