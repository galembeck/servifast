# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ServiFast** is a restaurant control-panel system (waiters, kitchen, CEOs, etc.), built by adapting a generic multi-tenant SaaS + RBAC template. The original template's `Organization` model has been renamed to `Restaurant` throughout the stack (DB, API routes, RBAC subject, frontend), and `packages/rbac`'s permissions now reflect restaurant-specific roles (OWNER/MANAGER/WAITER/CASHIER/KITCHEN/BILLING). `Project`/`Invite` still reflect the original template and haven't been reworked for the restaurant domain yet.

Authentication is e-mail/CPF (Brazilian document) + password only; there is no GitHub/OAuth login and no public self-registration (staff accounts are provisioned via invites).

Frontend UI copy is Portuguese (matching the target users); backend and code-level identifiers (models, routes, variables, RBAC subjects) stay English.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Fastify 5 + `fastify-type-provider-zod` |
| ORM | Prisma 7 (client output: `apps/api/src/generated/prisma`) |
| Auth | JWT (`@fastify/jwt`), bcryptjs |
| RBAC | CASL (`@casl/ability`) via `packages/rbac` |
| API client | `ky` v2 + TanStack Query v5 |
| Database | PostgreSQL (Docker) |
| Monorepo | Turborepo + pnpm workspaces |
| Email | Resend (`@resend`) |

## Monorepo Structure

Turborepo + pnpm monorepo. Workspace roots declared in `pnpm-workspace.yaml`:

- `apps/api` — Fastify REST API (`@repo/api`)
- `apps/web` — Next.js frontend (`web`)
- `packages/rbac` — Shared CASL ability definitions and permission rules
- `packages/env` — Shared env validation via `@t3-oss/env-nextjs`
- `config/eslint-config` — Exports `./base`, `./next-js`, `./node`
- `config/prettier-config` — Prettier with `prettier-plugin-tailwindcss`
- `config/typescript-config` — Exports `base.json`, `nextjs.json`

Internal packages use `workspace:*` protocol.

## Commands

```bash
pnpm dev           # Run all apps in dev mode (via Turbo)
pnpm build         # Build all packages
pnpm check-types   # TypeScript type checking across all packages
pnpm check         # Lint/format check via Ultracite (Biome)
pnpm fix           # Auto-fix lint/format issues via Ultracite
```

Run a single Turbo task:
```bash
pnpm turbo run dev --filter=@repo/api
pnpm turbo run dev --filter=web
```

Database (requires Docker running):
```bash
docker compose up -d                         # Start PostgreSQL on port 5432
pnpm --filter @repo/api db:migrate           # Run Prisma migrations
pnpm --filter @repo/api db:seed              # Seed the database
pnpm --filter @repo/api db:studio            # Open Prisma Studio
pnpm --filter @repo/api db:generate          # Regenerate Prisma client
```

Tests (API only — no frontend tests):
```bash
pnpm --filter @repo/api test                 # Run all tests once
pnpm --filter @repo/api test:watch           # Watch mode
pnpm --filter @repo/api test:coverage        # Coverage report
```

All DB and env-loading scripts prefix with `pnpm env:load` (uses `dotenv-cli` to read root `.env`).

## Linting & Formatting

**Biome** is the formatter and linter (`biome.json`), driven by **Ultracite** presets. Key style: tabs, double quotes.

- Pre-commit hook (`/.husky/pre-commit`) auto-runs `pnpm dlx ultracite fix` and re-stages changed files.
- A PostToolUse hook in `.claude/settings.json` runs `pnpm fix --skip=correctness/noUnusedImports` after every file Write or Edit.
- ESLint (`config/eslint-config`) handles framework-level rules (Next.js, React hooks, Turbo env-var checks) only.

## TypeScript

Base tsconfig enforces strict mode with `noUncheckedIndexedAccess` — array index access returns `T | undefined`. Module resolution is `NodeNext` — TypeScript source files need explicit `.js` extensions on imports.

## Architecture

### API (`apps/api`)

Fastify 5 with `fastify-type-provider-zod` for end-to-end type safety. Every route is a Fastify plugin registered in `src/server.ts`. Route files live in `src/http/routes/<domain>/` and follow a one-file-per-operation pattern (e.g., `create-restaurant.ts`, `get-restaurants.ts`).

**Auth middleware** (`src/http/middlewares/auth.ts`): a Fastify plugin that decorates each request with:
- `request.getCurrentUserId()` — verifies JWT, returns user ID
- `request.getUserMembership(slug)` — looks up membership + restaurant for the authenticated user

**Error handling**: domain exceptions in `src/http/_errors/exceptions/` (organized by domain), HTTP error classes in `src/http/routes/_errors/`. The global error handler in `src/http/error-handler.ts` maps them to status codes.

**Static files**: multipart uploads are limited to 5 MB; uploaded files are served from `GET /uploads/:filename` via `@fastify/static`.

**API docs**: interactive Scalar docs auto-generated from OpenAPI schema at `http://localhost:3333/docs`.

### Frontend (`apps/web`)

Next.js App Router with `src/` directory layout.

**Route groups and co-location conventions:**
- `(app)/` — authenticated app shell (layout includes sidebar/nav)
- `@sheet/` — parallel route for sheets/modals (intercepts create-restaurant)
- `~components/` — co-located components private to that route segment
- `~actions/` — Server Actions (Next.js `"use server"`) private to that segment
- `_actions/` — same as `~actions/` (older convention, some routes use underscore)

**API client** (`src/api/http/api-client.ts`): a `ky` instance that auto-attaches the `accessToken` cookie as a Bearer token. Works in both Server Components (reads from `next/headers`) and Client Components (reads from `cookies-next`). Service functions live in `src/api/http/services/`.

**Data fetching:** Server Components call service functions directly. Client Components that need reactivity use TanStack Query (`src/api/react-query.ts`).

**Auth provider** (`src/providers/auth-provider.ts`): server-side helpers:
- `isAuthenticated()` — checks for `accessToken` cookie
- `getCurrentRestaurant()` — reads `restaurant` cookie (slug)
- `ability()` — fetches membership, returns a CASL ability object
- `auth()` — redirects to sign-in if unauthenticated

### RBAC (`packages/rbac`)

Built on CASL. `defineAbilityFor(user)` returns an `AppAbility` instance based on the user's role. Permission subjects: `Restaurant`, `User`, `Invite`, `Menu`, `Order`, `Table`, `Shift`, `Billing`.

Use `ability()` from `auth-provider.ts` in Server Components to gate UI. `Order`, `Table`, `Shift` subjects are defined ahead of their feature routes — no DB models exist yet.

Owner-level restriction: only the restaurant's `ownerId` may call `transfer_ownership` or `update` on `Restaurant`, even for users with the OWNER role.

### Environment Variables

All env vars are validated in `packages/env/index.ts` via `@t3-oss/env-nextjs`. Root `.env` is loaded by each app's scripts via `dotenv-cli`. Required vars: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL`. Optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WEB_URL`.

## Testing

Tests are in `apps/api` only (Vitest). The Prisma client is **manually mocked** (not hitting a real DB) — the mock is in `src/test/mocks/prisma.ts` and replaces `@/lib/prisma` via `vi.mock`. Each test file must call `resetPrismaMocks()` in `beforeEach` to clear state.

Test helpers:
- `buildApp()` — creates a full Fastify app with all routes registered (used for integration-style route tests)
- `signToken(app, userId)` — returns a signed JWT for a given user ID
- `mockMembership(userId, role)` — configures `prismaMock.member.findFirst` to return a membership + restaurant fixture

Run the full suite with `pnpm --filter @repo/api test` — no DB required.

## Adding a New Package

1. Create directory under `apps/` or `packages/`
2. Add `package.json` with `"name": "@repo/<name>"` and `"private": true`
3. Extend tsconfig: `{ "extends": "@repo/typescript-config/base.json" }`
4. Reference ESLint: `import { config } from "@repo/eslint-config/base"`
5. No need to update `pnpm-workspace.yaml` — globs already cover new packages
