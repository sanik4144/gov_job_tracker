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

## Rules For Future Changes

- Add new backend endpoints as `route -> controller -> service/model`.
- Add new frontend sidebar screens as a new route in `App.jsx` and a page under `src/pages/`.
- Keep route paths real and shareable, for example `/jobs`, `/applied`, `/profile`.
- Keep user-private data enforced on the backend, even if the frontend already filters it.
- Do not place new API calls directly inside presentational components.
- Do not make broad UI redesigns during structural refactors.
- Prefer small files with clear ownership over large files with mixed concerns.
