# Project Structure Guide

Use this structure for future work. Keep UI behavior and business rules in small, named modules instead of growing entry files.

## Backend

- `src/index.js`
  - App bootstrap only: env, database init, middleware, route mounting, server start.
  - Do not add route business logic here.
- `src/routes/`
  - Express router files grouped by resource.
  - Routes should only compose middleware and controller handlers.
- `src/controllers/`
  - HTTP handlers.
  - Validate request input, call services/models, and shape responses.
- `src/services/`
  - Business logic and external integrations.
  - Scraping, notification scheduling, Telegram delivery, and reusable workflows belong here.
- `src/models/`
  - Mongoose schemas and schema methods only.
- `src/middleware/`
  - Express middleware such as auth and route authorization.
- `src/scripts/`
  - One-off and repeatable maintenance scripts, such as seeders.
  - Scripts must be idempotent where possible.
- `src/utils/`
  - Pure helpers for formatting, parsing, and response view models.
- `src/config/`
  - Environment parsing and app configuration.

## Frontend

- `src/main.jsx`
  - React root setup and top-level providers only.
- `src/App.jsx`
  - Route composition only.
  - Do not put page markup, API calls, or business workflows here.
- `src/pages/`
  - Route-level screens such as `JobsPage`, `AppliedJobsPage`, `ProfilePage`, and `AuthPage`.
- `src/components/`
  - Reusable UI pieces that receive data and callbacks via props.
  - Avoid API calls in presentational components.
- `src/context/`
  - Shared app state and workflows, such as auth and dashboard data.
- `src/api/`
  - Fetch client and endpoint wrappers.
- `src/utils/`
  - Pure frontend helpers and constants.
- `src/styles.css`
  - Shared styling. Preserve existing class names when refactoring UI structure.

## Plans And Entitlements

- `src/config/plans.js` is the only place plan limits and features are written.
  It is data: no conditionals, no user lookups.
- `src/services/entitlements.js` is the only module that reads `user.plan`.
  Everything else asks it for limits (`getLimits`, `getLimit`, `isWithinLimit`) or
  features (`can`). Keeping that single reader is what stops plan checks from
  scattering across controllers and drifting apart.
- Entitlements are derived on every read, never stored. A lapsed subscription
  downgrades itself even if no expiry job has run.
- `null` means unlimited. Not `Infinity`, which JSON serializes to `null` anyway.

## Rules For Future Changes

- Add new backend endpoints as `route -> controller -> service/model`.
- Add new frontend sidebar screens as a new route in `App.jsx` and a page under `src/pages/`.
- Add admin backend endpoints under `src/routes/adminRouter.js` or a dedicated admin router, protected by `authenticate` and `requireAdmin`.
- Add admin frontend pages under `src/pages/` and expose them in the sidebar only when `user.role === "admin"`.
- Keep route paths real and shareable, for example `/jobs`, `/applied`, `/profile`.
- Keep user-private data enforced on the backend, even if the frontend already filters it.
- Enforce plan limits on the backend. Frontend entitlements decide what is shown and
  disabled; they are never the enforcement.
- Enforce route-level feature gates with middleware, and count-based quotas in the
  controller that owns the resource.
- Reject an action blocked by a plan limit with HTTP 402 and a body carrying `code`,
  `feature`, `limit` and `upgradeTo`, so the client can offer an upgrade instead of
  showing a generic error.
- Remember that the scheduler and notifier never pass through Express. Entitlements
  affecting notifications must be enforced inside those services, not in middleware.
- Do not place new API calls directly inside presentational components.
- Do not make broad UI redesigns during structural refactors.
- Prefer small files with clear ownership over large files with mixed concerns.
