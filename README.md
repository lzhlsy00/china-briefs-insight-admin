# FortuneNews Admin

FortuneNews Admin is a single Next.js 15 application that now bundles both the
editorial console UI and the management API (previously provided by the
`fortunenews-api` Express service). The API is exposed through Next.js
route-handlers under `/api/v1`, reusing the same Prisma/PostgreSQL data model.

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 12+

## Getting Started

```bash
# install dependencies
npm install

# prepare prisma client (requires DATABASE_URL)
npx prisma generate

# push schema changes to your database (first run only)
npx prisma db push

# start the dev server (Next.js + API)
npm run dev
```

> Tip: when running the standalone frontend, expose the API to the browser by
> exporting `CORS_ALLOWED_ORIGINS=http://localhost:3002` (or the port you use
> for the frontend dev server) before starting `npm run dev`.

The Next.js dev server now exposes the UI at `http://localhost:3000` and the API
at `http://localhost:3000/api/v1/*`.

## Environment Variables

Create an `.env` file (see `.env.example`) with the following variables:

- `DATABASE_URL` – PostgreSQL connection string used by Prisma.
- `NEXT_PUBLIC_API_URL` – Optional override for the admin UI to call the API.
  When omitted, the UI will talk to the co-located `/api/v1` routes.
- `CORS_ALLOWED_ORIGINS` – Optional comma-separated list of origins allowed to
  call the API from the browser. Defaults to `*` which enables public access.
- `SUPABASE_URL` – Supabase 项目地址，后端使用 service key 直接访问数据库。
- `SUPABASE_SERVICE_KEY` – Supabase service role 密钥，用于服务端调用。
- `OPENAI_API_KEY` – 生成每日推送摘要所需的密钥，未设置时将退化为简单排序。
- `OPENAI_MODEL` – 可选，自定义使用的模型（默认 `gpt-4o-mini`）。
- `OPENAI_BASE_URL` – 可选，接入 OpenAI 兼容服务时指定自定义 Base URL。

## Useful Commands

```bash
npm run dev        # start Next.js with the integrated API
npm run build      # build for production
npm run start      # serve the production build
npm run lint       # run linting
npx prisma studio  # open Prisma Studio to inspect data
```

## API Overview

- Documentation: `GET /api/v1/docs`
- Health check: `GET /api/v1/health`
- Admin endpoints: `/api/v1/admin/*`
- Public endpoints: `/api/v1/public/*`
- Upload endpoint: `POST /api/v1/upload`

The request/response shapes are compatible with the former Express API to
ensure the existing admin UI continues to function without changes.
