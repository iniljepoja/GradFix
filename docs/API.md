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

---

## Categories — `/api/v1/categories`

| Method | Path                       | Auth          | Description                       |
| ------ | -------------------------- | ------------- | --------------------------------- |
| GET    | `/`                        | —             | List active categories for tenant |
| GET    | `/:id/subcategories`       | —             | List subcategories of a category  |
| POST   | `/`                        | admin         | Create category                   |
| PATCH  | `/:id`                     | admin         | Update category                   |
| DELETE | `/:id`                     | admin         | Deactivate category               |
| POST   | `/:id/subcategories`       | admin         | Create subcategory                |

```json
// GET /categories → 200
{ "data": [
  { "id": "…", "name": "Roads", "slug": "roads", "icon": "road", "sortOrder": 0 },
  { "id": "…", "name": "Lighting", "slug": "lighting", "icon": "bulb", "sortOrder": 1 }
] }
```

---

## Reports — `/api/v1/reports`

| Method | Path               | Auth                | Description                                          |
| ------ | ------------------ | ------------------- | ---------------------------------------------------- |
| GET    | `/`                | —                   | List/filter reports (public)                         |
| GET    | `/:id`             | —                   | Report detail (incl. photos, current status)         |
| GET    | `/:id/history`     | —                   | Status history timeline                              |
| POST   | `/`                | ✓ (verified)        | Create a report                                      |
| PATCH  | `/:id`             | owner / moderator   | Edit title/description/category (limited fields)     |
| DELETE | `/:id`             | owner / admin       | Delete a report                                      |
| POST   | `/:id/photos`      | owner               | Upload photo(s) (`multipart/form-data`, field `photos`) |
| PATCH  | `/:id/status`      | moderator / admin   | Change status (records history)                      |
| POST   | `/:id/upvote`      | ✓                   | Upvote (idempotent per user)                         |
| DELETE | `/:id/upvote`      | ✓                   | Remove upvote                                        |

**GET /reports** query params: `status`, `categoryId`, `subcategoryId`, `q` (text search),
`sort` (`recent` | `top` | `nearest`), `page`, `limit`.

```json
// POST /reports request
{
  "title": "Large pothole on Ilica",
  "description": "Deep pothole near tram stop",
  "categoryId": "…", "subcategoryId": "…",
  "latitude": 45.8131, "longitude": 15.9776,
  "address": "Ilica 100, Zagreb",
  "priority": "high"
}
// 201
{ "data": { "id": "…", "status": "submitted", "upvoteCount": 0, "createdAt": "…" } }
```

**PATCH /reports/:id/status**
```json
{ "toStatus": "in_progress", "note": "Crew dispatched" }
// 200 → appends a report_status_history row
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
      "properties": { "id": "…", "title": "…", "status": "submitted", "categorySlug": "roads",
                      "upvoteCount": 12 } }
  ]
}
```

---

## Admin — `/api/v1/admin`

Tenant `admin` (scoped to their tenant) and `super_admin` (cross-tenant) routes.

| Method | Path                        | Auth        | Description                              |
| ------ | --------------------------- | ----------- | ---------------------------------------- |
| GET    | `/reports`                  | admin       | All reports (incl. private fields)       |
| GET    | `/reports/stats`            | admin       | Counts by status/category, resolution KPIs |
| GET    | `/users`                    | admin       | List tenant users                        |
| PATCH  | `/users/:id/role`           | admin       | Change a user's role                     |
| GET    | `/tenants`                  | super_admin | List tenants                             |
| POST   | `/tenants`                  | super_admin | Create a tenant                          |
| PATCH  | `/tenants/:id`              | super_admin | Update tenant settings                   |

---

## Health

| Method | Path        | Description            |
| ------ | ----------- | ---------------------- |
| GET    | `/health`   | Liveness/readiness probe |
