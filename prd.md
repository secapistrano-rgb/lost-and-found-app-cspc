# CSPC Lost & Found — Product Requirements Document (PRD)

Version: 1.0
Status: Draft
Owner: Product + Engineering

1. Overview
- Purpose: Enable the CSPC community to quickly report, discover, and reclaim lost items through a mobile experience that uses AI-assisted classification, structured matching, and a guided claim process.
- Platforms: iOS and Android (React Native with Expo).
- Architecture at a glance:
  - Mobile app (React Native/Expo) with Firebase Auth + Email-based 2FA.
  - Node/Express REST API with MySQL database for items, users, matches, claims, feedback, and support tickets.
  - Image uploads stored on server with static serving; AI-assisted image analysis via Gemini.
  - Push notifications via Expo notifications service.

2. Objectives and Success Metrics
- Primary Objectives:
  - Reduce time-to-recovery (TTR) of lost items by enabling structured reporting and automated matching.
  - Improve user confidence via clear claim workflows and notifications.
- Success Metrics (quarterly targets):
  - ≥60% of reported items receive at least one potential match within 24 hours.
  - ≥30% of matched items transition to a claim and ≥15% get resolved (returned/claimed).
  - Avg time from report to first match ≤ 1 hour for active users.
  - Push notification open rate ≥ 20%.

3. Personas
- Student (Seeker): Lost an item, wants quick discovery and reclaim.
- Finder (Reporter): Found an item and wants to report it with minimal effort.
- Admin/Moderator: Oversees disputes, handles abuse and suspensions.
- Campus Security/Staff: May verify claims on-premise when needed.

4. Scope (In-Scope)
- Authentication and Session
  - Firebase Auth sign-in; optional Google Sign-In.
  - Email code verification (2FA) during sensitive actions/sign-in.
  - Session persistence with secure local storage.
- Item Lifecycle
  - Report Lost/Found items with title, description, category, location, time/date, optional attributes (brand/color/etc.), and photos.
  - Server-side image upload; AI-assisted description/category suggestions.
  - Browse/Filter items and view details.
- Matching and Claims
  - Automated matching (title/description/category/date proximity) and manual discovery.
  - View match details and initiate claim requests.
  - Claim request workflow: create, accept/reject, status transitions.
- Notifications
  - In-app count, push delivery (received, tap handling), mark-as-read, clear all.
- Profile, Settings, and History
  - View profile, item history, achievements, and personal stats.
  - Settings for notifications and privacy; clear local storage (debug/utility).
- Feedback and Support
  - Submit app feedback; receive responses.
  - Submit support tickets and view responses.
- Suspension Handling
  - Background suspension checks; forced logout and redirect when suspended.

Out-of-Scope (v1)
- Real-time chat between claimant and reporter.
- Escrow/identity verification and campus ID integration.
- Web portal.

5. User Journeys
- Sign-in with Firebase (and optional Google), verify via email code when prompted, enter home.
- Report Lost/Found Item: pick type, add details, upload photos; AI suggests categories/objects; submit.
- Discover & Match: browse Home, or Matches tab shows auto-matches; open Match Details.
- Claim: submit claim request; owner/reporter reviews and accepts/rejects; item status updates.
- Notifications: receive push for matches, claim updates, feedback/support responses.
- Profile & History: view items reported/claimed; see achievements and stats; adjust settings.
- Support & Feedback: file support ticket or send feedback; review responses.

6. Detailed Feature Requirements
6.1 Authentication and Security
- Firebase Auth sign-in; support Google sign-in where available.
- 2FA via email code; rate-limited attempts and short-lived codes.
- Persist sessions securely; sign-out clears tokens and local data.
- Handle account suspensions: periodic check; if suspended, auto-logout and redirect to Login with message.

6.2 Item Reporting
- Fields: type (lost/found), title, description, categories, location (free text or coordinates), date/time, optional attributes (brand/color/size/material), images (1–10).
- Image upload to server; return public URLs; show upload progress and errors.
- AI Assist (Gemini): analyze first image to suggest description, objects, and categories; user can accept/edit.
- Validation: required fields (type, title, description, at least one of category/image), reasonable limits.

6.3 Items Discovery and Details
- Home feed: list with segmentation (lost/found/recent), filters (category, date, location), and search.
- Item Details: gallery viewer, metadata, reporter info mask, and actions (claim/report issue).

6.4 Matching
- Auto-matching combines: text similarity (title/description), category overlap, date proximity; weighted scoring.
- Matches screen: list of candidate pairs with score; open Match Details to compare fields and photos.
- Thresholds: only show matches with score > 0.4 (configurable).

6.5 Claims
- Create claim requests from a match or item details.
- Claim status: pending, accepted, rejected, resolved.
- Claim details: show claimant and owner information (anonymized when needed), item references, and action buttons.

6.6 Notifications
- Push notifications for: new match, claim status changes, feedback/support responses.
- In-app counter; mark-as-read and clear-all; background refresh every 30s while active.
- Tapping a notification routes to the relevant screen (match, claim, feedback, or support details).

6.7 Profile, Settings, Achievements, and Stats
- Profile: user info summary, quick links to history and settings.
- History: list of items reported and claims made.
- Achievements: basic gamification (e.g., first item found, 5 helpful reports).
- Stats: personal stats (items reported, matches found, claims outcome).
- Settings: notification preferences, privacy options, and data controls.

6.8 Feedback and Support
- Feedback: submit category + message; track status; view responses thread.
- Support Tickets: submit with category, priority, message, attachments (optional); view responses and status.

6.9 Suspension Handling
- Background job checks user status; on suspension, show modal and force logout; navigation reset to Login.

7. Non-Functional Requirements
- Performance: list screens should render < 1s for cached data, < 2.5s for fresh network data on average devices.
- Reliability: API requests have retries and timeouts; image uploads capped at 10MB per file.
- Security & Privacy:
  - Use Firebase Auth securely; never log tokens or secrets.
  - Store API keys in secure env/config (do not commit secrets); rotate if exposure is detected.
  - Limit PII exposure in notifications and item listings.
- Accessibility: support larger fonts, color contrast, and touch targets ≥ 44px.
- Observability: console logging gated by environment; add hooks for error reporting.

8. Data Model (High-Level)
- Users: id, email, name, status, suspension fields, created_at, updated_at, settings.
- Items: id, type (lost/found), title, description, categories (array/string), reporter_email, location, brand, color, size, material, images (urls), status, created_at.
- Matches: id, lost_item_id, found_item_id, score, status, created_at.
- Claims: id, match_id or item_id, claimant_id/email, status, messages (optional), created_at.
- Feedback: id, user_email, category, message, status; FeedbackResponses: id, feedback_id, responder, message, created_at.
- SupportTickets: id, user_email, category, priority, message, status; SupportTicketResponses: id, ticket_id, responder, message, created_at.

9. API Summary (Representative)
- Items: GET /api/items, POST /api/items, GET /api/items/:id, PUT/PATCH status, search, nearby, categories, stats.
- Matches: GET /api/matches, GET /api/matches/:id, POST/PUT/PATCH/DELETE, stats.
- Claims: GET/POST/PUT/PATCH/DELETE and scoped queries (by claimant/item/match), stats.
- Users: GET/POST/PUT/PATCH (login/status), settings endpoints.
- Feedback: GET/POST/PUT/PATCH/DELETE, stats, responses sub-resources.
- Support Tickets: GET/POST/PUT/DELETE, responses sub-resources.
- Uploads: POST /api/upload/image and /api/upload/images returning public URLs.

10. Navigation (High-Level)
- Tabs: Home, Report Item, Matches, Claims.
- Stack Screens: Login, Two-Factor Verification, Help Sign-In, Item Details, Edit Item, Match Details, Claim Item, Claim Details, User Profile, User Item History, Settings, Help & Support, User Stats, User Feedback, User Achievements, Clear Storage.

11. Risks and Mitigations
- Secret leakage in client code: move keys to secure storage/environment; rotate existing keys immediately.
- False-positive matches: expose score and rationale; enable user feedback to tune weights.
- Abuse/Spam: rate limit submissions; leverage suspension workflow.
- Image privacy: blur faces/PII where possible (future); user guidance in UI copy today.

12. Rollout Plan (Milestones)
- M1: Core flows (Auth, Report, Home list, Details, Uploads) + local testing.
- M2: Matching + Claims + Notifications.
- M3: Feedback/Support + Achievements/Stats.
- M4: Hardening (suspension, settings), perf and accessibility, telemetry.

13. Open Questions
- Do we require Google-only sign-in or also email/password? 2FA coverage scope?
- Should claims require in-person verification by security staff for certain categories?
- Data retention and deletion policy for images and records?
- Admin tooling scope for moderation and analytics?