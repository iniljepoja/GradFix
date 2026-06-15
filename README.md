# GradFix

**GradFix** is a Progressive Web Application (PWA) for reporting urban infrastructure problems
(potholes, broken streetlights, damaged signage, illegal dumping, etc.). Citizens submit geo-located
reports with photos; municipalities triage and resolve them through an admin panel. The system is
**multi-tenant** — a single deployment serves many municipalities, each isolated by a `tenant_id`.

## Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | React (Vite) + PWA, Leaflet maps        |
| Backend  | Node.js + Express, REST API             |
| Database | PostgreSQL                              |
| Maps     | OpenStreetMap tiles + Leaflet           |
| Auth     | JWT access/refresh tokens, bcrypt       |

## Repository layout

```
GradFix/
├── backend/        Node.js + Express REST API
├── frontend/       React PWA
├── docs/           Architecture, DB schema, ERD, API spec, roadmap
├── docker-compose.yml   Local PostgreSQL (+ Adminer)
├── CLAUDE.md       Guidance for Claude Code
└── README.md
```

## Quick start (local development)

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # adjust secrets
npm install
npm run migrate               # create schema
npm run seed                  # demo tenant + admin + categories
npm run dev                   # http://localhost:4000

# 3. Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture & multi-tenancy
- [docs/DATABASE.md](docs/DATABASE.md) — PostgreSQL schema
- [docs/ERD.md](docs/ERD.md) — entity relationship diagram
- [docs/API.md](docs/API.md) — REST API specification
- [docs/ROADMAP.md](docs/ROADMAP.md) — 6-week development roadmap
