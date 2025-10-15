# Repository Guidelines

## Project Structure & Module Organization
FortuneNews Admin is a Next.js 15 + TypeScript dashboard. Application routes live in `src/app`, with admin pages under `src/app/admin`. Shared React components sit in `src/components`, domain hooks in `src/hooks`, client libraries (Prisma, Supabase, API helpers) under `src/lib`, and HTTP wrappers in `src/services`. Types reside in `src/types`, the Prisma schema in `prisma/schema.prisma`, static assets in `public`, and supplemental references in `docs/`.

## Build, Test, and Development Commands
- `npm run dev` — launch the dashboard with Turbopack; watch for server/API errors in the terminal.
- `npm run build` — create an optimized production bundle.
- `npm run start` — serve the optimized build (requires a prior build).
- `npm run lint` — run ESLint using `next/core-web-vitals` rules; append `-- --fix` to auto-fix.
- `npx prisma generate` — regenerate the Prisma client (also runs automatically after install).
- `npx prisma migrate dev --name <migration>` — create and apply local schema changes.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and rely on ESLint for formatting enforcement; resolve warnings before opening a PR. Components and hooks follow PascalCase (`NewsTable`) and `use`-prefixed names (`useNewsList`). Modules inside `src/lib` and `src/services` export camelCase helpers; Next.js route folders stay kebab-case to match URL segments. Keep Tailwind utility strings grouped by layout → color for readability.

## Testing Guidelines
No automated suite ships yet. When adding features, include targeted tests (prefer React Testing Library or integration checks collocated as `Component.test.tsx`) and document any manual verification performed in the PR. For data mutations, cover both Prisma service logic and UI state updates. Aim for meaningful assertions instead of snapshot-only tests.

## Commit & Pull Request Guidelines
Write present-tense commit subjects that capture the change scope, e.g. `feat(admin): add AI status filter`. Squash incidental work into the relevant commit. Pull requests should link tracking issues, describe data/model impacts, note required env vars, and attach UI screenshots or screencasts when visuals change. Confirm `npm run lint` and required migrations have been run.

## Configuration & Security Tips
Maintain secrets in `.env` files (never commit). Required keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, and `CORS_ALLOWED_ORIGINS`. Prisma migrations and Supabase access both depend on accurate values, so document defaults in PRs and coordinate rotations with the team.
