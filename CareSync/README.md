# CareSync

CareSync is a healthcare coordination application built around an existing Express/MongoDB API and a React frontend. It provides patient, doctor, lab, pharmacy, and administrator workflows. It is a project prototype, not a medical device or production-certified healthcare system.

## Feature status

| Area | Current status | Evidence / limitation |
|---|---|---|
| Authentication and role authorization | Implemented and tested | Automated auth service and route authorization tests pass. Browser-backed session and database verification remain untested. |
| Doctor directory and appointments | Implemented and tested | Directory/profile/booking API/UI exist; slot booking, cancellation, and rescheduling safeguards have automated tests. No live MongoDB workflow verification. |
| Lab catalog and bookings | Incomplete | Lab/test search and patient booking are implemented and tested; lab test catalog create/update endpoints return 501. No live MongoDB verification. |
| Medicine search, inventory, and reservations | Incomplete | Search, inventory ownership, atomic stock reservation, pharmacy response, cancellation, and expiry workflows are implemented and tested; medicine catalog create/update endpoints return 501. No live MongoDB concurrency verification. |
| Smart Care Journey and notifications | Implemented and tested | Patient-owned timeline and in-app notifications/read-state have automated tests. Email/SMS delivery and scheduled reminders are not implemented. |
| Admin dashboard and provider verification | Implemented and tested | Admin-only access, metrics/status operations, and provider verification/audit logic have automated tests. Browser dashboard verification is untested; bulk import returns 501. |
| Health-record consent and reports | Incomplete | Record-specific consent grant/list/revoke, metadata access, and consent checks are implemented and tested. File upload/download return 501 because secure private storage is not configured. |
| Appointment waitlist | Implemented and tested | Ownership, held offers, expiry and explicit acceptance logic have automated tests. The in-process scheduler, multi-instance behavior, and live MongoDB races are not verified. |

Automated tests are not a substitute for live MongoDB, browser end-to-end, privacy, or deployment validation.

## Architecture

```text
client/                 React 19 + Vite frontend
  src/pages/            Directory, booking, patient, pharmacy, and admin pages
  src/components/       Shared layout, route guards, loading/error states
  src/context/          Authentication/session context
  src/services/api.js   Centralized Axios API client
server/
  src/app.js             Express app, middleware, and /api/v1 route mounts
  src/server.js          MongoDB connection and HTTP/job startup
  src/routes/            API route definitions and authorization
  src/controllers/       HTTP request/response handlers
  src/services/          Business logic and background expiry jobs
  src/models/             Mongoose schemas and indexes
  src/validators/        Zod request validation
```

### Technology

- Backend: Node.js ES modules, Express 4, Mongoose 8, MongoDB, Zod
- Frontend: React 19, React Router, Axios, Vite, Tailwind CSS, Oxlint
- Backend checks: Vitest, Supertest, ESLint

Use a Node.js release supported by the installed Vite 8 toolchain (Node 20.19+ or 22.12+ recommended) and npm.

## Local setup

Install dependencies from the project root:

```powershell
npm run install:all
```

Configure a **local development/test MongoDB** and create `server/.env` yourself using [`server/.env.example`](./server/.env.example). Do not use production patient data for development or tests. The server requires:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET` (at least 32 characters)
- `JWT_REFRESH_SECRET` (at least 32 characters and different from the access secret)

The server provides defaults for `PORT`, `NODE_ENV`, `CLIENT_ORIGIN`, rate-limit values, token expiry, and upload-size limit. For a local Vite development server, set `CLIENT_ORIGIN=http://localhost:5173`. Optional SMTP variables are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`; email delivery is not required for the in-app notification workflows. Do not copy example placeholder secrets into production.

The frontend optionally reads `VITE_API_BASE_URL`; it defaults to `http://localhost:5000/api/v1`. This value is public configuration, not a secret.

Run backend and frontend in separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Vite's development server defaults to port 5173. To preview a production build, use:

```powershell
npm run build:client
npm run preview --prefix client
```

The Vite preview server defaults to port 4173. The backend must be configured with the exact browser origin in `CLIENT_ORIGIN`; cookie-authenticated state-changing requests reject missing or untrusted `Origin`/`Referer` values.
For example, set `CLIENT_ORIGIN=http://127.0.0.1:4173` when testing from that preview origin; `http://localhost:5173` is not interchangeable with another hostname or port.

## API summary

API routes are mounted under `/api/v1`; responses use JSON with a `success` field.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`; `GET /auth/me` |
| Doctors | `GET /doctors`, `GET /doctors/:id`, `GET /doctors/:id/slots`; `POST /doctors/:id/slots`; `PUT /doctors/profile` |
| Appointments | `POST /appointments`, `GET /appointments/my`, `GET /appointments/doctor-schedule`, `GET /appointments/:id`; `PATCH /appointments/:id/cancel`, `/reschedule`, `/status` |
| Labs | `GET /labs`, `/labs/:id`, `/labs/tests`, `/labs/tests/:id`; `POST /labs/tests`, `PUT /labs/tests/:id` (catalog writes unimplemented) |
| Lab bookings | `POST /lab-bookings`, `GET /lab-bookings/my`, `/lab-queue`, `/lab-bookings/:id`; `PATCH /lab-bookings/:id/cancel`, `/status` |
| Medicines | `GET /medicines/search`, `/medicines/:id`; `POST /medicines`, `PUT /medicines/:id` (catalog writes unimplemented) |
| Inventory | `GET /inventory/search`, `/inventory/pharmacy`, `/inventory/:id/history`; `POST /inventory`, `PUT /inventory/:id`, `POST /inventory/:id/confirm` |
| Reservations | `POST /reservations`, `GET /reservations/my`, `/reservations/pharmacy`, `/reservations/:id`; `PATCH /reservations/:id/cancel`, `/respond` |
| Journey/notifications | `GET /care-journey/my`, `/care-journey/:id`; `GET /notifications`, `PATCH /notifications/:id/read`, `/notifications/read-all` |
| Admin | `GET /admin/analytics`, `/admin/users`, `/admin/providers`, `/admin/imports`, `/admin/audit-logs`; `PATCH /admin/users/:id/status`, `/admin/providers/:id/verification`; `POST /admin/imports` (import unimplemented) |
| Consent/reports | `POST /consents`, `GET /consents/my`, `PATCH /consents/:id/revoke`; `GET /reports/my`; `POST /reports/upload/:bookingId` and `GET /reports/:id/download` (file transfer unavailable without private storage) |
| Waitlist | `POST /waitlists`, `GET /waitlists/my`, `PATCH /waitlists/:id/cancel`, `/waitlists/:id/accept` |

For exact request schemas and role requirements, see `server/src/routes/` and `server/src/validators/`.

## Quality checks

From the project root:

```powershell
npm run test:server
npm run lint:server
npm run lint:client
npm run build:client
```

The client has lint/build checks but no separate automated test script. Tests use Vitest mocks and the test environment; they do not require or verify a live MongoDB server.
In the final QA run, the backend suite passed **85 tests across 18 files**; both linters and the frontend production build passed.

## Manual verification checklist

Use a local development database and dedicated test accounts only. Avoid real patient data.

- [ ] Register a patient and a provider-role account; verify the server rejects role escalation and displays provider verification status.
- [ ] Log in, reload to restore the session, visit a protected route, log out, and verify protected API access is denied.
- [ ] Confirm an untrusted/missing request origin is rejected for cookie-authenticated state changes; confirm the configured frontend origin is accepted.
- [ ] Search doctors; open a real profile; verify the displayed slots come from the API.
- [ ] Book a future slot, confirm the appointment appears under My Appointments, then cancel it and confirm the server status and slot availability update.
- [ ] Search labs and tests; inspect real lab/test details; book a test and verify it appears in My Lab Bookings. Exercise cancellation only on a test booking eligible for cancellation.
- [ ] Search medicines and pharmacy inventory; inspect last-confirmed/stock details; create a test reservation, verify pharmacist response/ownership, and cancel/expire only test data as allowed.
- [ ] Inspect the patient care timeline and notification list; mark one notification read and verify unread count changes.
- [ ] Sign in as an admin; verify analytics and audit events, review a test provider, and change a test account's active status. Confirm non-admin accounts receive 403 on admin routes.
- [ ] Grant consent to a verified test doctor for one owned appointment or report record; confirm expiry and revocation block recipient access.
- [ ] Confirm report metadata is patient-owned and report file upload/download remains unavailable until private storage is configured.
- [ ] Join a doctor waitlist using a future range, verify ownership and duplicate prevention, then accept/cancel only a test offer. Confirm offer acceptance—not offer creation—creates an appointment.
- [ ] Repeat key flows at mobile and desktop widths; check keyboard labels, loading/error/retry states, and browser network/console errors.

Live booking/reservation, cross-user access, and slot-contention checks require a connected **development** database and disposable test accounts. Do not test these against production.

## College project report outline

1. Abstract and problem statement
2. Objectives, scope, and user roles
3. Requirements and use cases
4. System architecture and technology choices
5. Database entities and relationships
6. API design, authentication, authorization, and validation
7. Implemented workflows and UI screenshots
8. Testing approach, actual results, and manual verification evidence
9. Security/privacy safeguards and known limitations
10. Deployment design, conclusion, and future work

## Demo walkthrough

1. Introduce CareSync and its patient, provider, and administrator roles.
2. Register/sign in with a prepared local patient account.
3. Search the real doctor directory, inspect a profile, and demonstrate slot availability.
4. Demonstrate booking only if a disposable development slot exists; show the resulting appointment and timeline/notification.
5. Show lab discovery and medicine/inventory/reservation screens only when backed by prepared local records.
6. Demonstrate consent grant/revoke on a test record and explain that secure file transfer is not enabled.
7. Sign in with a separate prepared admin account to show real metrics/provider management/audit history.
8. Show the waitlist offer UI and emphasize that users must explicitly accept before an appointment is created.
9. Finish with automated checks, limitations, and deployment architecture.

Do not present empty datasets as populated, invent transactions, or demonstrate with real health information.

## Deployment preparation

Suggested architecture: host the static `client/dist` build on Vercel or Cloudflare Pages, the Express `server/` service on Render, and MongoDB on a properly access-restricted MongoDB Atlas cluster. These are recommendations only; nothing is deployed or provisioned by this project.

1. Provision a production MongoDB database with network access limited to the backend host and a least-privilege database user.
2. Configure backend environment variables through the host's secret manager: `NODE_ENV=production`, `PORT` as supplied by the host, `MONGODB_URI`, independently generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, and `CLIENT_ORIGIN` set to the exact HTTPS frontend origin. Never commit `.env` or paste secrets into build-time frontend variables.
3. Build the client with `VITE_API_BASE_URL` set to the backend HTTPS API origin plus `/api/v1`. Vite-prefixed variables are embedded in public client assets; only use them for non-secret public values.
4. Verify HTTPS termination, secure HTTP-only cookies, credentials-enabled CORS, and the CSRF Origin/Referer check together. Keep `CLIENT_ORIGIN` exact; do not use wildcard origins with credentialed cookies. The production cookies require HTTPS. If a hosting proxy is involved, configure Express trusted-proxy settings to match that host before relying on IP-based rate limiting.
5. Configure MongoDB backups, monitoring, log retention/access, and a private report storage service with authorization, malware/type/size controls before enabling report file transfer.
6. Use a single backend instance or replace the in-process reservation/waitlist expiry timers with a durable distributed scheduler before scaling to multiple instances. Review migrations/index creation and operational rollback plans before production use.
7. Run the quality checks above and then manually verify deployed health, CORS, authentication, and workflows with dedicated non-production accounts.

## Known limitations

- Report file upload and download return 501 until private storage and secure file handling are configured. Metadata listing and consent checks do not constitute secure file transfer.
- Lab test catalog create/update, medicine catalog create/update, and admin bulk import return 501.
- Email/SMS delivery and scheduled patient reminders are not implemented; notifications are in-app only.
- Local `.env` is not present by default. Live MongoDB, browser end-to-end workflows, and production deployment have not been verified by the automated test suite.
- Waitlist and reservation expiry jobs run in-process and are not distributed across multiple service replicas.
- This project has not undergone a formal compliance, penetration, or privacy certification assessment.
