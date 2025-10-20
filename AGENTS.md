# Repository Guidelines

## Project Structure & Module Organization
FortuneNews Admin runs on Next.js 15 with TypeScript. Application routes live in `src/app`, with admin dashboards under `src/app/admin`. Shared UI components sit in `src/components`, hooks in `src/hooks`, and client helpers (Prisma, Supabase, API wrappers) in `src/lib` and `src/services`. Domain types reside in `src/types`; database schema sits in `prisma/schema.prisma`; static assets are in `public`; additional references live under `docs/`.

## Build, Test, and Development Commands
- `npm run dev` launches the dashboard with Turbopack; watch the terminal for API and server logs.
- `npm run build` compiles an optimized production bundle.
- `npm run start` serves the last production build; run only after a successful build.
- `npm run lint` enforces `next/core-web-vitals` rules; append `-- --fix` to auto-format.
- `npx prisma generate` refreshes the Prisma client after schema edits.
- `npx prisma migrate dev --name <migration>` creates and applies local migrations.

## Coding Style & Naming Conventions
Write TypeScript with 2-space indentation and rely on ESLint for formatting. Name React components and hooks with PascalCase (`NewsTable`) and `use` prefixes (`useNewsList`). Modules in `src/lib` and `src/services` export camelCase helpers. Route folders remain kebab-case to mirror URL segments. Tailwind utility strings should group layout classes before color classes.

## Testing Guidelines
Add focused tests alongside features, preferably with React Testing Library. Co-locate tests as `Component.test.tsx` next to the component under test. Cover service-level mutations (Prisma interactions) and UI state changes. Document any manual verification steps in the PR when automated coverage is absent.

## Commit & Pull Request Guidelines
Write present-tense commit subjects such as `feat(admin): add AI status filter`. Squash incidental work into the main change. PRs must link tracking issues, summarize data or model impacts, highlight new env vars, and attach screenshots or screencasts for UI changes. Confirm `npm run lint` and required migrations before requesting review.

## Security & Configuration Tips
Store secrets in `.env` files and never commit them. Required keys include `DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PUBLISH_WEBHOOK_URL`, and `CORS_ALLOWED_ORIGINS`. Coordinate credential rotations with the team and document default values when relevant.
