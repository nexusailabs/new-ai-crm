# New AI CRM

New AI CRM is a TypeScript CRM and trading-operations dashboard for broker and fintech workflows built around Match-Trade style account data. It combines customer management, trading account visibility, deposit and withdrawal monitoring, gRPC-style event streams, Supabase persistence, and audit-friendly operations screens in a single Next.js application.

The project is designed as an operational back office: customer records, trading accounts, payment events, withdrawal actions, account equity, positions, pending orders, webhook events, and reporting views are represented as code, API routes, UI screens, and database migrations.

## Delivery Reference

This repository documents the New AI CRM software deliverable provided by Nexus AI Labs for **Shanghai Carbon Rich Invest PTE. LTD.**

For review and evidence purposes, the repository contains the application source code, API routes, database migrations, integration adapters, operational dashboards, and deployment documentation associated with that software deliverable.

## Repository Status

| Item | Value |
|---|---|
| Framework | Next.js 16.1.1 App Router |
| Language | TypeScript |
| UI | React 19, Tailwind CSS, Lucide icons |
| State and data | Zustand, TanStack Query |
| Database | Supabase / PostgreSQL |
| External integration | Match-Trade Broker API style REST endpoints and gRPC stream adapters |
| Deployment targets | Node.js server, PM2, reverse proxy, Vercel-compatible config |

## Main Capabilities

### Customer Management

- Customer list and detail pages under `src/app/customers`
- Customer API routes under `src/app/api/customers`
- Supabase-backed account record querying
- Search, sorting, filtering, and virtualized table rendering for larger account sets
- Customer detail views with linked trading account sections

### Trading Account Operations

- Trading account pages and API routes under `src/app/trading` and `src/app/api/trading-accounts`
- Match-Trade style account lookup by account UUID or login
- Synchronization script at `scripts/sync-trading-accounts.ts`
- Database migration for `trading_accounts`
- Typed account rows and trading account models under `src/types`

### Deposit, Withdrawal, and Payment Monitoring

- Deposit dashboard under `src/app/deposits`
- Withdrawal management under `src/app/withdrawals`
- Unified monitoring page under `src/app/monitoring`
- API routes for deposits, withdrawals, payment activity, sync jobs, cron sync, and webhook updates
- Payment components for stats cards, tables, activity feeds, filters, and stream indicators

### Withdrawal Workflow and Audit Trail

- Withdrawal approve, reject, and action endpoints
- Action modal UI for operational review
- Withdrawal audit helper under `src/lib/audit/withdrawal-audit.ts`
- Dedicated migration for withdrawal action logs
- Webhook route for Match-Trade withdrawal-status callbacks

### Real-Time and Stream-Oriented Data

- gRPC adapter modules under `src/lib/grpc`
- Proto definitions and stream clients for:
  - Ledger events
  - Account equity
  - Positions
  - Orders
  - Trading events
- Stream manager for coordinating event consumers
- API route for stream status and monitoring

### Analytics, Reports, and Insights

- Analytics page under `src/app/analytics`
- Reports page under `src/app/reports`
- Rule-based insight engine under `src/lib/insights`
- Insight cards, panels, and stat components
- Dashboard surfaces for account and payment operations

### Notifications and Webhooks

- Email notifier abstraction
- Webhook dispatcher with HMAC signature support
- Withdrawal notification orchestration
- Webhook configuration migration

## Application Structure

```text
new-ai-crm/
├── src/
│   ├── app/
│   │   ├── api/                    # Next.js route handlers
│   │   ├── analytics/              # Analytics dashboard
│   │   ├── customers/              # Customer list and detail pages
│   │   ├── deposits/               # Deposit monitoring
│   │   ├── monitoring/             # Unified operations dashboard
│   │   ├── reports/                # Reporting page
│   │   ├── settings/               # Settings page
│   │   ├── trading/                # Trading account views
│   │   └── withdrawals/            # Withdrawal operations
│   ├── components/                 # UI and domain components
│   ├── hooks/                      # React data hooks
│   ├── lib/                        # API clients, sync, gRPC, audit, notifier logic
│   ├── providers/                  # React providers
│   ├── stores/                     # Zustand stores
│   └── types/                      # Domain and API types
├── scripts/                        # Sync and deployment helpers
├── supabase/migrations/            # Database schema
├── docs/                           # Architecture and deployment references
├── package.json
├── next.config.ts
└── ecosystem.config.js
```

## Database Schema

The `supabase/migrations` directory contains migrations for the core operational data model:

| Migration | Purpose |
|---|---|
| `001_create_trading_accounts.sql` | Trading account records |
| `002_create_withdrawals_cache.sql` | Cached withdrawal requests |
| `003_create_trading_events.sql` | Trading event history |
| `004_create_account_equity.sql` | Equity snapshots and updates |
| `005_create_positions.sql` | Open position data |
| `006_create_pending_orders.sql` | Pending orders |
| `007_create_withdrawal_action_logs.sql` | Withdrawal action audit trail |
| `008_create_webhook_configs.sql` | Webhook configuration and signing metadata |
| `009_create_ib_hierarchy.sql` | IB hierarchy data |
| `010_commission_triggers.sql` | Commission trigger logic |

## API Surface

The repository includes route handlers for:

- `GET /api/customers`
- `GET /api/customers/[id]`
- `GET /api/accounts`
- `GET /api/accounts/[uuid]`
- `GET /api/trading-accounts`
- `GET /api/trading-accounts/by-login`
- `GET /api/deposits`
- `GET /api/withdrawals`
- `POST /api/withdrawals/[uuid]/approve`
- `POST /api/withdrawals/[uuid]/reject`
- `POST /api/withdrawals/[uuid]/action`
- `GET /api/payments/activity`
- `POST /api/sync/withdrawals`
- `POST /api/cron/sync-withdrawals`
- `GET /api/grpc/stream`
- `POST /api/webhooks/match-trade/withdrawal-status`

## Environment Variables

Create `.env.local` for local development. Do not commit real credentials.

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

MATCH_TRADE_BASE_URL=<your-match-trade-api-url>
MATCH_TRADE_API_KEY=<your-match-trade-api-key>
MATCH_TRADE_BROKER_ID=<your-broker-id>
MATCH_TRADE_PARTNER_ID=<your-partner-id>

MATCHTRADE_GRPC_SERVER=<your-grpc-server>
MATCHTRADE_GRPC_API_KEY=<your-grpc-api-key>

SYNC_API_KEY=<your-sync-api-key>
GRPC_API_KEY=<your-grpc-api-key>
CRON_SECRET=<your-cron-secret>
RESEND_API_KEY=<your-resend-api-key>
```

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The production-oriented config uses a base path in `next.config.ts`. Adjust routing and reverse proxy settings for the target deployment environment.

## Build

```bash
npm run build
npm run start
```

## Supabase Setup

Install and start Supabase locally:

```bash
supabase start
supabase db push
```

Apply migrations from:

```text
supabase/migrations/
```

## Deployment Notes

The repository includes:

- `ecosystem.config.js` for PM2 process management
- `scripts/deploy.sh` as a deployment helper template
- `DEPLOYMENT.md` for installation and operations notes
- `docs/GRPC_STREAMING_ARCHITECTURE.md` for stream architecture details

Do not hard-code server passwords or API keys. Provide deployment credentials through environment variables or a managed secret store.

## Security Notes

- No production secrets should be committed to this repository.
- API keys must be supplied through environment variables.
- Webhook secrets should be generated per environment.
- Service-role database keys must never be exposed to the browser.
- Public deployments should enable authentication, request logging, and rate limiting.

## GitHub Development Record

The repository contains a compact development history with:

- An application commit adding the New AI CRM codebase with Match-Trade integration.
- A documentation commit adding deployment and operations documentation.

The codebase includes application screens, API routes, database migrations, stream adapters, operational scripts, and deployment documentation, making it a runnable software deliverable rather than a static mockup.

## License

Private or commercial licensing terms may apply. Add a license file before external redistribution.
