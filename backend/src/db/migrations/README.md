# Migrations

Plain SQL files applied in **filename order** by `npm run migrate`. Applied files are tracked in the
`schema_migrations` table and never re-run.

- Add new changes as a new numbered file (`002_*.sql`, `003_*.sql`, …).
- **Never edit a migration that has already been applied** to a shared environment — write a new one.
- Each file runs inside its own transaction.
