# GradFix Map Subsystem Review

Date: 2026-06-23

Scope: public map page, marker rendering, report clustering, marker icons/status colors, report detail
navigation, bounding-box loading, filtering, search, mobile usability, performance, GPS handling,
duplicate-report detection on the map, report creation from map interactions, error states, empty states,
and loading states.

Out of scope for this review: work orders, exports, notifications, audit systems, and new admin features.

Sources reviewed:
- Specification public map, reporting flow, PWA, accessibility, performance, and responsive requirements.
- `frontend/src/features/map/MapPage.jsx`
- `frontend/src/features/map/LocationPicker.jsx`
- `frontend/src/features/map/tiles.js`
- `frontend/src/lib/leafletIcon.js`
- `frontend/src/api/map.js`
- `frontend/src/features/reports/NearbyReports.jsx`
- `frontend/src/features/reports/NewReportPage.jsx`
- `frontend/src/features/reports/ReportDetailPage.jsx`
- `frontend/src/styles.css`
- `backend/src/routes/map.routes.js`
- `backend/src/routes/reports.routes.js`
- `backend/src/services/report.service.js`
- `docs/API.md`

## Executive Summary

The map subsystem is currently an MVP-level map, not a finished public map product.

What works:
- Public map renders Leaflet/CARTO tiles.
- Reports load by visible bounding box from `GET /api/v1/map/reports`.
- Markers link to report detail pages.
- The report wizard has GPS/manual pin selection.
- The report wizard has nearby-report duplicate suggestions.

What is broken or weak:
- The public map has no visible loading, error, or empty state.
- Map API errors are silently swallowed, leaving users with stale or blank markers.
- Public map markers are all the same purple icon; status/category/priority are not visually encoded.
- There is no clustering, so dense report areas will become unusable.
- The location picker defaults to Zagreb, while the tenant/demo defaults to Subotica.
- The public map cannot use GPS to center on the user.
- The public map cannot create a report from a clicked map location.
- The public map has no filter/search UI, although the backend supports partial status/category filtering.
- Duplicate detection exists only inside the report wizard, not as a map interaction.
- Backend map API has limited validation and limited payload for richer map UX.

## Current Implementation

### Public Map Page

File: `frontend/src/features/map/MapPage.jsx`

Current behavior:
- Renders a full-height `MapContainer` centered on hardcoded Subotica coordinates.
- Uses CARTO Voyager raster tiles.
- Watches `moveend` events and fetches `/map/reports?bbox=...` after a 300 ms debounce.
- Stores returned GeoJSON features in local state.
- Renders one Leaflet `Marker` per report.
- Each popup shows title, raw status, upvote count, and a link to `/reports/:id`.

Strengths:
- Simple and functional for small demo datasets.
- Bounding-box loading avoids loading every report globally.
- Debounce reduces request count during pan/zoom.
- Detail navigation is clear enough for MVP.

Weaknesses:
- No loading indicator while the first request or subsequent viewport request is active.
- No empty state when there are no reports in the current view.
- No error state if `/map/reports` fails.
- Errors are intentionally ignored; stale data remains without user feedback.
- Older async responses can overwrite newer viewport results because requests are not canceled or sequenced.
- Markers have no status/category/priority colors.
- Marker popup uses raw status (`in_progress`) rather than human label (`In progress`).
- No map controls for filters, search, geolocate, reset to city, or report creation.
- No clustering or marker-density management.

### Backend Map API

File: `backend/src/routes/map.routes.js`

Current behavior:
- Public endpoint: `GET /api/v1/map/reports`.
- Required query param: `bbox=minLng,minLat,maxLng,maxLat`.
- Optional query params: `status`, `categoryId`, `limit`.
- Returns GeoJSON `FeatureCollection` with `id`, `title`, `status`, `categorySlug`, `upvoteCount`, and point coordinates.

Strengths:
- Tenant-scoped query.
- Bbox query is simple and works without PostGIS.
- Response shape is appropriate for Leaflet and duplicate-detection reuse.
- Limit defaults to 500 and maxes at 2000.

Weaknesses:
- `status` is a free string, not validated against known status enum values.
- `bbox` number ranges and min/max ordering are not validated.
- No search query support on the map endpoint.
- No category name, category ID, priority, created date, resolved date, or primary photo in marker payload.
- No `hasMore`/truncated flag when the result limit hides reports.
- No clustering endpoint or aggregation endpoint.
- Sorting is always newest first, which can hide older but still important reports in dense viewports.
- Uses ordinary latitude/longitude indexes rather than spatial indexing; acceptable for MVP, likely insufficient at scale.

### Marker Rendering and Icons

Files:
- `frontend/src/lib/leafletIcon.js`
- `frontend/src/features/map/MapPage.jsx`

Current behavior:
- Leaflet default PNG marker handling was replaced with a self-contained purple SVG marker.
- Every marker uses the same icon.

Strengths:
- Fixes Vite/Leaflet asset resolution issue.
- Avoids marker 404s.
- Provides consistent brand-colored markers.

Weaknesses:
- No visual difference by status, priority, or category.
- No legend.
- No accessible marker labels beyond popup content.
- No selected/hover state.
- Clusters do not exist.

Real user expectation:
- Users expect to understand the map at a glance: new reports, in-progress work, resolved issues, and closed items should not look identical.

### Report Detail Navigation

Files:
- `frontend/src/features/map/MapPage.jsx`
- `frontend/src/features/reports/ReportDetailPage.jsx`

Current behavior:
- Popup link navigates to `/reports/:id`.
- Detail page has a “Back to map” link to `/`.
- Detail page can open report coordinates in OpenStreetMap.

Strengths:
- Basic map -> detail -> map loop works.
- Detail page shows photos, location, status history, and upvote button.

Weaknesses:
- Returning to `/` loses map viewport, zoom, selected marker, and filters.
- Detail page does not embed a small map preview; users only see coordinates and an external OSM link.
- Popup provides minimal context and no photo/priority/category.

Recommended direction:
- Preserve map state in URL query params or router state.
- Add a compact location map on detail or a “show on map” route that centers the marker.

### Bounding-Box Loading

Files:
- `frontend/src/features/map/MapPage.jsx`
- `backend/src/routes/map.routes.js`

Current behavior:
- Frontend sends bbox from current Leaflet bounds after initial render and every `moveend`.
- Backend returns reports inside bbox, newest first, capped by limit.

Strengths:
- Correct baseline approach for public map.
- Debounced loading prevents excessive requests during pan/zoom.

Weaknesses:
- No abort/cancel of previous request.
- No sequence guard, so stale responses can overwrite current map results.
- No loading state per viewport.
- No indication when results are truncated by limit.
- No caching strategy beyond browser/React state; moving back to a previous viewport refetches.
- No padding/preload around viewport, so markers pop in only after movement settles.

Backend edge cases:
- Invalid bboxes such as `200,95,-200,-95` are accepted as numbers and may just return no results.
- Reversed min/max values are not rejected.
- Very large bboxes can request broad city/region-wide data up to 2000 features.

### Filtering and Search

Current backend support:
- Map endpoint supports `status`, `categoryId`, `limit`.
- Public reports list supports `q`, `status`, `categoryId`, pagination, and sort.

Current frontend support:
- Public map exposes no filters.
- Public map exposes no text search.
- Duplicate-detection panel cannot pass status/category filters to `/map/reports`; it fetches bbox only, then prioritizes category client-side if available.

Specification expectation:
- Public map should display reports.
- Public dashboard should show category/status context.
- Report categories are core to understanding issues.

Real user expectation:
- Filter by category and status.
- Search by address/title/problem type.
- Quickly show “near me”, “unresolved only”, or “same category”.

Gaps:
- No filter UI.
- No search UI.
- No URL state for filters.
- Backend map endpoint does not support `q`, priority, created date, or unresolved-only shortcuts.

### Mobile Usability

Current behavior:
- Map height is `calc(100vh - 49px)`.
- Topbar remains sticky.
- Leaflet default controls and popups are used.

Strengths:
- The map fills the screen and works as a mobile-first landing page.
- The report wizard map uses 42vh, leaving room for controls.

Weaknesses:
- No mobile-specific bottom sheet or marker preview.
- Popups are small and can be awkward to tap.
- No obvious “Report here” action on long press/tap.
- No geolocate button on public map.
- Navigation may crowd the topbar on small screens.
- Marker density will be hard to use on small screens without clustering.
- No explicit offline/tile-loading state inside the map area.

Recommended direction:
- Use a bottom sheet/card for selected report on mobile.
- Add map controls with large touch targets: locate me, filters, reset city, report here.
- Preserve viewport and selected marker in URL for share/back behavior.

### Performance

Current behavior:
- Every visible report is rendered as a Leaflet marker.
- Default limit is 500 features.
- Max API limit is 2000 features.
- No clustering or virtualization.

Risks:
- Hundreds of DOM markers can make mobile devices sluggish.
- Dense city-center views can hide important older reports due to newest-first limit.
- Repeated bbox requests on pan/zoom can cause unnecessary network load.
- No server aggregation means heat map/dashboard future work may duplicate map-query logic.

Recommended direction:
- Add frontend clustering for near-term MVP improvement.
- Add backend aggregation/clustering later for large datasets.
- Add `hasMore` metadata so UI can warn when only a subset is shown.
- Add filters before increasing limits.

### GPS Handling

Files:
- `frontend/src/features/map/LocationPicker.jsx`
- `frontend/src/features/reports/NewReportPage.jsx`

Current behavior:
- Report wizard lets user click map, drag marker, or use browser geolocation.
- If geolocation fails, user sees a fallback message and can tap map manually.
- Public map has no geolocation control.

Strengths:
- Manual fallback exists in report creation.
- Geolocation uses high accuracy and timeout.

Weaknesses:
- Location picker default center is Zagreb (`45.8131, 15.9776`) while tenant/demo is Subotica.
- GPS accuracy is not displayed or stored.
- No city-boundary validation or warning if point is far outside the tenant city.
- No reverse geocoding to fill address/landmark.
- Public map does not support “near me”.

Exact defect:
- `LocationPicker.jsx` line 8 sets `DEFAULT_CENTER` to Zagreb. This conflicts with the current tenant default and user expectation in the Subotica demo.

### Duplicate-Report Detection on the Map

Files:
- `frontend/src/features/reports/NearbyReports.jsx`
- `frontend/src/lib/geo.js`
- `frontend/src/api/map.js`

Current behavior:
- Duplicate detection appears during report creation after a location is selected.
- Fetches a 450 m bbox and filters client-side to 300 m.
- Shows up to five nearby reports.
- Prioritizes same-category reports once a category is selected.
- Lets authenticated user support an existing report.

Strengths:
- Good MVP duplicate-prevention flow.
- Reuses map endpoint instead of creating a special endpoint.
- Does not block filing a new report.

Weaknesses:
- Duplicate detection is not available from the public map itself.
- Category filtering is client-side and only prioritizes matches; it does not exclude unrelated categories.
- No error state if nearby report fetch fails; the panel simply disappears.
- No loading/skeleton state; users may continue before suggestions appear.
- Closed/resolved reports can be suggested unless filtered out by future logic.
- No logic for “same issue but opposite side of street”, “linear issue”, or larger-area issues such as overgrown vegetation.
- Upvote requires login; unauthenticated behavior in the panel is not explicitly handled here and depends on API/client error behavior.

Recommended direction:
- Add loading and error states for duplicate suggestions.
- Exclude closed/old resolved reports by default or label them clearly.
- Add same-category filtering after category is selected.
- Consider duplicate detection from public map click: “Report a problem here” should show nearby reports before starting the wizard.

### Report Creation from Map Interactions

Current behavior:
- Report creation starts from top navigation `/reports/new`.
- Location is selected inside the wizard.
- Public map clicks do not start report creation.
- Public map marker popups do not offer “I have this problem too”; only detail page/wizard nearby panel does.

Real user expectation:
- On a civic-reporting map, users often expect to tap a location and create a report there.
- Users expect “my current location” and “report here” from the map.

Missing behavior:
- Click/long-press map -> start report with prefilled coordinates.
- URL support such as `/reports/new?lat=...&lng=...`.
- “Report near me” or “Report at map center” action.
- Duplicate suggestions before wizard step 1 or integrated with map click.

Recommended direction:
- Add query-param prefill support to `NewReportPage` first.
- Add a public map “Report here” action that navigates to `/reports/new?lat=...&lng=...`.
- If unauthenticated, preserve target location through login/register.

### Error, Empty, and Loading States

Public map:
- Loading state: missing.
- Error state: missing; errors are swallowed.
- Empty state: missing.
- Truncated-results state: missing.

Location picker:
- GPS loading state: present.
- GPS error state: present.
- Tile/API loading state: not present.

Nearby duplicate panel:
- Loading state: hidden because panel returns `null` while loading.
- Error state: missing.
- Empty state: hidden by design, but this can be acceptable if the surrounding wizard explains that no nearby reports were found.

Recommended direction:
- Public map should show a small non-blocking status overlay: loading, failed to refresh, no reports here, showing latest N only.
- Duplicate panel should show “Checking nearby reports...” and a retry/error message when the API fails.

## Comparison Against Specification

Spec requirement: Public map displays other citizens’ reports.
- Current status: Partially met. Reports display as markers, but UX is minimal and no clustering/filtering/search exists.

Spec requirement: Public map has upvote/support system.
- Current status: Partially met outside map. Upvote exists on report detail and duplicate panel, but not directly on map popup.

Spec requirement: Public map allows confirmation that problem is still present or resolved.
- Current status: Missing. No map or detail confirmation UI/API exists.

Spec requirement: Public map available without registration.
- Current status: Met for viewing. Supporting/upvoting requires login.

Spec requirement: Automatic GPS location in reporting flow.
- Current status: Partially met. Wizard supports GPS; public map does not. Accuracy and tenant bounds are not handled.

Spec requirement: Performance and mobile-first UX.
- Current status: Partially met for small data. Missing clustering, loading states, and mobile-specific interaction patterns.

## Comparison Against Real User Expectations

Expected by citizens:
- See reports near me.
- Understand marker colors/status at a glance.
- Filter by category/status.
- Search location or problem text.
- Tap map to report a problem at that location.
- Quickly see if my problem is already reported.
- Know when the map is loading or failed.

Current gaps:
- No “near me”.
- No status colors/legend.
- No filters/search.
- No report-from-map click.
- No map-level duplicate workflow.
- No loading/error/empty states.

Expected by city/public stakeholders:
- Dense problem areas are readable.
- Resolved and open issues are visually distinct.
- Map remains usable as reports grow.
- Public map does not mislead by hiding reports due to limits.

Current gaps:
- No clustering/aggregation.
- No truncation warning.
- All markers look identical.

## Comparison Against Current Backend API

Backend supports:
- Bbox report fetch.
- Status filter.
- Category filter.
- Limit.

Frontend currently uses:
- Bbox only.

Backend does not support for map:
- Text search.
- Priority filter.
- Date/status grouping.
- Clustering/aggregation.
- `hasMore` metadata.
- Location accuracy.
- Primary photo thumbnails.
- Human labels/category names.

Immediate mismatch:
- The backend already supports `status` and `categoryId`, but the public map UI does not expose them.

## What Works

- Tile rendering using CARTO Voyager.
- Public bbox loading from backend.
- Tenant-scoped backend map query.
- Marker-to-detail navigation.
- Inline SVG marker avoids Leaflet/Vite asset issues.
- Report creation location picker supports click, drag, and GPS.
- Duplicate detection in wizard uses nearby map reports and distance filtering.

## What Is Broken

- `LocationPicker` defaults to Zagreb instead of the tenant city/demo city.
- Map API errors are swallowed with no user feedback.
- Public map has no loading state.
- Public map has no empty state.
- Public map can show stale markers after failed refresh.
- Public map has race-condition risk where an older bbox response can overwrite newer map results.
- Marker statuses are shown as raw enum strings in popups.
- All marker icons are identical regardless of status/category.

## What Is Missing

- Report clustering.
- Marker status colors.
- Marker legend.
- Category/status filter UI.
- Text search.
- Public map geolocate button.
- Reset-to-city button.
- Report creation from map click/long-press.
- URL-based viewport/filter state.
- Selected marker state.
- Mobile bottom sheet/card interaction.
- Map-level duplicate/report support action.
- Still-present/resolved confirmation.
- Backend `hasMore`/truncation metadata.
- Backend map search support.
- Backend map clustering/aggregation support for scale.
- Tenant-configured map center in frontend.
- GPS accuracy display/storage.

## Priority Fix Plan

### P0 - Correctness and User Trust

1. Fix `LocationPicker` default center to use the tenant city instead of Zagreb.
   - Current file: `frontend/src/features/map/LocationPicker.jsx`.
   - Minimal fix: use Subotica coordinates consistently with `MapPage` for current tenant/demo.
   - Better fix: expose tenant center from API/config and use it everywhere.

2. Add public map loading, error, and empty states.
   - Current file: `frontend/src/features/map/MapPage.jsx`.
   - Show “Loading reports...”, “Could not refresh reports”, and “No reports in this area”.
   - Do not silently swallow API errors.

3. Guard against stale bbox responses.
   - Current file: `frontend/src/features/map/MapPage.jsx`.
   - Use request sequencing or `AbortController` so older requests cannot overwrite newer viewport data.

4. Validate backend map filters more strictly.
   - Current file: `backend/src/routes/map.routes.js`.
   - Validate `status` enum, coordinate ranges, and min/max ordering.

### P1 - Core Public Map UX

5. Add status-colored marker icons and a legend.
   - Current files: `frontend/src/lib/leafletIcon.js`, `frontend/src/features/map/MapPage.jsx`, `frontend/src/styles.css`.
   - Reuse status palette from `StatusPill`.
   - Use human-readable status labels in popups.

6. Add category and status filters to the public map.
   - Current files: `frontend/src/features/map/MapPage.jsx`, `frontend/src/api/categories.js`.
   - Backend already supports `status` and `categoryId`.
   - Persist filter state in the URL.

7. Add public map geolocation control.
   - Current file: `frontend/src/features/map/MapPage.jsx`.
   - Center map on current location and show fallback error if denied/unavailable.

8. Preserve map viewport when navigating to/from report detail.
   - Current files: `MapPage.jsx`, `ReportDetailPage.jsx`.
   - Store `lat`, `lng`, `zoom`, filters, and selected report in URL or router state.

### P2 - Scale and Dense-Area Usability

9. Add frontend marker clustering.
   - Add a React/Leaflet-compatible clustering solution or custom grouping.
   - Required before using realistic city-scale datasets.

10. Add backend truncation metadata.
   - Current file: `backend/src/routes/map.routes.js`.
   - Return metadata such as `{ limit, count, hasMore }` alongside GeoJSON or in a wrapper format.
   - If keeping pure GeoJSON, put metadata in a top-level foreign member such as `metadata`.

11. Add search support.
   - Backend: support `q` on `/map/reports` or add a geocoding/report search endpoint.
   - Frontend: search by report text first; address/geocoder can be a later enhancement.

### P3 - Report Creation and Duplicate Workflow

12. Add `/reports/new?lat=...&lng=...` prefill support.
   - Current file: `frontend/src/features/reports/NewReportPage.jsx`.
   - Allows map interactions to start report creation at a specific point.

13. Add “Report here” action from public map.
   - Current file: `frontend/src/features/map/MapPage.jsx`.
   - Click/long-press or map-center button should navigate to prefilled report flow.
   - Preserve selected location through login/register if user is not authenticated.

14. Bring duplicate detection closer to map creation.
   - Reuse `NearbyReports` logic after map click/prefill.
   - Show nearby reports before the user invests time in photos/details.

### P4 - Refinement

15. Add marker popup richness.
   - Include category, priority, human status, affected count, and optionally thumbnail.

16. Add detail-page mini-map.
   - Current file: `frontend/src/features/reports/ReportDetailPage.jsx`.
   - Helps users visually confirm the location without opening external OSM.

17. Add map accessibility improvements.
   - Add keyboard-accessible report list synchronized with map results.
   - Improve popup labels and non-map alternatives.

## Recommended Immediate Implementation Slice

Do these before any larger map feature work:

1. Replace hardcoded Zagreb default in `LocationPicker` with Subotica/tenant center.
2. Add loading/error/empty overlay to `MapPage`.
3. Add stale-request protection to `MapPage` bbox loading.
4. Add human status labels in popups.
5. Add status-colored marker icons and simple legend.

Why this slice first:
- It fixes a real correctness defect.
- It improves trust when the map is slow or broken.
- It makes the public map understandable without changing backend schema.
- It keeps scope limited to the map subsystem.

## Acceptance Criteria for the Map Subsystem

Before moving to the next subsystem, the map should meet these minimum criteria:

- Public map loads tenant reports by bbox.
- User sees loading, error, and empty states.
- User can distinguish statuses visually on markers.
- User can filter by category and status.
- User can center map on current GPS location or reset to city center.
- Dense areas remain usable through clustering or equivalent grouping.
- User can navigate to detail and return without losing context.
- Report creation can be started from a map-selected location.
- Duplicate suggestions are shown for map-selected/new-report locations.
- Backend validates map query parameters and does not silently accept malformed bbox/status values.

## Conclusion

The map subsystem currently satisfies only the minimum “show reports on a public map” requirement. It is
good enough for a small seeded demo, but it is not yet aligned with real public-map expectations or the
project’s own performance/mobile requirements. The next map work should focus on correctness, state
feedback, status visualization, filters, and clustering before adding unrelated subsystems.
