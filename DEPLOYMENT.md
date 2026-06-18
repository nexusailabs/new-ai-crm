# New AI CRM - Deployment Guide

Complete deployment documentation for installing and running New AI CRM on a new server.

---

## 1. System Requirements

### Hardware
- **CPU**: 4+ cores recommended (gRPC streaming is CPU intensive)
- **RAM**: 8GB+ (for gRPC streams + Next.js + Supabase)
- **Storage**: 50GB+ (database grows with trading data)

### Software
- **OS**: macOS (tested) or Linux (Ubuntu 22.04+)
- **Node.js**: v22+ (LTS recommended)
- **npm**: v10.9.2+ or pnpm
- **Caddy**: v2.x (reverse proxy)
- **Supabase CLI**: v1.x (local database)
- **PM2**: Process manager (included in devDependencies)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                    Cloudflare Tunnel (bkf.app)                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                         Caddy (Reverse Proxy)                               │
│                         Port: 80, 443                                       │
│                                                                             │
│  Route: /ai-crm/* → localhost:3002                                          │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                      New AI CRM (Next.js 16.1.1)                            │
│                      Port: 3002                                             │
│                      basePath: /ai-crm                                      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          Frontend (React 19)                           │ │
│  │  - Customer Management     - Withdrawal Processing                     │ │
│  │  - Trading Accounts        - Real-time Monitoring                      │ │
│  │  - Deposits/Withdrawals    - Analytics Dashboard                       │ │
│  │  - gRPC Stream Viewer      - Command Palette                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          API Routes                                    │ │
│  │  /api/customers/*         - Customer CRUD                              │ │
│  │  /api/accounts/*          - Account management                         │ │
│  │  /api/trading-accounts/*  - Trading account sync                       │ │
│  │  /api/withdrawals/*       - Withdrawal processing                      │ │
│  │  /api/deposits/*          - Deposit tracking                           │ │
│  │  /api/grpc/stream         - gRPC stream status                         │ │
│  │  /api/sync/withdrawals    - Manual sync trigger                        │ │
│  │  /api/cron/*              - Scheduled sync jobs                        │ │
│  │  /api/webhooks/*          - Match-Trade webhooks                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    Supabase      │    │   Match-Trade    │    │  gRPC Streams    │
│    (Local)       │    │   Broker API     │    │  (Real-time)     │
│  Port: 54321     │    │ broker-api-*.com │    │                  │
│                  │    │                  │    │  - Ledgers       │
│  - PostgreSQL    │    │  - REST API      │    │  - Equity        │
│  - Realtime      │    │  - gRPC Stream   │    │  - Positions     │
│  - Auth          │    │                  │    │  - Events        │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 3. Installation Steps

### Step 1: Install Node.js

```bash
# macOS (Homebrew)
brew install node@22

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Install Caddy

```bash
# macOS
brew install caddy

# Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Step 3: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux (npm)
npm install -g supabase
```

### Step 4: Clone Repository

```bash
git clone https://github.com/nexusailabs/new-ai-crm.git ~/new-ai-crm
cd ~/new-ai-crm
```

### Step 5: Install Dependencies

```bash
npm install
# or
pnpm install
```

---

## 4. Configuration

### 4.1 Environment Variables

Create `.env.local` file:

```bash
# Match-Trade API Configuration
MATCH_TRADE_BASE_URL=https://broker-api-gudax.match-trade.com
MATCH_TRADE_API_KEY=<your-api-key>
MATCH_TRADE_BROKER_ID=159
MATCH_TRADE_PARTNER_ID=159

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### 4.2 Match-Trade API Keys

Obtain from Match-Trade dashboard:
1. Login to broker admin panel
2. Navigate to API Settings
3. Generate API key with required permissions:
   - Account read/write
   - Trading accounts read
   - Financial transactions read/write
   - Withdrawal approve/reject

### 4.3 next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ai-crm",
  assetPrefix: "/ai-crm",
};

export default nextConfig;
```

### 4.4 Caddyfile

```caddyfile
your-domain.com {
    # AI CRM
    handle /ai-crm* {
        reverse_proxy localhost:3002
    }

    file_server

    log {
        output file /var/log/caddy/access.log
    }
}
```

---

## 5. Database Setup

### 5.1 Start Supabase

```bash
cd ~/new-ai-crm
supabase start
```

### 5.2 Database Schema

The application uses the following tables:

| Table | Description |
|-------|-------------|
| `accounts` | Customer accounts from Match-Trade |
| `trading_accounts` | Trading accounts linked to customers |
| `withdrawals` | Cached withdrawal requests |
| `trading_events` | Real-time trading events (margin calls, stop-outs) |
| `account_equity` | Real-time account equity tracking |
| `positions` | Open trading positions |
| `pending_orders` | Pending limit/stop orders |
| `sync_metadata` | Sync status tracking |
| `withdrawal_action_logs` | Audit log for withdrawal actions |
| `webhook_configs` | Webhook notification settings |
| `ib_accounts` | IB hierarchy structure |
| `ib_commissions` | Commission tracking |

### 5.3 Apply Migrations

```bash
supabase db reset  # Apply all migrations
```

### 5.4 Key Schema Features

```sql
-- Trading Accounts (Match-Trade sync)
CREATE TABLE trading_accounts (
  id UUID PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  login TEXT NOT NULL,
  account_uuid TEXT REFERENCES accounts(uuid),
  leverage INTEGER,
  account_type TEXT CHECK (account_type IN ('DEMO', 'REAL')),
  finance_info JSONB,  -- balance, equity, margin, etc.
  synced_at TIMESTAMPTZ
);

-- Withdrawals Cache
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  account_uuid TEXT NOT NULL,
  amount DECIMAL(18, 8),
  currency TEXT DEFAULT 'USD',
  status TEXT,
  mapped_status TEXT CHECK (mapped_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payment_gateway_name TEXT,
  raw_data JSONB
);

-- Real-time Trading Events
CREATE TABLE trading_events (
  id SERIAL PRIMARY KEY,
  uuid UUID UNIQUE,
  event_type VARCHAR(50),  -- MARGIN_CALL, STOP_OUT, TAKE_PROFIT, etc.
  account_login VARCHAR(50),
  symbol VARCHAR(50),
  details JSONB,
  severity VARCHAR(20)  -- INFO, WARNING, CRITICAL
);

-- Supabase Realtime enabled on:
-- trading_events, positions, pending_orders, withdrawals
```

---

## 6. Match-Trade API Integration

### 6.1 REST API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/accounts` | Fetch customer list |
| `GET /v1/accounts/{uuid}` | Get customer details |
| `GET /v1/accounts/{uuid}/tradingAccounts` | Get trading accounts |
| `GET /v1/withdrawals` | List withdrawal requests |
| `PUT /v1/withdrawals/{uuid}/approve` | Approve withdrawal |
| `PUT /v1/withdrawals/{uuid}/reject` | Reject withdrawal |
| `GET /v1/deposits` | List deposits |

### 6.2 gRPC Streaming Services

| Service | Table | Purpose |
|---------|-------|---------|
| `getLedgersStreamByGroupsOrLogins` | withdrawals | Real-time transactions |
| `getTradingEventsStream` | trading_events | Margin calls, stop-outs |
| `getClientEquityStream` | account_equity | Balance updates |
| `getOpenPositionsStreamByGroupsOrLogins` | positions | Position changes |
| `getOrdersUpdateStreamByGroupsOrLogins` | pending_orders | Order updates |

### 6.3 gRPC Proto Files

Located in `src/lib/grpc/`:
- `equity.proto` - Account equity streaming
- `ledger.proto` - Transaction streaming
- `positions.proto` - Position streaming
- `orders.proto` - Order streaming
- `trading-events.proto` - Event streaming

---

## 7. Running the Application

### 7.1 Development Mode

```bash
cd ~/new-ai-crm
npm run dev -- -p 3002
```

### 7.2 Production Mode

```bash
npm run build
npm run start -- -p 3002
```

### 7.3 Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.js

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'ai-crm',
    script: 'npm',
    args: 'run start',
    cwd: '/home/kei/new-ai-crm',
    env: {
      PORT: 3002,
      NODE_ENV: 'production',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/home/kei/logs/ai-crm-error.log',
    out_file: '/home/kei/logs/ai-crm-out.log',
  }]
};
```

---

## 8. API Routes Reference

### Customer Management
| Route | Method | Description |
|-------|--------|-------------|
| `/api/customers` | GET | List all customers |
| `/api/customers` | POST | Create customer |
| `/api/customers/[id]` | GET | Get customer by ID |
| `/api/customers/[id]` | PUT | Update customer |

### Trading Accounts
| Route | Method | Description |
|-------|--------|-------------|
| `/api/trading-accounts` | GET | List trading accounts |
| `/api/trading-accounts/by-login` | GET | Find by login |
| `/api/accounts` | GET | List accounts |
| `/api/accounts/[uuid]` | GET | Get account by UUID |

### Withdrawals
| Route | Method | Description |
|-------|--------|-------------|
| `/api/withdrawals` | GET | List withdrawals |
| `/api/withdrawals/[uuid]/approve` | POST | Approve withdrawal |
| `/api/withdrawals/[uuid]/reject` | POST | Reject withdrawal |
| `/api/withdrawals/[uuid]/action` | POST | Generic action |
| `/api/sync/withdrawals` | POST | Trigger manual sync |

### Deposits
| Route | Method | Description |
|-------|--------|-------------|
| `/api/deposits` | GET | List deposits |

### gRPC & Sync
| Route | Method | Description |
|-------|--------|-------------|
| `/api/grpc/stream` | GET | Stream status |
| `/api/cron/sync-withdrawals` | GET | Cron sync job |

### Webhooks
| Route | Method | Description |
|-------|--------|-------------|
| `/api/webhooks/match-trade/withdrawal-status` | POST | Status webhook |

---

## 9. Frontend Features

### 9.1 Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/ai-crm` | Overview with stats |
| Customers | `/ai-crm/customers` | Customer list |
| Customer Detail | `/ai-crm/customers/[id]` | Customer profile |
| Trading | `/ai-crm/trading` | Trading accounts |
| Withdrawals | `/ai-crm/withdrawals` | Withdrawal management |
| Deposits | `/ai-crm/deposits` | Deposit tracking |
| Monitoring | `/ai-crm/monitoring` | Real-time monitoring |
| Analytics | `/ai-crm/analytics` | Reports & analytics |
| Settings | `/ai-crm/settings` | System settings |
| Login | `/ai-crm/login` | Authentication |

### 9.2 Key Components

- **Command Palette** (`Cmd+K`) - Quick navigation
- **VirtualizedTable** - High-performance large lists
- **ActivityFeed** - Real-time transaction feed
- **InsightPanel** - AI-powered insights
- **StreamIndicator** - gRPC connection status

### 9.3 State Management

- **Zustand** stores:
  - `authStore` - Authentication state
  - `customerStore` - Customer data
  - `paymentStore` - Payment data
  - `i18nStore` - Internationalization
  - `notificationStore` - Toast notifications
  - `insightStore` - AI insights

---

## 10. Port Summary

| Service | Port | Description |
|---------|------|-------------|
| Caddy | 80, 443 | HTTP/HTTPS reverse proxy |
| AI CRM | 3002 | Next.js application |
| Supabase API | 54321 | Database API |
| Supabase Studio | 54323 | Database admin UI |
| Supabase DB | 54322 | PostgreSQL direct |

---

## 11. Dependencies

```json
{
  "dependencies": {
    "@grpc/grpc-js": "^1.14.3",
    "@grpc/proto-loader": "^0.8.0",
    "@supabase/supabase-js": "^2.89.0",
    "@tanstack/react-query": "^5.90.12",
    "@tanstack/react-virtual": "^3.13.13",
    "axios": "^1.13.2",
    "clsx": "^2.1.1",
    "framer-motion": "^12.23.26",
    "lucide-react": "^0.562.0",
    "next": "16.1.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-window": "^2.2.3",
    "tailwind-merge": "^3.4.0",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@tanstack/react-query-devtools": "^5.91.2",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.1",
    "playwright": "^1.57.0",
    "pm2": "^6.0.14",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## 12. Quick Start Script

Create `start.sh`:

```bash
#!/bin/bash

echo "Starting New AI CRM..."

# 1. Start Supabase
echo "Starting Supabase..."
supabase start &
sleep 10

# 2. Start Next.js with PM2
echo "Starting Next.js..."
cd ~/new-ai-crm
pm2 start ecosystem.config.js

# 3. Start Caddy
echo "Starting Caddy..."
caddy run --config ~/gudax-trade/Caddyfile &

echo "All services started!"
echo "Access: https://your-domain.com/ai-crm"
echo ""
echo "Useful commands:"
echo "  pm2 logs ai-crm     - View logs"
echo "  pm2 restart ai-crm  - Restart app"
echo "  supabase status     - Check DB status"
```

```bash
chmod +x start.sh
./start.sh
```

---

## 13. gRPC Streaming Architecture

See `docs/GRPC_STREAMING_ARCHITECTURE.md` for detailed documentation.

### Key Concepts:

1. **Stream Classification**
   - Critical (100ms): Ledgers, Trading Events
   - High-frequency (1-5s): Equity, Positions
   - Medium (500ms): Quotes, Orders
   - Low (immediate): Account changes

2. **Optimization Strategies**
   - Tiered subscription by account importance
   - Delta-only storage (>1% change threshold)
   - Batched writes with deduplication
   - Group sharding for large deployments

3. **Database Write Strategy**
   ```
   gRPC Stream → Event Buffer → Batch Writer (500ms) → Supabase → Realtime
   ```

---

## 14. Troubleshooting

### Common Issues

**1. gRPC Connection Failed**
```bash
# Check if gRPC endpoint is reachable
grpcurl -plaintext grpc-broker-api-gudax.match-trade.com:443 list
```

**2. Supabase Connection Refused**
```bash
supabase status  # Check status
supabase start   # Start if not running
```

**3. Match-Trade API 401 Unauthorized**
- Verify API key in `.env.local`
- Check if API key has required permissions
- Ensure BROKER_ID and PARTNER_ID are correct

**4. PM2 Process Keeps Restarting**
```bash
pm2 logs ai-crm --lines 100  # Check error logs
pm2 describe ai-crm          # Check process details
```

**5. Port 3002 Already in Use**
```bash
lsof -i :3002  # Find process
kill -9 <PID>  # Kill it
```

---

## 15. Security Notes

1. **Environment Variables**: Never commit `.env.local`
2. **API Keys**: Rotate Match-Trade API keys quarterly
3. **RLS**: Row Level Security enabled on all tables
4. **Audit Logging**: All withdrawal actions logged
5. **HTTPS**: Required for production (Caddy auto-TLS)

---

## 16. Backup & Recovery

### Backup Database
```bash
supabase db dump -f backup.sql
```

### Restore Database
```bash
supabase db reset
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres < backup.sql
```

### Backup Configuration
```bash
# Backup .env and configs
tar -czvf ai-crm-config-backup.tar.gz \
  .env.local \
  ecosystem.config.js \
  next.config.ts
```

---

## 17. Monitoring & Logs

### PM2 Monitoring
```bash
pm2 monit       # Real-time monitoring
pm2 logs        # View logs
pm2 status      # Process status
```

### Log Files
- Application: `/home/kei/logs/ai-crm-out.log`
- Errors: `/home/kei/logs/ai-crm-error.log`
- Caddy: `/var/log/caddy/access.log`

### Health Check
```bash
curl http://localhost:3002/ai-crm/api/health
```

---

**Last Updated**: 2026-01-01
**Version**: 0.3.0
