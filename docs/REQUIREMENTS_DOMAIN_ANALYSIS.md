# GradFix Requirements and Domain Analysis

Date: 2026-06-23

This document reviews the Studio Present GradFix internship specification, the current repository, the
database schema, API design, frontend flows, and implementation decisions. It is intentionally critical:
the goal is to identify unresolved product/domain decisions before adding more features.

Sources reviewed:
- Internship specification pages 1-9 supplied in the prompt.
- `README.md`, `CHANGELOG.md`, `CLAUDE.md`.
- `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/ERD.md`, `docs/GAP_ANALYSIS.md`, `docs/ROADMAP.md`.
- Backend schema, seed, routes, services, middleware under `backend/src`.
- Frontend API client, auth context, report flow, public map, stats, dashboard, and admin report UI under `frontend/src`.

## Executive Summary

GradFix is currently beyond initial setup and backend core. It has a functional Express/PostgreSQL API,
a citizen PWA flow, public map/statistics, and a partial admin panel. The system has made several
important domain choices that are not explicitly settled in the specification:

- A report has exactly one category and optionally one subcategory.
- A report has at most one assigned responsible entity.
- Category routing maps one category to one responsible entity.
- Duplicate merging closes the duplicate report and links it to a canonical report.
- Work orders are not modeled yet.
- Only status changes have first-class audit history.
- Tenant isolation is intended to be enforced in queries, but authentication is not strongly bound to
  the resolved tenant.

The highest-risk gaps are not missing screens; they are unclear domain rules around assignment,
duplicate handling, work orders, auditability, tenant security, and concurrent admin actions.

## Highest-Priority Unresolved Decisions

These decisions should be clarified before further implementation.

| Priority | Decision | Why it matters |
| --- | --- | --- |
| P0 | Must authenticated users be bound to the request tenant? | Current API trusts `X-Tenant` independently from the JWT tenant claim. A user/admin from one tenant may be able to act in another tenant unless every service manually prevents it. |
| P0 | Which admin actions require audit history? | Status changes are recorded, but priority, assignment, duplicate merge, category/entity/routing/user-role changes are not fully audited as first-class domain events. |
| P0 | Is assignment single-service or multi-service? | Current schema supports one `assigned_entity_id`; real municipal issues may require several services and several work orders. |
| P0 | What is the lifecycle of a work order? | The spec requires PDF work orders and email delivery, but no lifecycle, retry, cancellation, acceptance, or completion rules are defined. |
| P0 | What happens if duplicate reports are merged incorrectly? | Current model has no unmerge/reopen-as-independent flow, no transfer rules for upvotes/comments/photos, and limited audit trail. |
| P1 | Can reports be reopened after closure? | Backend allows `resolved -> in_progress`, but not `closed -> ...`; the spec does not say whether closed is final. |
| P1 | Should citizens be notified on every status/admin action? | Email exists for status only; assignment, duplicate merge, comments, work orders, and rating outcomes are undefined. |
| P1 | Which report fields are immutable after submission? | There are no edit endpoints yet, but future admin/citizen edits need clear rules for photos, location, category, title, description, and priority. |
| P1 | Are anonymous reports allowed? | Spec requires registration for filing reports, but schema allows `reporter_id = NULL`; public viewing is anonymous. |
| P1 | What is the public visibility policy for resolved, closed, rejected, duplicate, sensitive, or unsafe reports? | Current public map/list can show all statuses and photos unless filtered. |
| P1 | What is the difference between `resolved` and `closed`? | Spec lists both states, but acceptance criteria and who performs each transition are not defined. |
| P1 | Should upvotes represent ongoing presence, citizen support, severity, or duplicate count? | Current UI uses “affected citizens”; the spec also asks for confirmation still-present/resolved, which is a different signal. |
| P2 | How tenant categories should be initialized and customized? | Spec says configured via admin; seed provides taxonomy, but governance and templates are undefined. |
| P2 | What data retention/privacy rules apply to user accounts, photos, reports, and audit logs? | Reports may contain faces, license plates, exact locations, and personal data. |
| P2 | What analytics are acceptable publicly versus staff-only? | Public dashboard and heat maps can expose sensitive patterns. |

## Current Implementation Snapshot

Implemented or partially implemented:
- Multi-tenant shared database with `tenant_id` discriminator and tenant resolution by `X-Tenant` or subdomain.
- Email/password registration, login, refresh tokens, email verification, password reset, profile, badges.
- Citizen report creation with 1-3 photos, GPS coordinates, category/subcategory, title, optional description/address, priority.
- Server-side photo compression/storage and frontend canvas compression.
- Public report list/detail/history, public map by bounding box, upvotes, public statistics.
- Report lifecycle `new -> accepted -> assigned -> in_progress -> resolved -> closed`, plus `resolved -> in_progress`.
- Admin backend for report listing/detail, status, priority, assignment, duplicate merge, internal comments, entities, routing, categories, users, stats.
- Partial admin frontend: report queue, detail, status change, assignment, comments, and duplicate merge UI in the current working tree.
- PWA manifest and service worker tile caching.

Major missing or incomplete areas:
- Main/super admin tenant management.
- Work orders: PDF generation, work-order lifecycle, email delivery, retries, history, UI.
- Multiple assignees or multiple work orders per report.
- Push notification delivery.
- Public still-present/resolved confirmations.
- CSV/Excel export.
- Heat map layer/aggregation.
- Tenant notification settings.
- i18n core.
- Strong audit/event log beyond status history.
- End-to-end, tenant-isolation, and concurrency tests.
- Offline “view own reports” and offline draft/queue behavior, despite architecture docs mentioning it.

## Cross-Cutting Domain Findings

### Tenant Isolation and Authorization

Specified:
- One city equals one tenant.
- Main admin manages all tenants.
- Data isolation per city.

Current design:
- Tenant is resolved from `X-Tenant` or subdomain in `middleware/tenant.js`.
- Most queries filter by `req.tenant.id`.
- JWT contains user role and tenant claim, but route handlers generally do not verify that `req.user.tenantId` matches `req.tenant.id`.
- `authorize()` trusts the role in the token and allows `super_admin` across admin routes.

Risks:
- A citizen or staff user authenticated in tenant A may send `X-Tenant: tenant-b` and hit tenant B endpoints if the service only uses `req.tenant.id` plus `req.user.id`.
- A tenant admin from one tenant may be able to access another tenant’s `/admin` routes because authorization checks role, not tenant membership.
- `createReport()` checks email verification by `user.id` only, then inserts a report under the requested tenant. This can create cross-tenant reporter references unless blocked elsewhere.
- Public/static photo URLs are outside `/api/v1`; uploaded photo access is not tenant-checked once the URL is known.

Recommended rules:
- For non-super-admin users, reject requests where JWT tenant does not equal resolved tenant.
- Define explicit behavior for `super_admin`: cross-tenant read-only by default, tenant operations only through tenant-management routes or with explicit target tenant.
- Add tenant-isolation tests for every route and every new tenant-scoped query.
- Consider database-level row-level security later, but do not rely on it as a substitute for fixing auth/tenant binding.

Questions:
- Can a staff user belong to multiple tenants?
- Can a super admin impersonate a tenant admin, or only manage configuration from a separate console?
- Should uploaded files be public by URL, signed, or proxied through tenant-aware authorization?

### Audit and Accountability

Specified:
- Status changes, assignments, duplicate merging, internal comments, work orders, and user roles are part of admin workflows.

Current design:
- `report_status_history` tracks status transitions with `changed_by`, note, and timestamp.
- Internal comments record author and timestamp.
- Priority updates, assignment, duplicate merge, category/entity/routing changes, user-role changes, photo additions, ratings, notification delivery, and work-order actions do not have complete structured audit history.

Risks:
- Admin mistakes cannot be reconstructed reliably.
- Legal/accountability questions cannot be answered: who assigned this, who changed priority, why was a duplicate merged, who changed category routing, which email was sent?
- `updated_at` tells when a row changed, not what changed or who changed it.

Recommended rules:
- Introduce a domain event/audit log before expanding admin functionality.
- Treat these as audit-worthy: status changes, priority changes, assignment/reassignment, duplicate merge/unmerge, category/subcategory changes, routing changes, entity changes, user-role changes, work-order creation/sending/status, notification attempts, report moderation/hiding, photo deletion, data export.
- Store actor, tenant, target type/id, action, before/after summary, reason/note, timestamp, request id, and IP/user agent where appropriate.

Questions:
- How long must audit logs be retained?
- Can audit records ever be deleted under privacy law, or only redacted?
- Which audit fields are visible to citizens versus staff versus super admins?

### Concurrency and Consistency

Specified:
- Admins manage reports, assign, merge duplicates, change statuses, update priority.

Current design:
- Status changes use `SELECT ... FOR UPDATE`, which protects status transition races.
- Assignment and duplicate merge run in transactions but do not lock report rows in the same way.
- Photo count enforcement is vulnerable to concurrent uploads because count and insert are not locked together.
- Priority updates do not check current state or version.

Risks:
- Two admins may assign or merge the same report concurrently and produce confusing history.
- A report may be reassigned while another admin resolves or closes it.
- Concurrent photo uploads may exceed the max-three rule.
- Admin UI has no optimistic locking/version conflict warning.

Recommended rules:
- Use row locks or optimistic versioning for report state mutations.
- Add a `reports.version` or compare `updated_at` for admin writes.
- Return conflict errors when the report changed since the admin opened it.
- Use transactional locking for photo count enforcement.

Questions:
- Should the last admin action win, or should conflicting concurrent actions be rejected?
- Should the UI show “this report changed since you opened it” warnings?

### Scalability Concerns

Specified:
- The architecture should be scalable across multiple city tenants.
- Public map, dashboards, file storage, and admin workflows are expected to work as report volume grows.

Current design:
- Public map queries use latitude/longitude bounding boxes and a configurable limit.
- Report lists are paginated.
- Photos are stored on local disk under tenant-prefixed paths.
- Tenant isolation is application-layer filtering in a shared schema.

Risks:
- Map queries and marker rendering will degrade as report counts grow; there is no clustering, tile indexing, or heat aggregation yet.
- Local file storage does not scale well across multiple backend instances and complicates backup/restore.
- Shared-schema tenancy can scale for MVP, but noisy tenants can affect others without quota/rate controls.
- Statistics are calculated live from transactional tables; period filters and exports can become expensive.
- Global rate limits are blunt: high activity in one area can affect legitimate usage while still not stopping targeted abuse.

Recommended rules:
- Define expected scale for MVP, demo, and pilot: tenants, users, reports, photos, concurrent admins, uploads/day.
- Add map clustering or server-side aggregation before large demo datasets.
- Move production uploads to object storage with lifecycle/retention policies.
- Add tenant-level quotas and per-route rate limits.
- Cache public dashboard aggregates or precompute analytics once data volume grows.

Questions:
- What is the target number of reports per city for the internship demo versus a real pilot?
- Is horizontal backend scaling expected during the project?
- Should each tenant have storage/report quotas?

### UX and Operational Usability Concerns

Specified:
- The citizen app should be simple and usable by a wide age range.
- Admin panel should let city staff manage reports efficiently.

Current design:
- Citizen reporting is a guided five-step wizard.
- Public map is the landing page.
- Admin report management is queue/detail based.

Risks:
- Map-first navigation can be difficult for users who do not understand maps or cannot grant geolocation.
- Required photo and GPS steps can block valid reports from users with older devices or limited connectivity.
- Admins can make destructive operational decisions, such as merging duplicates or changing status, without a fully defined reason/audit workflow.
- Frontend action availability may not always match role permissions, causing avoidable API errors and staff confusion.
- The meaning of status, priority, “affected citizens”, and resolved/closed is not explained to end users.

Recommended rules:
- Provide plain-language explanations for status, priority, and duplicate/support behavior.
- Add non-map fallbacks for location selection.
- Require confirmations and reason notes for irreversible or high-impact admin actions.
- Align frontend role/action visibility with the backend permission matrix.
- Test the report flow with non-technical users before polish week.

Questions:
- Should a citizen be able to file a report without a current GPS fix?
- Which admin actions should require a confirmation dialog and reason note?
- What training/context will city staff receive before using the admin panel?

## Specification Section Analysis

## 1. Project Overview

Summary of what is specified:
- A PWA mobile application for citizens to report urban furniture, traffic infrastructure, vegetation, and related issues.
- An administration panel for city government.
- Inspired by FixMyStreet and similar civic-reporting systems.
- Citizens should actively participate in improving the city.

Implicit requirements:
- Reports are civic records and may be used operationally by government staff.
- The app must be trusted by both citizens and municipal staff.
- Public visibility matters: citizens should see that reports are handled.
- Abuse prevention matters: false reports, spam, offensive photos, and duplicate flooding are realistic.

Missing decisions:
- Is GradFix an official municipal record system or only an intake/front-office tool?
- Are reports legally binding complaints, informal requests, or public suggestions?
- Are all reports public by default?
- Can municipal staff hide or moderate reports before public display?
- Can reports be filed on private property or only public city property?

Risks:
- Publicly visible reports may expose private locations, faces, license plates, vulnerable persons, or security hazards.
- Without moderation rules, inappropriate photos/text may be displayed publicly.
- If the public treats status as a government commitment, unclear status definitions create reputational risk.

Recommended business rules:
- Define report as a public civic issue record with moderation controls.
- Keep original report submission immutable; corrections should be appended as audit events or staff edits with history.
- Add a moderation state or visibility flag separate from operational status.
- Define terms of use and privacy policy before public deployment.

Questions before implementation:
- Who owns the report data: the tenant city, platform operator, or reporter?
- Are photos and descriptions public immediately after submission?
- Can citizens delete their own reports?
- What categories of content require hiding or escalation?

## 2. Technical Specification and Architecture

Summary of what is specified:
- Citizen PWA and admin panel talk to a REST API.
- Backend stores data in PostgreSQL, uses OpenStreetMap/Leaflet, and file storage.
- Multi-tenant architecture: one city equals one tenant, main admin manages tenants, data isolated per city.
- Recommended stack: React/Next/Vue, Node/Express or FastAPI, PostgreSQL, OSM/Leaflet, local/S3-compatible storage.

Current implementation:
- React/Vite PWA frontend, Express backend, PostgreSQL schema, OSM/Leaflet, local disk uploads.
- Shared database/shared schema with tenant discriminator.
- No tenant-management UI/API for main admin yet.

Missing decisions:
- Whether tenant isolation must be logical only, row-level security, separate schemas, or separate databases.
- How tenants are created, suspended, migrated, backed up, deleted, or restored.
- Whether tenant-level configuration includes branding, languages, map bounds, allowed categories, notification settings, privacy settings, and SLA rules.
- Whether file storage is tenant-isolated physically or only by path prefix.

Risks:
- Logical isolation depends on every query being correct; one missing tenant filter can leak data.
- Current auth/tenant binding is weak, as noted above.
- Local file storage is acceptable for MVP but complicates backups, tenant deletion, and horizontal scaling.
- OSM tile usage may require cache/rate policy review for production.

Recommended business rules:
- Every tenant-scoped request must satisfy both resolved tenant and authenticated tenant membership.
- Define tenant lifecycle: provision, activate, suspend, archive, delete.
- Store tenant settings explicitly: map center/bounds, languages, category template, notification preferences, public visibility defaults, SLA targets.
- Use object storage abstraction before production if multiple backend instances are expected.

Questions before implementation:
- Can one user belong to multiple cities?
- Can the same email register in multiple tenants?
- Can tenants customize categories independently, or are categories centrally templated?
- How is tenant data exported if a city leaves the platform?

## 3A. Citizen Application

### Registration and Authentication

Summary of what is specified:
- Mandatory registration with valid email.
- Email verification.
- Forgotten-password flow.
- Profile with report history.

Current implementation:
- Registration, login, refresh tokens, logout, email verification, forgot/reset password, `/auth/me`, and `/reports/mine` exist.
- Unverified citizens cannot log in or create reports; staff and super_admin bypass verification.
- Refresh token is stored in browser `localStorage`.

Missing decisions:
- Whether staff users also use the same auth flow.
- Whether email verification should be required before login or only before report creation.
- Whether accounts can be deactivated, deleted, anonymized, or transferred.
- Whether phone number, address, or municipal ID is ever required.
- Whether social login or government identity integration is expected.

Edge cases:
- Verification email send failure after account insertion can leave a user created without a sent email.
- Duplicate registration likely relies on database conflict handling and may produce a generic error.
- Password reset tokens are single-use, but multiple active reset tokens can exist.
- Refresh token rotation can race across multiple tabs.
- Users can change `X-Tenant` while using a token from a different tenant unless blocked.

Security concerns:
- Refresh tokens in `localStorage` are exposed if XSS occurs.
- Rate limiting is global, not tailored to login, password reset, registration, and email verification abuse.
- No account lockout, suspicious login detection, or audit trail for auth events.

Recommended business rules:
- Bind token tenant to request tenant.
- Add explicit duplicate-email handling with safe user-facing messages.
- Make email verification resend part of UX and rate limit it.
- Audit login failures, password resets, email verification, and role changes.
- Define account deletion/anonymization behavior for existing reports.

Questions before implementation:
- Can users change email addresses?
- If a user is deleted, should their reports remain public as anonymous?
- How long do auth/session logs need to be retained?

### Reporting a Problem Flow

Summary of what is specified:
- Flow: photo mandatory, automatic GPS, category/subcategory, description, priority, review and submit.
- Max 3 compressed photos.
- Categories configured via admin.

Current implementation:
- Frontend wizard has Photos, Location, Category, Details, Review.
- Backend requires 1-3 photos at creation, validates lat/lng/category, and auto-routes by category.
- Title is required by implementation, although spec only mentions description.
- Description is optional by implementation, although spec says problem description as a step.
- Address is optional.
- Report location/category/photos are not editable after submission.

Missing decisions:
- Can a report belong to multiple categories?
- Is subcategory mandatory for some categories?
- Is title required, or should description be the primary text field?
- Which fields are immutable after submission?
- Can a citizen correct a wrong location/category/photo after submitting?
- What minimum/maximum description length is required?
- Are photos allowed to contain people, license plates, minors, or private property?
- Is automatic GPS mandatory, or can a user manually place a pin if GPS fails?

Edge cases:
- GPS unavailable, denied, inaccurate, or spoofed.
- Citizen reports the same issue repeatedly instead of supporting an existing report.
- Photo compression fails and original image is stored, possibly retaining EXIF metadata.
- Upload files are processed before DB transaction; rollback can leave orphaned files.
- Simultaneous add-photo requests can exceed max-three without locking.
- Report category can be deactivated after draft started but before submit.

Potential UX problems:
- The wizard requires title but the spec emphasizes description; users may not know what title means.
- Priority is citizen-assessed but no guidance explains low/medium/high/critical.
- GPS pin accuracy and confidence are not displayed.
- Duplicate suggestions are helpful but do not block duplicate creation or explain when not to file.

Recommended business rules:
- One primary category for routing, optional secondary tags only if explicitly needed.
- Require either description or title+description according to a clear content policy.
- Store original submission fields immutably; allow corrections as appended revisions or staff edits with audit.
- Capture location source and accuracy where available.
- Strip EXIF metadata consistently, including fallback paths.
- Define priority meanings and whether staff can override citizen priority.

Questions before implementation:
- Can reports include multiple photos after submission, and until which status?
- Can citizens edit or withdraw a report?
- Should staff be allowed to reclassify a report to another category?
- Should report creation be allowed outside tenant city boundaries?

### Problem Categories

Summary of what is specified:
- Five configurable categories with listed subcategories: Urban furniture, Public lighting, Traffic infrastructure, Vegetation, Other.

Current implementation:
- Seed data matches the five categories and subcategories.
- Admin backend can create/update/deactivate categories and subcategories.
- Current report schema supports one category and one optional subcategory.

Missing decisions:
- Whether categories are global templates or tenant-owned copies.
- Whether subcategories are mandatory.
- Whether category changes should affect existing reports, routing, statistics, and work orders.
- Whether inactive categories remain visible on old public reports.

Risks:
- Changing category slugs/names may break analytics or external reports if not versioned.
- Deactivating a category used by active reports may confuse staff workflows.
- Subcategory validation does not require `is_active = TRUE` in report creation.

Recommended business rules:
- Treat categories as tenant configuration with stable IDs and soft deletion.
- Version or audit category/routing changes.
- Prevent new reports against inactive categories/subcategories.
- Decide whether old report category labels should be historical snapshots or current category names.

Questions before implementation:
- Can a tenant rename “Traffic infrastructure” to a local term?
- Are categories translated per language?
- Can one subcategory route differently from its parent category?

### Report Tracking

Summary of what is specified:
- Status lifecycle: New -> Accepted -> Assigned -> In progress -> Resolved -> Closed.
- Push/email notifications on status change.
- Ability to rate the resolution as satisfied/unsatisfied with comment.

Current implementation:
- Status enum and transitions exist, with status history.
- Email notification is sent after status change; push subscription storage exists but delivery is TODO.
- Rating endpoint allows reporter to rate once report is resolved or closed, but uses upsert so rating can be changed.

Missing decisions:
- Who can perform each transition?
- What are acceptance criteria for each state?
- Is `closed` final?
- Can `resolved` become `in_progress` after an unsatisfied rating?
- Are rejected/invalid/out-of-scope reports needed? Current enum has no `rejected`.
- Should duplicates have a separate status or visibility flag?
- Which notifications are mandatory versus user-configurable?

Edge cases:
- Report auto-routes to an entity at creation while status remains `new`.
- A report may be assigned entity before formal `assigned` status.
- `resolved_at` is not cleared when a report is reopened to `in_progress`.
- `closed_at` remains if a future reopen-from-closed rule is added.
- Rating a duplicate `closed` report may be allowed if the reporter owns it, even though it was not actually resolved.

Recommended business rules:
- Define status state machine with actor permissions, allowed transitions, side effects, and notification policy.
- Separate operational status from classification flags such as duplicate, rejected, hidden, spam, out-of-scope.
- If reopening is allowed, define timestamp behavior and audit reason requirements.
- Make rating rules explicit: one final rating, editable until closure, or multiple rating events.

Questions before implementation:
- Should a citizen be notified on assignment, reassignment, comments, merge, work-order sent, and closure?
- Can citizens dispute a resolution?
- Should closure require citizen confirmation or timeout after resolution?

### Public Map

Summary of what is specified:
- Display other citizens’ reports.
- Upvote system: “I have this problem too”.
- Confirmation that a problem is still present or resolved.
- Available without registration.

Current implementation:
- Public map fetches reports by bounding box and shows markers.
- Public detail is available anonymously.
- Upvote requires authentication.
- Duplicate-prevention panel uses nearby reports and upvote as “affected citizens”.
- Still-present/resolved confirmation is not implemented.

Missing decisions:
- Which reports are public: all, accepted only, non-closed only, moderated only?
- Can anonymous users upvote/confirm, or must they register?
- What is the difference between upvote, still-present confirmation, and unsatisfied rating?
- How stale reports are handled on the map.
- Whether exact coordinates should be generalized for sensitive reports.

Risks:
- Displaying all reports immediately can expose abusive content or privacy-sensitive photos.
- Upvotes on closed/resolved reports may inflate “affected citizens” without representing current presence.
- Map endpoint can return many points; no clustering or heat aggregation yet.

Recommended business rules:
- Define public visibility states independent of operational status.
- Separate “affected too” from “still present” and “resolved confirmation”.
- Disable or reinterpret support actions after closure/resolution.
- Add moderation controls for public content.

Questions before implementation:
- Can citizens confirm an issue as resolved if they are not the original reporter?
- How often can a user confirm still-present?
- Should confirmations expire over time?

### Gamification Badges

Summary of what is specified:
- Six badge ranks based on report count: first report, 5, 15, 30, 50, 100+.

Current implementation:
- `/auth/me` returns badge based on count of reports by reporter.

Missing decisions:
- Whether duplicate, rejected, spam, withdrawn, or deleted reports count.
- Whether “supporting” an existing issue should count toward engagement.
- Whether badges are tenant-specific or global across cities.
- Whether badge recalculation should be historical if reports are merged/deleted.

Risks:
- Badges may incentivize duplicate or low-quality reports.
- Report count alone may reward noise rather than civic value.

Recommended business rules:
- Count only accepted/non-abusive reports, or separate “reports filed” from “verified contributions”.
- Include duplicate support and confirmations as lower-weight contribution types if desired.
- Keep badge logic tenant-scoped unless cross-tenant identity is explicitly supported.

Questions before implementation:
- Should staff moderation be able to exclude reports from gamification?
- Should citizens see why a report did not count?

### Public Dashboard

Summary of what is specified:
- Public statistics without registration: reports per category, percentage resolved, heat map of problems.

Current implementation:
- Public stats include total, resolved percentage, by status, by category.
- Heat map is not implemented.

Missing decisions:
- Date ranges and default period.
- Whether closed duplicates count as resolved.
- Whether public statistics include hidden/moderated reports.
- How heat map precision should be reduced to protect privacy.

Risks:
- Public heat maps can expose sensitive locations or imply poor service quality without context.
- Statistics can be gamed by duplicate reports and upvotes.

Recommended business rules:
- Define metric formulas precisely: denominator, included statuses, duplicate handling, time range.
- Aggregate heat maps to grid/cell level, not exact points.
- Provide staff-only richer analytics and public-safe summaries.

Questions before implementation:
- Should dashboard data be real-time or cached?
- Are public exports allowed?

## 3B. Administration

### Role System

Summary of what is specified:
- Super Admin manages all tenants.
- Tenant Admin manages a single city.
- Reviewer reviews and triages reports.
- Conductor issues work orders and updates status.
- Community Manager communicates with citizens, notifications, statistics.

Current implementation:
- Roles exist in DB and authorization middleware.
- Admin routes are staff-gated; some write actions are role-specific.
- Frontend staff route checks staff role.

Missing decisions:
- Full permission matrix for every endpoint and UI action.
- Whether roles can be combined.
- Whether users can have different roles in different tenants.
- Whether super admins can access tenant citizen/admin views directly.

Risks:
- Community managers can currently read admin report listings/details because all staff can access many read routes. This may expose reporter emails and private fields beyond intended communication/statistics scope.
- Frontend admin action visibility may not fully match backend permissions.
- User role changes are not audited.

Recommended business rules:
- Define explicit permission matrix for read/write by role.
- Separate PII access from operational access.
- Audit role changes and require tenant admin/super admin reason.

Questions before implementation:
- Can Reviewer assign, or only Conductor?
- Can Community Manager see reporter email and internal comments?
- Can Tenant Admin close reports directly?

### Report Management

Summary of what is specified:
- Overview with filters/search.
- Status changes.
- Assignment to responsible entity.
- Duplicate merging.
- Internal comments.
- Priority updates.

Current implementation:
- Backend supports these core operations.
- Frontend supports report queue/detail, status, priority, assignment, comments, and duplicate merge in current working tree.

Missing decisions:
- Whether status, priority, category, and assignment changes require reason notes.
- Whether duplicate merge transfers upvotes, comments, photos, rating, and subscriptions to the canonical report.
- Whether duplicates can later become independent again.
- Whether priority is citizen-only, staff-only, or both with separate fields.
- Whether admins can edit submitted title/description/location/category.

Edge cases:
- Two admins make conflicting edits at the same time.
- Report is reassigned while in progress.
- Report is merged after work has started.
- Report is resolved while duplicate merge dialog is open.
- Assigned entity is deactivated while report is active.

Recommended business rules:
- Require reason notes for assignment changes, priority changes, merge/unmerge, and closure.
- Add assignment history separate from status history.
- Decide if citizen priority and staff priority are separate fields.
- Define duplicate merge side effects and unmerge process.
- Use locking/version checks for all admin mutations.

Questions before implementation:
- Can duplicate reports later become independent again?
- Should canonical reports inherit affected-citizen counts from duplicates?
- Should reporters of duplicate reports receive canonical report updates?

### Automatic Routing

Summary of what is specified:
- Category maps to responsible company/organization.
- Configured through admin panel.
- Optional assignment to informal groups.

Current implementation:
- `category_routes` maps one category to one responsible entity.
- Report creation auto-fills `assigned_entity_id` from category route.
- Assignment endpoint can fall back to route.

Missing decisions:
- Whether routes can depend on subcategory, geography, priority, time, or workload.
- Whether multiple entities can be routed.
- Whether auto-routing should set only a suggestion or a formal assignment.
- What happens when a route changes after reports already exist.

Risks:
- One route per category is likely too simple for real cities.
- Auto-assigning while status is still `new` creates ambiguity: assigned entity exists before report is accepted.
- No routing history means old decisions cannot be explained after route config changes.

Recommended business rules:
- Treat routing result as a proposed assignment until reviewer accepts or conductor assigns.
- Add routing history/evaluation event to reports.
- Support future route rules by category, subcategory, location, and priority if the city needs it.

Questions before implementation:
- Can multiple municipal services be assigned to the same report?
- Can a report be reassigned after work has started?
- Should route changes affect only new reports or also open reports?

### Work Orders

Summary of what is specified:
- PDF generation with report details.
- Email delivery to responsible entity.
- Content: location, photos, description, priority.

Current implementation:
- No work-order schema, API, or UI yet.
- Responsible entities have email fields.

Missing decisions:
- Whether one issue can generate multiple work orders.
- Work-order lifecycle: draft, sent, accepted, in progress, completed, canceled, failed delivery.
- Whether work orders are immutable snapshots or update when report changes.
- Whether PDF generation is manual or automatic on assignment.
- Whether email delivery needs retry, bounce handling, and delivery audit.

Risks:
- Without work-order records, sent PDFs cannot be audited or regenerated reliably.
- Reassignment can invalidate previously sent work orders.
- Multiple services may require separate instructions and deadlines.

Recommended business rules:
- Model `work_orders` separately from reports and assignments.
- Allow one report to have many work orders.
- Store generated PDF metadata, recipient, delivery status, sent_by, sent_at, and snapshot data.
- Require cancellation/reissue rules on reassignment or report closure.

Questions before implementation:
- Can one issue generate multiple work orders?
- Who is allowed to create/send/cancel work orders?
- Should responsible entities update status directly, or only city staff?

### Configuration

Summary of what is specified:
- Manage categories/subcategories.
- Add responsible entities.
- Notification settings.
- Multi-language preparation.

Current implementation:
- Backend CRUD exists for categories/subcategories and entities/routes.
- Notification settings and i18n are not implemented.
- Frontend admin configuration screens are not implemented.

Missing decisions:
- Tenant-level notification defaults and user notification preferences.
- Supported languages and fallback behavior.
- Whether content such as categories/subcategories/entities has translated names.
- Configuration change approval/audit requirements.

Risks:
- Config changes can break active reports and routing.
- Lack of i18n model may require schema/API changes later.

Recommended business rules:
- Audit all tenant configuration changes.
- For i18n, avoid hardcoding user-visible enum labels in persisted data; store stable keys and localized labels.
- Define notification templates per tenant/language.

Questions before implementation:
- Which languages are required for Subotica/Serbia demo?
- Can tenants customize notification text?

### Reporting and Analytics

Summary of what is specified:
- Number of reports per category and period.
- Average resolution time.
- Most affected areas heat map.
- Most burdened utility companies.
- Active reporters.
- Export to CSV/Excel.

Current implementation:
- Public and admin stats include totals, category/status/priority breakdown, average resolution hours, burdened entities, active reporters, satisfaction.
- Period filters, heat map, and export are missing.

Missing decisions:
- Which filters are required: period, category, status, priority, entity, geography, reporter.
- Export permissions and PII inclusion.
- Whether exports are audited.
- Definition of average resolution time and how reopened reports affect it.

Risks:
- Active reporter analytics can expose personal behavior if not restricted.
- CSV export is a data-exfiltration path and should be role-gated and audited.
- Average resolution time can be distorted by duplicates and reopened reports.

Recommended business rules:
- Audit every export with filters, row count, actor, timestamp.
- Default exports should exclude sensitive reporter data unless explicitly permitted.
- Define metric formulas in documentation and tests.

Questions before implementation:
- Should exports include photos, reporter emails, internal comments, and audit history?
- What date range should dashboards default to?

## 4. Non-Functional Requirements

### Performance

Summary of what is specified:
- FCP under 2 seconds, TTI under 3 seconds.
- Optimized images.
- Lazy loading for report list.

Current implementation:
- Images are compressed client- and server-side.
- Report lists are paginated.
- No performance budget measurement or automated checks.

Risks:
- Map marker volume can grow beyond frontend capacity.
- Local upload processing uses memory buffers; large concurrent uploads can stress the server.
- No CDN/object storage strategy for photos in production.

Recommended rules:
- Add performance budgets and measure them in CI/lighthouse before demo.
- Add clustering or server-side tiling/aggregation for large map result sets.
- Move photo serving to object storage/CDN for production.

Questions before implementation:
- What is expected city/report scale for MVP and final demo?
- How many concurrent users/uploads should be supported?

### PWA Requirements

Summary of what is specified:
- Manifest, service worker, basic offline functionality for own reports, Add to Home Screen, push notifications.

Current implementation:
- Manifest/service worker exists.
- Basemap tile caching and install/offline indicators exist.
- Offline own-report viewing and draft queue are not implemented, despite architecture docs suggesting queued drafts.
- Push subscription storage exists; push delivery is missing.

Risks:
- Users may assume offline reports are saved when they are not.
- Push notification implementation requires VAPID keys, service worker handling, subscription lifecycle, opt-in UX, and failure handling.

Recommended rules:
- Define exact offline scope: read-only cached dashboard, saved drafts, or background sync submission.
- Make offline state explicit in the report wizard.
- Implement push as opt-in with per-user preferences and delivery audit.

Questions before implementation:
- Should users be able to create reports offline with photos?
- If offline submission fails later, how is the user notified?

### Accessibility and Responsive Design

Summary of what is specified:
- App for ages 7 to 77.
- Large fonts, high contrast, simple navigation, minimal steps.
- Mobile-first, tablet optimization, desktop admin.

Current implementation:
- Basic responsive styles exist.
- No formal accessibility audit or keyboard/screen-reader verification.
- Report wizard has five steps plus duplicate panels, which may or may not be “minimal”.

Risks:
- Map-first interfaces can be difficult for keyboard and screen-reader users.
- Photo/GPS requirements can block elderly or low-end-device users.
- Admin tables may be hard on small screens.

Recommended rules:
- Define accessibility acceptance criteria: keyboard flow, labels, contrast, text size, focus states, map alternatives.
- Provide non-map location entry fallback.
- Test on mobile, tablet, and desktop with seeded scenarios.

Questions before implementation:
- Is WCAG 2.1 AA required?
- What is the minimum supported browser/device set?

### Security

Summary of what is specified:
- HTTPS mandatory.
- Input validation.
- SQL injection protection.
- XSS protection.
- Rate limiting.

Current implementation:
- Helmet, CORS, Zod validation, parameterized SQL, global rate limiter.
- HTTPS is deployment concern and not configured here.
- Some enum filters accept arbitrary strings and may cause database errors rather than validation errors.

Risks:
- Tenant/auth binding issue is the largest security concern.
- Public uploads can contain unsafe or private content.
- Global rate limit is not enough for login/reset/upload abuse.
- Refresh token in localStorage increases impact of XSS.
- No virus scanning or content moderation for uploads.

Recommended rules:
- Fix tenant-bound authorization before expanding admin features.
- Add route-specific rate limits for auth, upload, and writes.
- Add upload content scanning/moderation path before public deployment.
- Add security logging and alerting for admin actions and auth abuse.

Questions before implementation:
- Are uploaded photos public immediately?
- Are penetration/security checks required before final demo?

## 5. Work Organization and Milestones

Summary of what is specified:
- Week 1 setup/planning.
- Week 2 backend core.
- Week 3 citizen frontend.
- Week 4 admin panel.
- Week 5 integration/testing/bug fixes.
- Week 6 polish/demo.

Current milestone assessment:
- Week 1 is complete.
- Week 2 backend core is mostly complete, but tenant/auth security and audit concerns should be addressed before production-like use.
- Week 3 citizen frontend is functionally present.
- Week 4 admin panel is partial and should not expand much further until domain rules are clarified.
- Week 5 integration tasks have already become urgent because tenant isolation, concurrency, audit, and tests influence correct Week 4 behavior.

Recommended milestone adjustment:
- Insert a short “domain hardening” checkpoint before continuing Week 4 work orders/configuration.
- Prioritize requirements decisions, tenant/auth binding, audit model, and assignment/work-order model.

Questions before implementation:
- Is the goal a demo MVP or a system that could be piloted by a real municipality?
- Which risks are acceptable for internship demo only, and which are not?

## 6. Final Presentation

Summary of what is specified:
- Max 10 slides, 15-minute live demo, Q&A.
- Content: problem, solution, architecture, demo, challenges, lessons, next steps.

Missing decisions:
- What demo story is primary: citizen reporting, admin triage, work order, public dashboard, or multi-tenant management?
- Which incomplete features should be hidden versus acknowledged?
- What backup plan exists if email, map tiles, geolocation, or local DB fails?

Risks:
- Demo can fail if it depends on live geolocation, mail delivery, external map tiles, or a clean local seed.
- Showing admin workflows without clear business rules may invite difficult Q&A.

Recommended rules:
- Build demo around one coherent end-to-end scenario.
- Prepare seeded data and backup screenshots/videos.
- Be transparent about deferred features and why.

Questions before implementation:
- Which features must be demo-ready to satisfy mentors?
- Should work orders be shown as implemented or as next-step design?

## 7. Rewards and Internship Context

Summary of what is specified:
- Winner receives paid internship and related benefits.

Domain impact:
- Evaluation likely rewards clear demo, product thinking, and technical defensibility.
- A rigorous analysis of edge cases can be a differentiator, but not all gaps need implementation.

Recommended rule:
- Convert unresolved decisions into a visible “assumptions and next steps” slide rather than silently overbuilding.

## 8. Participant Expectations

Summary of what is specified:
- Participants should communicate, respect deadlines, accept feedback, use AI responsibly, and document work.

Recommended rule:
- Keep docs synchronized with code, especially when changing domain rules.
- Record intentional shortcuts as demo/MVP assumptions.

## Feature-by-Feature Decision Checklist

### Reports

Unresolved decisions:
- Can a report belong to multiple categories?
- Can category/subcategory be changed after submission?
- Can location be changed after submission?
- Is title mandatory, description mandatory, or both?
- Can a report be withdrawn by the citizen?
- Can staff hide a report without changing operational status?
- Are reports inside private property allowed?

Recommended default:
- One primary category, optional subcategory, no citizen edits after submission except adding information via comments/follow-up; staff corrections require audit.

### Assignment

Unresolved decisions:
- Can multiple municipal services be assigned to one report?
- Can reassignment happen after work is in progress?
- Is auto-routing a suggestion or a formal assignment?
- Should assignment change status automatically?

Recommended default:
- For MVP, one active lead assignee plus assignment history. For real use, model multiple work orders separately.

### Work Orders

Unresolved decisions:
- Can one issue generate multiple work orders?
- Can work orders be canceled/reissued?
- Are PDFs immutable snapshots?
- Who receives emails and how are failures handled?

Recommended default:
- Separate `work_orders` from `reports`; one report can have many work orders; each work order has its own lifecycle and audit trail.

### Duplicates

Unresolved decisions:
- Can duplicate reports later become independent again?
- Are duplicate reporters subscribed to canonical updates?
- Do duplicate upvotes/comments/photos transfer to canonical report?
- Can staff merge reports from different categories or distant locations?

Recommended default:
- Allow unmerge with audit. Keep duplicate report as a linked record. Do not physically delete or silently transfer data without explicit rules.

### Status and Closure

Unresolved decisions:
- Is `closed` final?
- Who can close reports?
- Does unsatisfied rating reopen a report?
- Is rejected/out-of-scope needed?

Recommended default:
- Keep `closed` final for MVP, add explicit `rejected/out_of_scope` or moderation outcome if needed, and require notes for closure.

### Notifications

Unresolved decisions:
- Which actions notify citizens?
- Are notifications configurable by tenant/user?
- Is email mandatory and push optional?
- What is notification retry behavior?

Recommended default:
- Notify on status, resolution, closure, duplicate merge, and major reassignment only; audit notification attempts.

### Audit History

Unresolved decisions:
- Which data changes require before/after snapshots?
- Who can view audit history?
- How long are logs retained?

Recommended default:
- Audit all admin writes and all external communications.

## Data Consistency Issues to Address Before Production-Like Use

- Bind JWT tenant to `req.tenant.id` for all non-super-admin routes.
- Add row locks or optimistic versions for assignment, merge, priority, and photo-count mutations.
- Add active checks for subcategories and route entities.
- Decide how to clear or preserve `resolved_at` on reopen.
- Prevent closed/duplicate reports from receiving misleading upvotes/ratings unless intentionally allowed.
- Add audit records for admin writes beyond status.
- Define public visibility and moderation state separate from operational status.
- Reconcile docs that claim offline draft queue with current PWA behavior.

## Suggested Clarification Workshop Agenda

1. Confirm tenant/auth model and super-admin scope.
2. Define report lifecycle and visibility lifecycle separately.
3. Define assignment/work-order model: single assignee vs multiple work orders.
4. Define duplicate merge/unmerge behavior and citizen notification policy.
5. Define audit log requirements.
6. Define privacy/public visibility rules for reports and photos.
7. Define MVP/demo scope versus real-pilot scope.

## Conclusion

The project has a strong MVP foundation, but the next important work should be domain hardening, not
feature expansion. Before implementing work orders, configuration UI, exports, push delivery, or more
admin screens, the team should clarify tenant authorization, audit requirements, duplicate semantics,
assignment/work-order rules, public visibility, and concurrency behavior. These decisions shape the
database and API; postponing them will make later features harder to correct.
