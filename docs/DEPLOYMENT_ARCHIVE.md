# NEW-AI-CRM 배포 아카이브

> **Version**: 0.3.0
> **Created**: 2025-12-29
> **Last Updated**: 2025-12-29
> **Mission**: MISSION-20251229-0001 (Hybrid Data Loading + Real-time Sync)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [아키텍처](#2-아키텍처)
3. [환경 설정](#3-환경-설정)
4. [데이터베이스 스키마](#4-데이터베이스-스키마)
5. [API 엔드포인트](#5-api-엔드포인트)
6. [파일 구조](#6-파일-구조)
7. [핵심 모듈 상세](#7-핵심-모듈-상세)
8. [원격 서버 정보](#8-원격-서버-정보)
9. [배포 가이드](#9-배포-가이드)
10. [문제 해결](#10-문제-해결)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 설명

차세대 금융 AI CRM 시스템으로, Match-Trade API와 통합하여 고객 정보, 거래 계좌, 입출금 관리를 제공합니다.

### 1.2 기술 스택

| 카테고리 | 기술 |
|---------|------|
| **Frontend** | Next.js 16.1.1, React 19.2.3, TailwindCSS 4 |
| **State Management** | Zustand 5, TanStack React Query 5 |
| **Database** | Supabase (PostgreSQL) |
| **Real-time** | Supabase Realtime, gRPC Streaming |
| **UI** | Framer Motion, Lucide React Icons |
| **Styling** | Glassmorphism Design, Dark Theme |

### 1.3 주요 기능

- **Hybrid Data Loading**: DB Cache + API Delta Sync
- **Real-time Updates**: Supabase Realtime + gRPC Streaming
- **Vercel Cron Jobs**: 매 1분마다 자동 동기화
- **Match-Trade Integration**: 입출금, 거래계좌, 고객 정보

---

## 2. 아키텍처

### 2.1 Hybrid Data Loading Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            TanStack Query (React Query)                    │  │
│  │   • Automatic refetch on focus/reconnect                  │  │
│  │   • Background stale-while-revalidate                     │  │
│  │   • Optimistic UI updates                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         useRealtimeWithdrawals Hook                       │  │
│  │   • Supabase Realtime subscription                        │  │
│  │   • postgres_changes listener                             │  │
│  │   • Auto-reconnect with exponential backoff               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ GET /api/withdrawals │  │ /api/cron/sync-withdrawals     │   │
│  │ Hybrid Loading:      │  │ Vercel Cron (every 1 minute)   │   │
│  │ 1. DB Cache (fast)   │  │ • Delta sync from API          │   │
│  │ 2. API Delta         │  │ • Upsert to Supabase          │   │
│  │ 3. Merge + Dedup     │  │ • Update sync_metadata        │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────────┐
│   Supabase    │   │  Match-Trade    │   │   gRPC Stream       │
│   (Cache DB)  │   │  REST API       │   │   (Real-time)       │
│               │   │                 │   │                     │
│ • withdrawals │   │ /v1/withdrawals │   │ getLedgersStream    │
│ • sync_meta   │   │ /v1/deposits    │   │ ByGroupsOrLogins    │
│ • customers   │   │ /v1/accounts    │   │                     │
└───────────────┘   └─────────────────┘   └─────────────────────┘
```

### 2.2 데이터 흐름

1. **Vercel Cron Job** (매 1분): Match-Trade API → Supabase 동기화
2. **gRPC Stream**: 실시간 입출금 이벤트 → Supabase 저장
3. **Supabase Realtime**: DB 변경 감지 → Frontend 자동 갱신
4. **Hybrid Loading**: DB Cache 우선 + API Delta 병합

---

## 3. 환경 설정

### 3.1 필수 환경변수 (.env.local)

```bash
# ============================================================================
# Match-Trade API Configuration
# ============================================================================
MATCH_TRADE_BASE_URL=https://broker-api-gudax.match-trade.com
MATCH_TRADE_API_KEY=<your-match-trade-api-key>
MATCH_TRADE_BROKER_ID=159
MATCH_TRADE_PARTNER_ID=159

# ============================================================================
# Supabase Configuration
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# ============================================================================
# Optional: gRPC Configuration
# ============================================================================
MATCHTRADE_GRPC_SERVER=grpc-broker-api-demo.match-trader.com
MATCHTRADE_GRPC_API_KEY=<your-grpc-api-key>

# ============================================================================
# Optional: Vercel Cron Security
# ============================================================================
CRON_SECRET=<random-secret-for-cron-auth>
```

### 3.2 package.json Dependencies

```json
{
  "name": "new-ai-crm",
  "version": "0.3.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.14.3",
    "@grpc/proto-loader": "^0.8.0",
    "@supabase/supabase-js": "^2.89.0",
    "@tanstack/react-query": "^5.90.12",
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

### 3.3 Next.js Configuration (next.config.ts)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/ai-crm",
  assetPrefix: "/ai-crm",
};

export default nextConfig;
```

### 3.4 Vercel Configuration (vercel.json)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/sync-withdrawals",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## 4. 데이터베이스 스키마

### 4.1 테이블 개요

| 테이블명 | 설명 |
|---------|------|
| `withdrawals` | Match-Trade 출금 데이터 캐시 |
| `sync_metadata` | 테이블별 동기화 상태 추적 |
| `trading_accounts` | 거래 계좌 정보 |
| `customers` | 고객 정보 (CRM) |

### 4.2 withdrawals 테이블

```sql
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid TEXT UNIQUE NOT NULL,                -- Match-Trade UUID

  -- Account Information
  account_uuid TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  account_surname TEXT,

  -- Financial Details
  amount DECIMAL(18, 8) NOT NULL,
  net_amount DECIMAL(18, 8),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'NEW',       -- Original API status
  mapped_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (mapped_status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- Payment Gateway
  payment_gateway_uuid TEXT,
  payment_gateway_name TEXT,
  wallet_address TEXT,
  reference TEXT,
  payment_id TEXT,
  partner_id INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Raw API Response
  raw_data JSONB
);

-- Indexes
CREATE INDEX idx_withdrawals_uuid ON withdrawals(uuid);
CREATE INDEX idx_withdrawals_account_uuid ON withdrawals(account_uuid);
CREATE INDEX idx_withdrawals_mapped_status ON withdrawals(mapped_status);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX idx_withdrawals_status_created ON withdrawals(mapped_status, created_at DESC);
```

### 4.3 sync_metadata 테이블

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT UNIQUE NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  record_count INTEGER DEFAULT 0,
  sync_duration_ms INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize
INSERT INTO sync_metadata (table_name, last_synced_at, record_count)
VALUES ('withdrawals', '1970-01-01T00:00:00Z', 0)
ON CONFLICT (table_name) DO NOTHING;
```

### 4.4 TypeScript 타입 정의

```typescript
// src/types/supabase.ts

export type WithdrawalMappedStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface Withdrawal {
  id: string;
  uuid: string;
  account_uuid: string;
  account_email: string | null;
  account_name: string | null;
  account_surname: string | null;
  amount: number;
  net_amount: number | null;
  currency: string;
  status: string;
  mapped_status: WithdrawalMappedStatus;
  payment_gateway_uuid: string | null;
  payment_gateway_name: string | null;
  wallet_address: string | null;
  reference: string | null;
  payment_id: string | null;
  partner_id: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
  raw_data: Json | null;
}

export interface SyncMetadata {
  id: string;
  table_name: string;
  last_synced_at: string;
  record_count: number;
  sync_duration_ms: number;
  sync_status: SyncStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 5. API 엔드포인트

### 5.1 내부 API Routes

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/withdrawals` | Hybrid 출금 데이터 조회 |
| POST | `/api/withdrawals` | 출금 승인/거부 |
| GET | `/api/deposits` | 입금 데이터 조회 |
| GET | `/api/customers` | 고객 목록 조회 |
| GET | `/api/customers/[id]` | 고객 상세 조회 |
| GET | `/api/accounts` | 계좌 목록 조회 |
| GET | `/api/accounts/[uuid]` | 계좌 상세 조회 |
| GET | `/api/trading-accounts` | 거래계좌 목록 |
| GET | `/api/trading-accounts/by-login` | 로그인별 거래계좌 |
| GET | `/api/cron/sync-withdrawals` | Cron: Delta 동기화 |
| POST | `/api/sync/withdrawals` | 수동 동기화 트리거 |
| GET | `/api/grpc/stream` | gRPC 스트림 상태 |
| POST | `/api/grpc/stream` | gRPC 스트림 시작/중지 |

### 5.2 Match-Trade API Endpoints

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/v1/withdrawals` | 출금 목록 조회 |
| GET | `/v1/deposits` | 입금 목록 조회 |
| GET | `/v1/accounts` | 계좌 목록 조회 |
| GET | `/v1/accounts/{uuid}` | 계좌 상세 |
| GET | `/v1/trading-accounts` | 거래계좌 목록 |

### 5.3 API 인증

```typescript
// Match-Trade API 인증 헤더
headers: {
  'Authorization': process.env.MATCH_TRADE_API_KEY,
  'Content-Type': 'application/json',
}
```

---

## 6. 파일 구조

```
new-ai-crm/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── accounts/             # 계좌 API
│   │   │   ├── cron/                 # Cron Jobs
│   │   │   │   └── sync-withdrawals/ # 1분 동기화
│   │   │   ├── customers/            # 고객 API
│   │   │   ├── deposits/             # 입금 API
│   │   │   ├── grpc/                 # gRPC 제어
│   │   │   │   └── stream/
│   │   │   ├── sync/                 # 수동 동기화
│   │   │   ├── trading-accounts/     # 거래계좌 API
│   │   │   └── withdrawals/          # 출금 API
│   │   ├── analytics/                # 분석 페이지
│   │   ├── customers/                # 고객 페이지
│   │   ├── deposits/                 # 입금 페이지
│   │   ├── login/                    # 로그인 페이지
│   │   ├── monitoring/               # 모니터링
│   │   ├── reports/                  # 리포트
│   │   ├── settings/                 # 설정
│   │   ├── trading/                  # 거래
│   │   ├── withdrawals/              # 출금 페이지
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   └── page.tsx                  # 대시보드
│   │
│   ├── components/
│   │   ├── auth/                     # 인증 컴포넌트
│   │   ├── command/                  # 커맨드 팔레트
│   │   ├── customer/                 # 고객 컴포넌트
│   │   ├── layout/                   # 레이아웃 컴포넌트
│   │   ├── payment/                  # 결제 컴포넌트
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── PaymentFilters.tsx
│   │   │   ├── PaymentStatsCard.tsx
│   │   │   ├── PaymentTable.tsx
│   │   │   └── StreamIndicator.tsx   # Live/Offline 표시
│   │   ├── providers/                # React Query Provider
│   │   └── ui/                       # UI 컴포넌트
│   │
│   ├── hooks/
│   │   ├── useRealtimeWithdrawals.ts # Supabase Realtime Hook
│   │   └── useWithdrawals.ts         # React Query Hook
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts             # Axios Client
│   │   │   ├── endpoints.ts          # API 함수
│   │   │   ├── payments.ts           # 결제 API
│   │   │   └── trading-accounts.ts   # 거래계좌 API
│   │   ├── data/
│   │   │   ├── merge.ts              # 데이터 병합
│   │   │   ├── sync.ts               # 동기화 유틸
│   │   │   └── withdrawals.ts        # Hybrid 로더
│   │   ├── grpc/
│   │   │   ├── ledger.proto          # gRPC Proto 정의
│   │   │   └── ledger-stream.ts      # gRPC 클라이언트
│   │   ├── sync/
│   │   │   └── worker.ts             # Sync Worker
│   │   ├── supabase.ts               # Supabase Client
│   │   └── utils.ts                  # 유틸리티
│   │
│   ├── stores/
│   │   ├── authStore.ts              # 인증 상태
│   │   ├── customerStore.ts          # 고객 상태
│   │   └── paymentStore.ts           # 결제 상태
│   │
│   └── types/
│       ├── account-row.ts
│       ├── auth.ts
│       ├── customer.ts
│       ├── index.ts
│       ├── payment.ts
│       ├── supabase.ts               # DB 스키마 타입
│       └── trading-account.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_create_trading_accounts.sql
│       └── 002_create_withdrawals_cache.sql
│
├── docs/
│   ├── DEPLOYMENT_ARCHIVE.md         # 이 파일
│   └── GRPC_STREAMING_ARCHITECTURE.md
│
├── .env.local                        # 환경변수 (gitignore)
├── .env.example                      # 환경변수 예제
├── ecosystem.config.js               # PM2 설정
├── next.config.ts                    # Next.js 설정
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json                       # Vercel Cron 설정
```

---

## 7. 핵심 모듈 상세

### 7.1 Sync Worker (src/lib/sync/worker.ts)

Delta 동기화 워커:
- 마지막 동기화 이후 변경된 데이터만 가져옴
- Upsert로 새로운 데이터 삽입/기존 데이터 업데이트
- 동시 실행 방지를 위한 Lock 메커니즘

```typescript
export async function syncWithdrawals(options: SyncOptions = {}): Promise<SyncResult>
export async function fullSyncWithdrawals(): Promise<SyncResult>
export async function isSyncHealthy(thresholdMs?: number): Promise<boolean>
```

### 7.2 Hybrid Data Loader (src/lib/data/withdrawals.ts)

캐시 우선 + API Delta 병합:
- DB에서 캐시된 데이터 빠르게 로드 (~50ms)
- 병렬로 API에서 새 데이터 Delta 가져오기
- 타임스탬프 기반 중복 제거 및 병합

```typescript
export async function getWithdrawalsHybrid(options?: GetWithdrawalsOptions): Promise<HybridWithdrawalsResult>
export async function getWithdrawalsFromCache(options?: GetWithdrawalsOptions): Promise<HybridWithdrawalsResult>
```

### 7.3 gRPC Stream (src/lib/grpc/ledger-stream.ts)

실시간 입출금 이벤트 수신:
- Match-Trade gRPC 서버 연결
- 자동 재연결 (Exponential Backoff)
- 수신 데이터 자동 DB 저장

```typescript
export class LedgerStreamService {
  async start(): Promise<void>
  stop(): void
  getStats(): StreamStats
}
```

### 7.4 Realtime Hook (src/hooks/useRealtimeWithdrawals.ts)

Supabase Realtime 구독:
- `postgres_changes` 이벤트 리스닝
- INSERT/UPDATE/DELETE 감지
- React Query 캐시 자동 무효화

```typescript
export function useRealtimeWithdrawals(options?: UseRealtimeWithdrawalsOptions): UseRealtimeWithdrawalsReturn
```

### 7.5 Status Mapping

Match-Trade → 간소화 상태:

| Match-Trade Status | Mapped Status |
|-------------------|---------------|
| DONE, FULLY_PAID, PARTIALLY_PAID, BOOKED | APPROVED |
| NEW, PROCESSING, PROCESSING_PAYMENT, AWAITING_CONFIRMATION, ADMIN_CONFIRMATION | PENDING |
| FAILED, FAILED_PAYMENT, REJECTED, CANCELLED_BY_USER, REFUNDED | REJECTED |

---

## 8. 원격 서버 정보

### 8.1 서버 접속 정보

```
Host: neu.tplinkdns.com
User: kei
Password: <redacted>
SSH: ssh kei@neu.tplinkdns.com
```

### 8.2 애플리케이션 경로

```
Application: ~/www/ai-crm/
Logs: ~/logs/ai-crm-*.log
Port: 3002
Base URL: https://neu.tplinkdns.com/ai-crm
```

### 8.3 PM2 Ecosystem Config (ecosystem.config.js)

```javascript
module.exports = {
  apps: [
    {
      name: 'ai-crm',
      script: 'npm',
      args: 'run start',
      cwd: '/home/kei/www/ai-crm',
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
    },
  ],
};
```

### 8.4 Supabase 로컬 인스턴스

```
URL: http://127.0.0.1:54321
Studio: http://127.0.0.1:54323
```

---

## 9. 배포 가이드

### 9.1 새 서버 초기 설정

```bash
# 1. Node.js 설치 (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. PM2 전역 설치
npm install -g pm2

# 3. 프로젝트 클론 또는 복사
git clone <repo-url> ~/www/ai-crm
cd ~/www/ai-crm

# 4. 의존성 설치
npm install

# 5. 환경변수 설정
cp .env.example .env.local
nano .env.local  # 값 설정

# 6. 빌드
npm run build

# 7. PM2로 실행
pm2 start ecosystem.config.js
pm2 save

# 8. Supabase 마이그레이션
# supabase CLI 또는 직접 SQL 실행
supabase db push
# 또는
psql -h 127.0.0.1 -p 54322 -U postgres -f supabase/migrations/001_create_trading_accounts.sql
psql -h 127.0.0.1 -p 54322 -U postgres -f supabase/migrations/002_create_withdrawals_cache.sql
```

### 9.2 업데이트 배포

```bash
cd ~/www/ai-crm

# 1. 코드 업데이트
git pull
# 또는 rsync로 복사

# 2. 의존성 업데이트 (package.json 변경 시)
npm install

# 3. 빌드
npm run build

# 4. PM2 재시작
pm2 restart ai-crm
```

### 9.3 rsync 배포 (로컬 → 원격)

```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  /home/kei/new-ai-crm/ \
  kei@neu.tplinkdns.com:~/www/ai-crm/

# 원격에서 빌드
ssh kei@neu.tplinkdns.com "cd ~/www/ai-crm && npm install && npm run build && pm2 restart ai-crm"
```

### 9.4 Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod

# 환경변수 설정 (Vercel Dashboard에서)
# - MATCH_TRADE_BASE_URL
# - MATCH_TRADE_API_KEY
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - CRON_SECRET
```

---

## 10. 문제 해결

### 10.1 일반적인 문제

| 문제 | 해결방법 |
|-----|---------|
| 빌드 실패 | `rm -rf .next && npm run build` |
| 타입 에러 | `npx tsc --noEmit` 로 확인 |
| 동기화 안됨 | sync_metadata 테이블 확인, 수동 트리거 |
| Realtime 연결 안됨 | Supabase Realtime 활성화 확인 |

### 10.2 로그 확인

```bash
# PM2 로그
pm2 logs ai-crm

# 실시간 로그
pm2 logs ai-crm --lines 100 -f

# 에러 로그만
tail -f ~/logs/ai-crm-error.log
```

### 10.3 동기화 상태 확인

```sql
-- sync_metadata 확인
SELECT * FROM sync_metadata;

-- 최근 동기화된 출금 확인
SELECT * FROM withdrawals ORDER BY synced_at DESC LIMIT 10;
```

### 10.4 수동 Full Sync

```bash
# API 호출
curl -X POST http://localhost:3002/ai-crm/api/sync/withdrawals \
  -H "Content-Type: application/json" \
  -d '{"fullSync": true}'
```

---

## 부록

### A. gRPC Proto Definition (ledger.proto)

```protobuf
syntax = "proto3";
package matchtrader.ledger;

service LedgerHistoryService {
  rpc getLedgersStreamByGroupsOrLogins(LedgerStreamRequest) returns (stream LedgerEntry);
}

message LedgerStreamRequest {
  repeated string logins = 1;
  repeated string groups = 2;
  repeated HistoryOperationType operationTypes = 3;
}

message LedgerEntry {
  string uuid = 1;
  string accountUuid = 2;
  string login = 3;
  double amount = 4;
  double netAmount = 5;
  string currency = 6;
  HistoryOperationType operationType = 7;
  string status = 8;
  string paymentGatewayUuid = 9;
  string paymentGatewayName = 10;
  string walletAddress = 11;
  string reference = 12;
  string paymentId = 13;
  string partnerId = 14;
  int64 createdAt = 15;
  string accountEmail = 16;
  string accountName = 17;
  string accountSurname = 18;
}

enum HistoryOperationType {
  UNKNOWN = 0;
  DEPOSIT = 1;
  WITHDRAW = 2;
  INTERNAL_TRANSFER = 3;
  CREDIT = 4;
  BONUS = 5;
  COMMISSION = 6;
  SWAP = 7;
  DIVIDEND = 8;
  ROLLOVER = 9;
  CORRECTION = 10;
}
```

### B. Match-Trade API Status Codes

**입출금 상태:**
- `NEW`: 신규 요청
- `PROCESSING`: 처리 중
- `AWAITING_CONFIRMATION`: 확인 대기
- `ADMIN_CONFIRMATION`: 관리자 확인 대기
- `DONE`: 완료
- `FULLY_PAID`: 전액 지급
- `REJECTED`: 거부
- `CANCELLED_BY_USER`: 사용자 취소

### C. 연락처

- **개발**: Claude Code Agent
- **Mission ID**: MISSION-20251229-0001
- **생성일**: 2025-12-29

---

> **Note**: 이 문서는 2025-12-29 기준 최신 상태입니다. 변경사항 발생 시 업데이트가 필요합니다.
