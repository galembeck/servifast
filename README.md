# ServiFast

A full-stack multi-tenant restaurant management system with fine-grained Role-Based Access Control (RBAC), built with Next.js and Fastify inside a Turborepo monorepo.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | Fastify 5, Zod, Prisma 7 |
| Auth | JWT (`@fastify/jwt`), bcryptjs |
| RBAC | CASL (`@casl/ability`) |
| API client | ky v2, TanStack Query v5 |
| Database | PostgreSQL (via Docker) |
| Monorepo | Turborepo + pnpm workspaces |
| Linting | Biome via Ultracite  |

## Monorepo Structure

```
apps/
  api/        — Fastify REST API
  web/        — Next.js frontend
packages/
  rbac/       — Shared CASL ability definitions and permission rules
  env/        — Shared environment variable validation
config/
  eslint-config/
  prettier-config/
  typescript-config/
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker

### Setup

```bash
# Install dependencies
pnpm install

# Start the database
docker compose up -d

# Copy environment variables
cp .env.example .env

# Run database migrations and seed
pnpm --filter @repo/api db:migrate
pnpm --filter @repo/api db:seed
```

### Development

```bash
# Run all apps
pnpm dev

# Run a specific app
pnpm turbo run dev --filter=@repo/api
pnpm turbo run dev --filter=web
```

The API will be available at `http://localhost:3333` with interactive docs at `http://localhost:3333/docs`.
The web app will be available at `http://localhost:3000`.

## Features

### Authentication
- Sign up with name, email, and password
- Sign in with email and password
- Password recovery via email

### Restaurants
- Create and manage restaurants
- Transfer ownership
- Shut down a restaurant

### Invites
- Invite members by email with a specific role
- Accept or revoke pending invites

### Members
- List restaurant members
- Update member roles
- Remove members

### Projects
- Create, update, and delete projects per restaurant
- List all projects within a restaurant

### Billing
- View billing details: $20/project + $10/member (excluding billing role)

## RBAC

Roles: **Owner**, **Manager**, **Waiter**, **Cashier**, **Kitchen**, **Billing**, **Anonymous**

|                    | Owner | Manager | Waiter | Cashier | Kitchen | Billing | Anonymous |
|--------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Update restaurant | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete restaurant | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invite/revoke staff  | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List/update members | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage orders        | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage tables        | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage menu          | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage shift/register | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View billing         | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Manage billing       | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

> ⚠️ = allowed with conditions
>
> - Only the restaurant's **owner** (`ownerId`) may transfer ownership or update the restaurant, even as OWNER
> - `Order`/`Table`/`Menu`/`Shift` are permission subjects defined ahead of their features — no routes/models exist for them yet
> - `Project` is a leftover from the original SaaS template's multi-tenancy layer, not part of the restaurant domain — only OWNER can touch it via `manage all`; see `docs/PERMISSIONS.md` for the full breakdown

## Commands

```bash
pnpm dev           # Run all apps
pnpm build         # Build all packages
pnpm check-types   # TypeScript type checking
pnpm check         # Lint/format check (Biome via Ultracite)
pnpm fix           # Auto-fix lint/format issues

# Database (run from apps/api or via filter)
pnpm --filter @repo/api db:migrate   # Run migrations
pnpm --filter @repo/api db:seed      # Seed the database
pnpm --filter @repo/api db:studio    # Open Prisma Studio

# Tests
pnpm --filter @repo/api test
pnpm --filter @repo/api test:coverage
```
