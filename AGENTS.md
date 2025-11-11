# Repository Guidelines

## Project Structure & Module Organization
Next.js 15 routes live in `src/app`; mirrored admin pages stay in `src/app/admin` so shared middleware stays aligned. Shared UI primitives belong in `src/components` (example: `src/components/NewsTable`), reusable hooks in `src/hooks`, utilities in `src/lib`, and API/service helpers in `src/services`. Persisted Typescript interfaces live in `src/types`. Prisma schema, migrations, and seeds stay under `prisma/`. Static assets live in `public/`, reference docs in `docs/`, and tests sit beside implementations as `Component.test.tsx` or `hook.test.ts` files for fast discovery.

## Build, Test, and Development Commands
Use `npm run dev` for the Turbopack dev server with streaming route/API logs. Ship builds run `npm run build` then `npm run start`. Run `npm run lint` (or `npm run lint -- --fix`) before every commit to enforce Prettier + `next/core-web-vitals`. Always finish feature branches with `npm run test`. Database edits require `npx prisma generate` followed by `npx prisma migrate dev --name <migration>` so schema drift never hits CI.

## Coding Style & Naming Conventions
Codebase is TypeScript/React with 2-space indentation. Components, hooks, and providers use PascalCase (`NewsTable`, `useNewsList`); helper functions use camelCase; route folders remain kebab-case to mirror URLs. Tailwind classes list layout/spacing utilities first, then color/typography tokens (`"flex gap-4 bg-white text-sm"`). Favor explicit imports over `*` and let the lint script handle formatting.

## Testing Guidelines
UI suites rely on React Testing Library—prefer full flows that click buttons and submit forms over shallow rendering. Service helpers deserve focused unit tests whenever data is transformed or cached. Keep specs beside the subject file, named `Component.test.tsx`, and do not skip tests; document manual QA steps in the PR if automation is missing.

## Commit & Pull Request Guidelines
Commits follow conventional present-tense prefixes such as `feat(admin): add AI status filter` or `fix(api): clamp page size`. Squash fixups locally. PRs must link their tracking issue, summarize schema/data-model changes, list new env vars, attach screenshots or screencasts for UI shifts, and note manual verification. Confirm `npm run lint`, `npm run test`, and any necessary Prisma migrations before requesting review.

## Security & Configuration Tips
Secrets stay in `.env` only. Required keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, `CORS_ALLOWED_ORIGINS`, plus `SITE_NEWS_BASE_URL` for public/admin alignment. Avoid logging sensitive payloads, rotate credentials through the team before deploys, and never commit example secrets.
