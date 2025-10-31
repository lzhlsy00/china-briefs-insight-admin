# Repository Guidelines

## Project Structure & Module Organization
- The Next.js 15 app lives in `src/app`; admin routes mirror URL segments under `src/app/admin`.
- Shared React components are in `src/components`; reusable hooks live in `src/hooks`.
- Client utilities land in `src/lib` and `src/services`; domain types stay in `src/types`.
- Prisma schema and migrations belong in `prisma/`; static assets sit in `public/`; reference docs stay in `docs/`.
- Co-locate tests beside source files using `Component.test.tsx` to keep fixtures close to implementations.

## Build, Test, and Development Commands
- `npm run dev` starts the dashboard with Turbopack and streams route/API logs.
- `npm run build` compiles a production bundle; follow with `npm run start` to serve the last build.
- `npm run lint` applies `next/core-web-vitals`; append `-- --fix` to auto-resolve lintable issues.
- After Prisma schema edits, run `npx prisma generate`; use `npx prisma migrate dev --name <migration>` to create local migrations.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation; rely on ESLint/Prettier from the lint script to format files.
- React components and hooks use PascalCase (`NewsTable`, `useNewsList`); helper functions export camelCase.
- Keep route folders kebab-case. In Tailwind strings, group layout utilities before color/typography classes.

## Testing Guidelines
- Prefer React Testing Library for UI and cover service mutations when logic warrants it.
- Name files `Component.test.tsx`; run `npm run test` and document any manual checks when automated coverage is incomplete.
- Treat failing tests as blockers before opening PRs.

## Commit & Pull Request Guidelines
- Write present-tense commits (`feat(admin): add AI status filter`) and squash incidental work.
- PRs should link tracking issues, summarize data/model impacts, list new env vars, and attach UI screenshots or screencasts.
- Confirm `npm run lint`, latest migrations, and relevant tests before assigning reviewers.

## Security & Configuration Tips
- Keep secrets in `.env`; never commit them. Required keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, and `CORS_ALLOWED_ORIGINS`.
- Coordinate credential rotations with the team and document safe defaults where possible.
