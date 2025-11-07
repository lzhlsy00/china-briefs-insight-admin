# Repository Guidelines

## Project Structure & Module Organization
The Next.js 15 app lives in `src/app`, and every admin route mirrors its public counterpart under `src/app/admin` for consistent layouts. Reusable UI sits in `src/components`, hooks in `src/hooks`, and client-side helpers split between `src/lib` (utilities) and `src/services` (API wrappers). Keep domain types in `src/types`, Prisma assets in `prisma/`, static files in `public/`, and reference material in `docs/`. Tests stay co-located with their subjects using the `Component.test.tsx` naming pattern.

## Build, Test, and Development Commands
Use `npm run dev` for a Turbopack-powered dev server with streaming route/API logs. Validate production bundles with `npm run build` followed by `npm run start`. Run `npm run lint` (append `-- --fix` for autofixes) to enforce `next/core-web-vitals`. After editing the Prisma schema, run `npx prisma generate`, then `npx prisma migrate dev --name <migration>` to capture DB changes. Execute `npm run test` before opening a PR and call out any manual verification.

## Coding Style & Naming Conventions
All code is TypeScript with 2-space indentation. React components, hooks, and providers use PascalCase (`NewsTable`, `useNewsList`), while helper functions export camelCase. Route folders stay kebab-case to match URL segments, and Tailwind strings should list layout or spacing utilities before color and typography tweaks. ESLint plus Prettier (via the lint script) own formatting—avoid ad hoc styling changes.

## Testing Guidelines
Rely on React Testing Library for UI coverage and add targeted service tests when logic manipulates data or caching. Name files `Component.test.tsx`, keep tests near implementations, and favor realistic user flows over deep mocking. Treat failing tests as blockers; document skipped cases and manual QA steps in the PR description.

## Commit & Pull Request Guidelines
Write present-tense, conventional commits such as `feat(admin): add AI status filter`, and squash incidental fixups before submitting. Each PR should link the tracking issue, summarize schema or data-model impacts, list new environment variables, and attach screenshots or screencasts for UI changes. Confirm `npm run lint`, migrations, and relevant tests before assigning reviewers.

## Security & Configuration Tips
Secrets stay in `.env` and must never be checked in. Expected keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, and `CORS_ALLOWED_ORIGINS`. Set `SITE_NEWS_BASE_URL`/`NEXT_PUBLIC_SITE_NEWS_BASE_URL` whenever the public BiteChina domain changes so admin-generated content and cron jobs share the same news permalinks. Coordinate credential rotations with the team, document safe defaults, and avoid logging sensitive payloads in dev tools or server responses.
