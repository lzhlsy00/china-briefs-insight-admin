# Repository Guidelines

## Project Structure & Module Organization
- FortuneNews Admin runs on Next.js 15 with TypeScript. Route handlers live in `src/app`, with admin dashboards under `src/app/admin` to mirror URL segments.
- Shared UI pieces are in `src/components`; reusable hooks live in `src/hooks`; client utilities (Prisma, Supabase, API wrappers) sit in `src/lib` and `src/services`.
- Domain types stay in `src/types`. Database schema and migrations belong to `prisma/`, while public assets reside in `public/` and reference docs in `docs/`.

## Build, Test, and Development Commands
- `npm run dev` launches the dashboard with Turbopack; watch the terminal for API and server logs.
- `npm run build` produces a production bundle; follow with `npm run start` to serve the last successful build.
- `npm run lint` enforces `next/core-web-vitals`; append `-- --fix` to auto-format staged files.
- `npx prisma generate` syncs the Prisma client after schema edits. Use `npx prisma migrate dev --name <migration>` to create and apply local migrations.

## Coding Style & Naming Conventions
- Use 2-space indentation and TypeScript everywhere; rely on ESLint and Prettier via lint scripts.
- React components and hooks use PascalCase (`NewsTable`) and `use` prefixes (`useNewsList`). Helpers in `src/lib` and `src/services` export camelCase functions.
- Keep route folders kebab-case. In Tailwind strings, group layout classes before color or typography utilities.

## Testing Guidelines
- Co-locate tests as `Component.test.tsx` beside the component. Prefer React Testing Library for UI and cover service-level mutations (Prisma interactions) when relevant.
- Run `npm run test` (or the project-specific script) before requesting review; document any manual verification if automated coverage is missing.

## Commit & Pull Request Guidelines
- Write present-tense commits such as `feat(admin): add AI status filter`; squash incidental work into the primary change.
- PRs should link tracking issues, summarize data/model impacts, list new env vars, and attach UI screenshots or screencasts. Confirm `npm run lint` and pending migrations before assigning reviewers.

## Security & Configuration Tips
- Store secrets in `.env` files and never commit them. Required keys: `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, `CORS_ALLOWED_ORIGINS`.
- Coordinate credential rotations with the team and document default values when practical.
