# GradFix — REST API Specification

Base URL: `/api/v1`

## Conventions

- **Content type**: `application/json` (except photo upload: `multipart/form-data`).
- **Tenant**: every request to tenant-scoped routes must send `X-Tenant: <slug>` (or use a tenant
  subdomain). Auth and `/admin` super-admin routes may differ — noted per endpoint.
- **Auth**: protected routes require `Authorization: Bearer <accessToken>`.
- **Success**: `200/201` with `{ "data": <payload>, "meta": <optional> }`.
- **Error**: non-2xx with `{ "error": { "code", "message", "details"? } }`.
- **Pagination**: `?page=1&limit=20`; responses include `meta: { page, limit, total, totalPages }`.

### Common error codes
`VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`TENANT_NOT_FOUND` (404), `EMAIL_NOT_VERIFIED` (403), `CONFLICT` (409), `RATE_LIMITED` (429),
`INTERNAL` (500).

---

## Auth — `/api/v1/auth`

| Method | Path                   | Auth | Description                                              |
| ------ | ---------------------- | ---- | -------------------------------------------------------- |
| POST   | `/register`            | —    | Create account in the resolved tenant; sends verification email |
| POST   | `/login`               | —    | Returns access + refresh tokens                          |
| POST   | `/refresh`             | —    | Exchange a refresh token for a new access token (rotates) |
| POST   | `/logout`              | ✓    | Revoke the current refresh token                         |
| POST   | `/verify-email`        | —    | Consume an email verification token                      |
| POST   | `/resend-verification` | —    | Re-send verification email                               |
| POST   | `/forgot-password`     | —    | Send password reset email                                |
| POST   | `/reset-password`      | —    | Consume reset token, set new password                    |
| GET    | `/me`                  | ✓    | Current user profile                                     |

**POST /register**
```json
// request
{ "email": "ana@example.com", "password": "S3cret!23", "fullName": "Ana Horvat" }
// 201
{ "data": { "id": "…", "email": "ana@example.com", "isEmailVerified": false } }
```

**POST /login**
```json
// request
{ "email": "ana@example.com", "password": "S3cret!23" }
// 200
{ "data": {
  "accessToken": "jwt…", "refreshToken": "opaque…",
  "user": { "id": "…", "email": "…", "fullName": "…", "role": "citizen", "isEmailVerified": true }
} }
```

**POST /verify-email** — `{ "token": "…" }` → `200 { "data": { "verified": true } }`

**POST /reset-password** — `{ "token": "…", "password": "newSecret!1" }`

**GET /me** → profile including gamification badge:
```json
{ "data": {
  "id": "…", "email": "…", "fullName": "…", "role": "citizen", "isEmailVerified": true,
  "reportCount": 7,
  "badge": { "rank": 2, "title": "Active Citizen" },
  "nextBadge": { "rank": 3, "title": "City Guardian", "at": 15 }
} }
```

---

## Categories — `/api/v1/categories`

| Method | Path                       | Auth          | Description                       |
| ------ | -------------------------- | ------------- | --------------------------------- |
| GET    | `/`                        | —             | List active categories for tenant |
| GET    | `/:id/subcategories`       | —             | List subcategories of a category  |

```json
// GET /categories → 200
{ "data": [
  { "id": "…", "name": "Urban furniture", "slug": "urban-furniture", "icon": "bench", "sortOrder": 0 },
  { "id": "…", "name": "Public lighting", "slug": "public-lighting", "icon": "bulb", "sortOrder": 1 }
] }
```

Admin category/subcategory CRUD lives under `/api/v1/admin/categories` (see the Admin section).

---

## Reports — `/api/v1/reports`

| Method | Path               | Auth                | Description                                          |
| ------ | ------------------ | ------------------- | ---------------------------------------------------- |
| GET    | `/`                | —                   | List/filter reports (public)                         |
| GET    | `/mine`            | ✓                   | The current user's report history                    |
| GET    | `/:id`             | —                   | Report detail (incl. photos, current status)         |
| GET    | `/:id/history`     | —                   | Status history timeline                              |
| POST   | `/`                | ✓ (verified)        | Create a report (`multipart/form-data`, **1–3 photos required**) |
| POST   | `/:id/photos`      | owner               | Add more photos later (`multipart/form-data`, field `photos`, max 3 total) |
| POST   | `/:id/rating`      | reporter            | Rate the resolution (after `resolved`/`closed`)      |
| POST   | `/:id/upvote`      | ✓                   | Upvote (idempotent per user)                         |
| DELETE | `/:id/upvote`      | ✓                   | Remove upvote                                        |

Staff status management (status change, priority, assignment, comments, duplicate merge) lives under
`/api/v1/admin/reports` — see the Admin section.

**GET /reports** query params: `status`, `categoryId`, `subcategoryId`, `q` (text search),
`sort` (`recent` | `top`), `page`, `limit`.

**POST /reports** — `multipart/form-data`. Text fields + **1–3 `photos` files** (mandatory; rejected
with `400` if none). The responsible entity is auto-resolved from the category's routing config.

```
# multipart fields
title=Large pothole on Ilica
description=Deep pothole near tram stop
categoryId=…            subcategoryId=…        (optional)
latitude=45.8131        longitude=15.9776
address=Ilica 100        priority=high          (low|medium|high|critical, default medium)
photos=<file>  photos=<file>                    (1–3 image files)
```
```json
// 201 — report created with its photos; assignedEntityId set if the category has a route
{ "data": {
  "id": "…", "status": "new", "priority": "high", "upvoteCount": 0,
  "assignedEntityId": "…", "createdAt": "…",
  "photos": [ { "id": "…", "url": "/uploads/…", "isPrimary": true } ]
} }
```

**POST /reports/:id/photos** — `multipart/form-data`, field `photos` (1–3 files). Images are
compressed server-side. → `201 { "data": [ { "id": "…", "url": "/uploads/…", "isPrimary": true } ] }`

**POST /reports/:id/rating** — `{ "satisfied": true, "comment": "Fixed quickly" }` (reporter only,
once the report is `resolved`/`closed`).

---

## Notifications — `/api/v1/notifications`

| Method | Path             | Auth | Description                                  |
| ------ | ---------------- | ---- | -------------------------------------------- |
| GET    | `/vapid-public`  | —    | VAPID public key for the browser push subscription |
| POST   | `/push`          | ✓    | Register a Web Push subscription for the user |

Status-change emails and Web Push notifications are sent automatically to the reporter. Push
delivery uses VAPID (keys configured via `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
env vars). Subscriptions that return 404/410 are pruned automatically.

```json
// GET /notifications/vapid-public
{ "data": { "publicKey": "BJU9oILq…" } }

// POST /notifications/push
{ "endpoint": "https://push…", "keys": { "p256dh": "…", "auth": "…" } }
```

---

## Public map — `/api/v1/map`

| Method | Path        | Auth | Description                                |
| ------ | ----------- | ---- | ------------------------------------------ |
| GET    | `/reports`  | —    | GeoJSON FeatureCollection within a bbox    |

Query params: `bbox=minLng,minLat,maxLng,maxLat` (required), `status`, `categoryId`, `limit`.

```json
// 200 (GeoJSON)
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.9776, 45.8131] },
      "properties": { "id": "…", "title": "…", "status": "new", "categorySlug": "traffic-infrastructure",
                      "upvoteCount": 12 } }
  ]
}
```

---

## Public statistics — `/api/v1/stats`

| Method | Path | Auth | Description                                   |
| ------ | ---- | ---- | --------------------------------------------- |
| GET    | `/`  | —    | Public dashboard aggregates (tenant-scoped)   |

```json
// 200
{ "data": {
  "total": 128,
  "resolvedPct": 41.4,
  "byStatus":   [ { "status": "new", "count": 30 }, { "status": "resolved", "count": 50 } ],
  "byCategory": [ { "categoryId": "…", "name": "Public lighting", "slug": "public-lighting", "count": 22 } ]
} }
```

Richer analytics (priority breakdown, average resolution time, most-burdened entities, active
reporters, satisfaction) are available to staff at `GET /api/v1/admin/stats`.

---

## Admin — `/api/v1/admin`

All routes require an authenticated **staff** member (`reviewer`, `conductor`, `community_manager`,
`tenant_admin`); `super_admin` always passes. Routes marked **admin** require `tenant_admin`. Every
route is tenant-scoped.

### Dashboard & report management
| Method | Path                       | Auth   | Description                                      |
| ------ | -------------------------- | ------ | ------------------------------------------------ |
| GET    | `/stats`                   | staff  | Dashboard analytics (status/category/priority, avg resolution, top entities/reporters, satisfaction) |
| GET    | `/reports`                 | staff  | List reports incl. private fields (filters/search) |
| PATCH  | `/reports/:id/status`      | staff  | Change status (validated transition + history)   |
| PATCH  | `/reports/:id/priority`    | staff  | Update priority                                  |
| PATCH  | `/reports/:id/assign`      | staff  | Assign to an entity (`accepted`→`assigned`); omit `entityId` to use the category route |
| POST   | `/reports/:id/merge`       | staff  | Merge as duplicate of `canonicalId` with required `note` (closes it) |
| GET    | `/reports/:id/assignment-history` | staff | List assignment/reassignment audit history |
| GET    | `/reports/:id/comments`    | staff  | List internal comments                           |
| POST   | `/reports/:id/comments`    | staff  | Add an internal comment                          |
| GET    | `/work-orders`             | staff  | List all tenant work orders                      |
| GET    | `/reports/:id/work-orders` | staff  | List work orders for a report                    |
| POST   | `/reports/:id/work-orders` | conductor/admin | Create a draft work order              |
| GET    | `/work-orders/:id`         | staff  | Get work order details, documents, deliveries, events |
| PATCH  | `/work-orders/:id/status`  | conductor/admin | Advance the work-order lifecycle (`sent` delegates to the send flow) |
| POST   | `/work-orders/:id/send`    | conductor/admin | Generate an immutable PDF snapshot + email it to the responsible entity; transitions to `sent` or `delivery_failed`, recording a delivery attempt (+ audit events) |
| POST   | `/work-orders/:id/document` | conductor/admin | Regenerate a new immutable PDF version without sending (after-send regeneration: new version) |
| GET    | `/work-orders/:id/document` | staff  | Download the current (latest) PDF document |

`GET /reports` query params: `status`, `priority`, `categoryId`, `assignedEntityId`, `q`,
`sort` (`recent` | `top` | `priority`), `page`, `limit`.

### Responsible entities & routing
| Method | Path                          | Auth  | Description                              |
| ------ | ----------------------------- | ----- | ---------------------------------------- |
| GET    | `/entities`                   | staff | List responsible entities                |
| POST   | `/entities`                   | admin | Create entity                            |
| PATCH  | `/entities/:id`               | admin | Update / deactivate entity               |
| GET    | `/routes`                     | staff | List category → entity routing           |
| PUT    | `/categories/:id/route`       | admin | Set the entity a category routes to      |

### Category configuration
| Method | Path                                | Auth  | Description                |
| ------ | ----------------------------------- | ----- | -------------------------- |
| POST   | `/categories`                       | admin | Create category            |
| PATCH  | `/categories/:id`                   | admin | Update category            |
| DELETE | `/categories/:id`                   | admin | Deactivate category        |
| POST   | `/categories/:id/subcategories`     | admin | Create subcategory         |
| DELETE | `/subcategories/:id`                | admin | Deactivate subcategory     |

### Users
| Method | Path                | Auth  | Description                                       |
| ------ | ------------------- | ----- | ------------------------------------------------- |
| GET    | `/users`            | admin | List tenant users                                 |
| PATCH  | `/users/:id/role`   | admin | Change a user's role (citizen…tenant_admin)       |

```json
// PATCH /admin/reports/:id/status
{ "toStatus": "in_progress", "note": "Crew dispatched" }
// closing or reopening requires a non-empty note; resolving/closing is blocked while active work orders exist
{ "toStatus": "closed", "note": "Closed after confirmation" }
// PATCH /admin/reports/:id/assign  (entityId optional → category's automatic route)
{ "entityId": "…" }
// POST /admin/reports/:id/merge
{ "canonicalId": "…", "note": "Same issue reported two streets away" }
// duplicate merge is blocked if either report has active assignment/work orders
// POST /admin/reports/:id/work-orders
{ "entityId": "…", "title": "Repair pothole", "description": "Crew instructions", "dueAt": "2026-07-01T10:00:00.000Z" }
// PATCH /admin/work-orders/:id/status
{ "toStatus": "sent", "note": "Sent to entity by email" }
// `sent` delegates to the send flow (PDF + email delivery); status becomes sent/delivery_failed
// issuing a work order (generate immutable PDF + email to responsible entity):
// POST /admin/work-orders/:id/send
{ "regenerate": false }
// → { "status": "sent" | "delivery_failed", "documentId": "...", "deliveryId": "..." }
// retryable on delivery_failed once the entity's email is configured/fixed
// POST /admin/work-orders/:id/document  — regenerate a new immutable PDF version (no send)
// GET  /admin/work-orders/:id/document  — download the latest PDF
// cancellation requires a reason; work orders are not deleted from normal operations
{ "toStatus": "cancelled", "note": "Created for the wrong responsible entity" }
```

> Public statistics (`GET /api/v1/stats`) and super-admin tenant management are documented in their
> own sections / planned for a later milestone.

---

## Health

| Method | Path        | Description            |
| ------ | ----------- | ---------------------- |
| GET    | `/health`   | Liveness/readiness probe |
