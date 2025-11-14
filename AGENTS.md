# Repository Guidelines

## Project Structure & Module Organization
- Next.js 15 routes live in `src/app`; duplicate admin views live in `src/app/admin` to keep middleware parity.
- Shared UI primitives belong in `src/components` (ex: `src/components/NewsTable`), hooks in `src/hooks`, utilities in `src/lib`, and API/service helpers in `src/services`.
- Persisted TypeScript interfaces reside in `src/types`. Prisma schema, migrations, and seeds stay under `prisma/`; run `npx prisma generate` after editing `schema.prisma`.
- Static assets live in `public/`, docs under `docs/`, and tests sit beside their subjects as `Component.test.tsx` or `hook.test.ts`.

## Build, Test, and Development Commands
- `npm run dev`: Turbopack dev server with streaming route/API logs.
- `npm run build` then `npm run start`: production bundle + runtime sanity checks.
- `npm run lint` or `npm run lint -- --fix`: Prettier + `next/core-web-vitals` enforcement before commits.
- `npm run test`: run colocated Jest/RTL specs; required ahead of PRs.
- `npx prisma migrate dev --name <migration>`: capture schema drift immediately after generating.

## Coding Style & Naming Conventions
- TypeScript/React with 2-space indentation; no implicit `any`.
- Components, hooks, and providers use PascalCase (`NewsTable`, `useNewsList`); helper functions use camelCase; route folders remain kebab-case for URL parity.
- Tailwind classes read layout/spacing first, then color/typography (e.g., `"flex gap-4 bg-white text-sm"`). Prefer explicit imports; rely on lint + Prettier for formatting.

## Testing Guidelines
- UI coverage relies on React Testing Library: simulate real flows by clicking buttons, submitting forms, and asserting DOM side effects.
- Service helpers deserve focused unit tests whenever data is transformed or cached.
- Never skip tests; document manual QA steps in PRs if automation is pending.

## Commit & Pull Request Guidelines
- Commit messages follow `feat(scope): summary` / `fix(scope): summary` in present tense (e.g., `feat(admin): add AI status filter`). Squash fixups locally.
- PRs link their tracking issue, summarize schema or data-model changes, list new env vars, attach screenshots or screencasts for UI shifts, and note manual verification.
- Confirm `npm run lint`, `npm run test`, and required Prisma migrations before requesting review.

## Security & Configuration Tips
- Secrets stay in `.env`; required keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, `CORS_ALLOWED_ORIGINS`, and `SITE_NEWS_BASE_URL`.
- Avoid logging sensitive payloads; rotate credentials before deploys; never commit sample secrets.
