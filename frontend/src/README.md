# Frontend source layout

Feature-folder organization. Cross-cutting concerns live at the top level; everything user-facing is
grouped by domain under `features/`.

```
src/
├── main.jsx              App entry: providers (Router, React Query), Leaflet CSS
├── App.jsx               Route definitions / app shell
├── api/
│   └── client.js         Single axios instance — injects X-Tenant + auth, 401→refresh retry
├── features/
│   ├── auth/             Login, register, email verification, password reset (week 2)
│   ├── reports/          Report list, detail, create form, photo upload, upvote (weeks 3–4)
│   ├── map/              MapPage + Leaflet/OSM rendering (week 5)
│   └── admin/            Admin dashboard: triage, status, stats, users (week 6)
├── components/           Shared presentational components (buttons, forms, layout)
├── hooks/                Reusable hooks (useAuth, useGeolocation, …)
└── lib/                  Pure helpers (formatting, status colors, constants)
```

## Rules of the road

- **Never call `fetch`/`axios` directly from components** — go through `api/client.js`. It adds the
  `X-Tenant` header (from `VITE_TENANT_SLUG`) and the Bearer token, and refreshes on 401.
- Server state (lists, detail, mutations) uses React Query; keep local UI state in component/hooks.
- Each `features/<domain>` folder owns its pages, components, and query hooks for that domain.
- Map code stays inside `features/map` and uses `react-leaflet`; tiles are OpenStreetMap.
