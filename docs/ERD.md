# GradFix — Entity Relationship Diagram

## Textual ERD

```
                          ┌──────────────┐
                          │   tenants    │
                          │──────────────│
                          │ id (PK)      │
                          │ name         │
                          │ slug (UQ)    │
                          │ center_lat   │
                          │ center_lng   │
                          │ settings     │
                          │ is_active    │
                          └──────┬───────┘
            ┌────────────┬───────┼───────────┬───────────────┐
            │            │       │           │               │
            │ 1        N │     1 │ N       1 │ N           1 │ N
     ┌──────▼─────┐ ┌────▼──────┐    ┌───────▼──────┐ ┌──────▼──────┐
     │   users    │ │ categories│    │   reports    │ │  (settings) │
     │────────────│ │───────────│    │──────────────│ └─────────────┘
     │ id (PK)    │ │ id (PK)   │    │ id (PK)      │
     │ tenant_id  │ │ tenant_id │    │ tenant_id    │
     │ email      │ │ name      │    │ reporter_id  │──┐
     │ password.. │ │ slug      │    │ category_id  │  │
     │ full_name  │ │ icon      │    │ subcategory_ │  │
     │ role       │ │ sort_order│    │ title        │  │
     │ is_email_  │ └─────┬─────┘    │ description  │  │
     │   verified │       │ 1        │ status       │  │
     └──┬──────┬──┘       │ N        │ priority     │  │
        │      │    ┌─────▼────────┐ │ latitude     │  │
        │      │    │subcategories │ │ longitude    │  │
        │      │    │──────────────│ │ address      │  │
        │      │    │ id (PK)      │ │ upvote_count │  │
        │      │    │ category_id  │ │ created_at   │  │
        │      │    │ name         │ │ resolved_at  │  │
        │      │    │ slug         │ └───┬───┬───┬───┘  │
        │      │    └──────────────┘     │   │   │      │
        │      │                       1 │   │ 1 │ N    │
        │      │ 1                     N │   │   │      │
        │      │                ┌────────▼─┐ │ ┌─▼──────────────┐
        │      │                │report_   │ │ │ report_status_ │
        │      │                │photos    │ │ │ history        │
        │      │                │──────────│ │ │────────────────│
        │      │                │ id (PK)  │ │ │ id (PK)        │
        │      │                │ report_id│ │ │ report_id      │
        │      │                │ storage_ │ │ │ changed_by ────┼──┐
        │      │                │   key    │ │ │ from_status    │  │
        │      │                │ width    │ │ │ to_status      │  │
        │      │                │ height   │ │ │ note           │  │
        │      │                └──────────┘ │ │ created_at     │  │
        │      │                             │ └────────────────┘  │
        │      │ 1                         1 │ N                    │
        │      │                  ┌──────────▼─────┐                │
        │      │                  │    upvotes     │                │
        │      │ N                │────────────────│                │
        │      └─────────────────►│ id (PK)        │                │
        │                         │ report_id      │                │
        │                         │ user_id        │                │
        │                         │ UQ(report,user)│                │
        │                         └────────────────┘                │
        │ 1                                                          │
        │ N                                          reporter_id ────┘
   ┌────▼───────────────┐  ┌────────────────────┐  changed_by ──────┘
   │ email_verification │  │ password_reset_    │
   │ _tokens            │  │ tokens             │   ┌──────────────────┐
   │────────────────────│  │────────────────────│   │ refresh_tokens   │
   │ id (PK)            │  │ id (PK)            │   │──────────────────│
   │ user_id (FK)       │  │ user_id (FK)       │   │ id (PK)          │
   │ token_hash         │  │ token_hash         │   │ user_id (FK)     │
   │ expires_at         │  │ expires_at         │   │ token_hash       │
   │ consumed_at        │  │ consumed_at        │   │ expires_at       │
   └────────────────────┘  └────────────────────┘   │ revoked_at       │
                                                     └──────────────────┘
```

## Relationships

| Relationship                              | Cardinality | Notes                                              |
| ----------------------------------------- | ----------- | -------------------------------------------------- |
| tenants → users                           | 1 : N       | `super_admin` users may have `tenant_id = NULL`    |
| tenants → categories                      | 1 : N       | Categories are per-tenant                          |
| categories → subcategories                | 1 : N       | Optional second level                              |
| tenants → reports                         | 1 : N       | Every report belongs to exactly one tenant         |
| users → reports                           | 1 : N       | `reporter_id` (nullable for anonymous reports)     |
| categories → reports                      | 1 : N       | Required category, optional subcategory            |
| reports → report_photos                   | 1 : N       | Zero or more photos per report                     |
| reports → report_status_history           | 1 : N       | One row per status change (append-only audit)      |
| reports → upvotes ← users                 | M : N       | Join table with `UNIQUE(report_id, user_id)`       |
| users → email_verification_tokens         | 1 : N       | Single-use, expiring, hashed                       |
| users → password_reset_tokens            | 1 : N       | Single-use, expiring, hashed                       |
| users → refresh_tokens                    | 1 : N       | Rotated on use, revocable                          |

## Integrity rules

- All `tenant_id` columns are `NOT NULL` except on `users` (to permit `super_admin`).
- Deleting a tenant cascades to its users, categories, and reports (`ON DELETE CASCADE`).
- Deleting a report cascades to its photos, status history, and upvotes.
- `upvotes` enforces one upvote per `(report_id, user_id)`.
- `reports.upvote_count` is denormalized and kept consistent inside the upvote/unvote transaction.
- Email uniqueness is **per tenant**: `UNIQUE(tenant_id, email)`.
