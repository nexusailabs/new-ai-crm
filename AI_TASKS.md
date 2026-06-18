# AI-CRM 프로젝트 개선 태스크 명세서

> AI 에이전트가 자동으로 수행할 수 있는 태스크 문서
> 작성일: 2025-12-28
> 프로젝트: /home/kei/new-ai-crm

---

## 목차

1. [프로젝트 현황 분석](#1-프로젝트-현황-분석)
2. [식별된 문제점](#2-식별된-문제점)
3. [AI 태스크 명세](#3-ai-태스크-명세)
4. [실행 우선순위](#4-실행-우선순위)

---

## 1. 프로젝트 현황 분석

### 1.1 기술 스택

| 항목 | 버전/기술 |
|------|----------|
| Framework | Next.js 16.1.1 (App Router) |
| React | 19.2.3 |
| Language | TypeScript 5.x |
| State | Zustand 5.0.9 |
| Database | Supabase (로컬 OrbStack 127.0.0.1:54321) |
| UI | Tailwind CSS 4, Glassmorphism |
| External API | Match-Trade Broker API v1.25 |

### 1.2 현재 DB 스키마

**accounts 테이블** (Supabase - 3498 rows)
```sql
-- 실제 사용 중인 테이블
uuid, email, verification_status, personal_details (JSONB),
contact_details (JSONB), address_details (JSONB), lead_details (JSONB),
created, updated, synced_at
```

**customers 테이블** (타입 정의만 존재, 실제 미사용)
```sql
-- types/supabase.ts에 정의됨
id, email, tier, risk_score, full_name, phone, country, city,
kyc_status, kyc_level, status, ...
```

**trading_accounts 테이블** (미생성 상태)
```sql
-- types/supabase.ts에 정의만 존재
id, user_id (FK), balance, equity, margin_level, currency,
platform, platform_account_id, ...
```

### 1.3 API 엔드포인트 현황

| 엔드포인트 | 데이터 소스 | 상태 |
|------------|-------------|------|
| `/api/customers` | Supabase `accounts` | ✅ 정상 |
| `/api/customers/[id]` | Supabase `accounts` | ✅ 정상 |
| `/api/trading-accounts` | Match-Trade API (fallback: Demo) | ⚠️ Demo 모드 |
| `/api/trading-accounts/by-login` | Match-Trade API | ⚠️ 미테스트 |
| `/api/accounts` | Match-Trade API | ⚠️ 레거시 |

---

## 2. 식별된 문제점

### 2.1 Critical (즉시 해결 필요)

#### ISSUE-001: Trading Accounts 데이터 미연동
**현상**: 고객 상세 페이지에서 Trading Accounts가 항상 0개로 표시
**원인**:
1. `trading_accounts` Supabase 테이블 미생성
2. Match-Trade API → Supabase 동기화 스크립트 미구현
3. `/api/customers/[id]`에서 `tradingAccounts: []` 하드코딩

**영향 파일**:
- `src/app/api/customers/route.ts:71` - `tradingAccounts: []`
- `src/app/api/customers/[id]/route.ts:74` - `tradingAccounts: []`
- `src/components/customer/TradingAccountsSection.tsx`

#### ISSUE-002: 서버 자동 재시작 미설정
**현상**: 서버 재부팅 시 수동 시작 필요
**원인**: pm2/systemd 서비스 미등록

### 2.2 High (조속히 해결 필요)

#### ISSUE-003: API 엔드포인트 네이밍 혼란
**현상**: `/api/customers`가 `accounts` 테이블 조회
**원인**: 네이밍 불일치 - 직관성 저하

#### ISSUE-004: 타입 중복 정의
**현상**: TradingAccount 타입이 3곳에 정의됨
**파일**:
- `src/types/customer.ts:94-109` - TradingAccountLegacy (deprecated)
- `src/types/trading-account.ts:63-88` - TradingAccount (Match-Trade Full)
- `src/types/supabase.ts:68-88` - TradingAccount (Supabase schema)

#### ISSUE-005: AccountRow 타입 중복
**현상**: AccountRow가 2개 파일에 동일하게 정의됨
**파일**:
- `src/app/api/customers/route.ts:18-42`
- `src/app/api/customers/[id]/route.ts:18-42`

### 2.3 Medium (개선 필요)

#### ISSUE-006: 환경변수 문서 관리 개선
**현상**: HANDOVER.md의 환경변수 안내와 `.env.example` 분리 필요
**파일**: `/home/kei/new-ai-crm/HANDOVER.md`

#### ISSUE-007: Match-Trade API 키 미설정
**현상**: Demo 데이터만 반환됨
**파일**: `.env.local` - `MATCH_TRADE_API_KEY` 유효성 미확인

#### ISSUE-008: 고객 상세 페이지 Trading Accounts 미조회
**현상**: 고객 UUID로 trading accounts 조회 API 미호출
**파일**: `src/stores/customerStore.ts:131-164`

---

## 3. AI 태스크 명세

### TASK-001: Trading Accounts Supabase 테이블 생성

**목표**: Match-Trade API 스키마 기반 trading_accounts 테이블 생성

**입력 참조**:
- `/home/kei/match-trade-docs/output-v2/INTEGRATION_GUIDE.md`
- `/home/kei/new-ai-crm/src/types/trading-account.ts`

**실행 단계**:
```bash
# 1. Supabase migration 파일 생성
cd /home/kei/new-ai-crm

# 2. SQL 스키마 작성
cat > supabase/migrations/001_create_trading_accounts.sql << 'EOF'
-- Trading Accounts Table (Match-Trade API v1.25 기반)
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uuid TEXT UNIQUE NOT NULL,  -- Match-Trade UUID
  login TEXT NOT NULL,
  account_uuid TEXT NOT NULL REFERENCES accounts(uuid) ON DELETE CASCADE,

  -- Account Info
  offer_uuid TEXT,
  system_uuid TEXT,
  commission_uuid TEXT,
  "group" TEXT,
  leverage INTEGER DEFAULT 1,
  access TEXT DEFAULT 'FULL' CHECK (access IN ('FULL', 'CLOSE_ONLY', 'TRADING_DISABLED', 'TRADING_AND_LOGIN_DISABLED')),
  account_type TEXT DEFAULT 'DEMO' CHECK (account_type IN ('DEMO', 'REAL')),

  -- Finance Info (JSONB for flexibility)
  finance_info JSONB DEFAULT '{
    "balance": null,
    "equity": null,
    "profit": null,
    "netProfit": null,
    "margin": null,
    "freeMargin": null,
    "marginLevel": null,
    "credit": null,
    "currency": "USD",
    "currencyPrecision": 2
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ DEFAULT now(),

  -- Indexes
  CONSTRAINT trading_accounts_login_system_unique UNIQUE (login, system_uuid)
);

-- Indexes for performance
CREATE INDEX idx_trading_accounts_account_uuid ON trading_accounts(account_uuid);
CREATE INDEX idx_trading_accounts_login ON trading_accounts(login);
CREATE INDEX idx_trading_accounts_account_type ON trading_accounts(account_type);
CREATE INDEX idx_trading_accounts_synced_at ON trading_accounts(synced_at);

-- RLS Policies
ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for authenticated" ON trading_accounts FOR SELECT USING (true);
CREATE POLICY "Allow insert for service role" ON trading_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for service role" ON trading_accounts FOR UPDATE USING (true);
EOF

# 3. Supabase에 적용 (원격 서버에서)
ssh kei@neu.tplinkdns.com "
  cd ~/gudax-crm
  supabase db push
"
```

**검증**:
```sql
SELECT COUNT(*) FROM trading_accounts;
\d trading_accounts
```

---

### TASK-002: Match-Trade → Supabase 동기화 스크립트 작성

**목표**: Match-Trade API에서 trading accounts 가져와 Supabase에 저장

**생성 파일**: `/home/kei/new-ai-crm/scripts/sync-trading-accounts.ts`

**코드**:
```typescript
/**
 * Match-Trade Trading Accounts Sync Script
 * Usage: npx ts-node scripts/sync-trading-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';

const MATCH_TRADE_BASE_URL = process.env.MATCH_TRADE_BASE_URL || 'https://broker-api-gudax.match-trade.com';
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || '';
const MATCH_TRADE_BROKER_ID = process.env.MATCH_TRADE_BROKER_ID || '159';
const MATCH_TRADE_PARTNER_ID = process.env.MATCH_TRADE_PARTNER_ID || '159';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface MatchTradeTradingAccount {
  uuid: string;
  login: string;
  created: string;
  accountInfo: { uuid: string; email: string };
  offerUuid: string;
  systemUuid: string;
  commissionUuid: string | null;
  group: string;
  leverage: number;
  access: string;
  accountType: string;
  financeInfo: {
    balance: number | null;
    equity: number | null;
    profit: number | null;
    netProfit: number | null;
    margin: number | null;
    freeMargin: number | null;
    marginLevel: number | null;
    credit: number | null;
    currency: string;
    currencyPrecision: number;
  };
}

async function fetchTradingAccountsFromMatchTrade(page = 0, size = 100): Promise<MatchTradeTradingAccount[]> {
  const response = await fetch(
    `${MATCH_TRADE_BASE_URL}/v1/trading-accounts?page=${page}&size=${size}`,
    {
      headers: {
        'Authorization': `Bearer ${MATCH_TRADE_API_KEY}`,
        'X-Broker-Id': MATCH_TRADE_BROKER_ID,
        'X-Partner-Id': MATCH_TRADE_PARTNER_ID,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Match-Trade API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content || [];
}

async function syncTradingAccounts(): Promise<void> {
  console.log('[Sync] Starting trading accounts sync...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let page = 0;
  let totalSynced = 0;
  let hasMore = true;

  while (hasMore) {
    const accounts = await fetchTradingAccountsFromMatchTrade(page, 100);

    if (accounts.length === 0) {
      hasMore = false;
      break;
    }

    // Transform and upsert
    const records = accounts.map((acc) => ({
      uuid: acc.uuid,
      login: acc.login,
      account_uuid: acc.accountInfo.uuid,
      offer_uuid: acc.offerUuid,
      system_uuid: acc.systemUuid,
      commission_uuid: acc.commissionUuid,
      group: acc.group,
      leverage: acc.leverage,
      access: acc.access,
      account_type: acc.accountType,
      finance_info: acc.financeInfo,
      created_at: acc.created,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('trading_accounts')
      .upsert(records, { onConflict: 'uuid' });

    if (error) {
      console.error('[Sync] Upsert error:', error);
      throw error;
    }

    totalSynced += accounts.length;
    console.log(`[Sync] Page ${page}: synced ${accounts.length} accounts (total: ${totalSynced})`);

    page++;
    hasMore = accounts.length === 100;
  }

  console.log(`[Sync] Complete! Total synced: ${totalSynced}`);
}

syncTradingAccounts().catch(console.error);
```

**실행 방법**:
```bash
cd /home/kei/new-ai-crm
npm install -D ts-node
npx ts-node scripts/sync-trading-accounts.ts
```

---

### TASK-003: 고객 상세 API에 Trading Accounts 조인 추가

**목표**: `/api/customers/[id]`에서 trading_accounts 함께 반환

**수정 파일**: `/home/kei/new-ai-crm/src/app/api/customers/[id]/route.ts`

**변경 내용**:
```typescript
// 기존 코드 (line 74)
tradingAccounts: [], // Will be populated separately if needed

// 변경 후
// ... 기존 account 조회 후 ...

// Trading Accounts 조회 추가
const { data: tradingAccountsData } = await supabase
  .from("trading_accounts")
  .select("*")
  .eq("account_uuid", id);

// mapAccountToCustomer 함수에서 tradingAccounts 매핑
function mapAccountToCustomer(account: AccountRow, tradingAccounts: any[] = []): Customer {
  return {
    // ... 기존 필드들 ...
    tradingAccounts: tradingAccounts.map(ta => ({
      uuid: ta.uuid,
      login: ta.login,
      balance: ta.finance_info?.balance ?? 0,
      equity: ta.finance_info?.equity ?? 0,
      currency: ta.finance_info?.currency ?? 'USD',
      type: ta.account_type,
      status: ta.access === 'FULL' ? 'ACTIVE' : 'INACTIVE',
      created: ta.created_at,
    })),
  };
}
```

---

### TASK-004: AccountRow 타입 공통화

**목표**: 중복된 AccountRow 타입을 단일 파일로 통합

**생성 파일**: `/home/kei/new-ai-crm/src/types/account-row.ts`

**코드**:
```typescript
/**
 * Supabase accounts 테이블 Row 타입
 * API routes에서 공통 사용
 */
export interface AccountRow {
  uuid: string;
  email: string;
  verification_status: string;
  personal_details: {
    firstname?: string;
    lastname?: string;
    language?: string;
    dateOfBirth?: string;
  } | null;
  contact_details: {
    phoneNumber?: string;
  } | null;
  address_details: {
    country?: string;
    city?: string;
    address?: string;
  } | null;
  lead_details: {
    status?: string;
  } | null;
  created: string;
  updated: string;
  synced_at: string;
}

export interface TradingAccountRow {
  uuid: string;
  login: string;
  account_uuid: string;
  offer_uuid: string;
  system_uuid: string;
  commission_uuid: string | null;
  group: string;
  leverage: number;
  access: string;
  account_type: string;
  finance_info: {
    balance: number | null;
    equity: number | null;
    profit: number | null;
    netProfit: number | null;
    margin: number | null;
    freeMargin: number | null;
    marginLevel: number | null;
    credit: number | null;
    currency: string;
    currencyPrecision: number;
  };
  created_at: string;
  updated_at: string;
  synced_at: string;
}
```

**수정할 파일**:
- `src/app/api/customers/route.ts` - import 변경
- `src/app/api/customers/[id]/route.ts` - import 변경

---

### TASK-005: PM2 서비스 설정

**목표**: 서버 자동 재시작 및 프로세스 관리

**생성 파일**: `/home/kei/new-ai-crm/ecosystem.config.js`

**코드**:
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

**배포 스크립트**: `/home/kei/new-ai-crm/scripts/deploy.sh`
```bash
#!/bin/bash

# AI-CRM 배포 스크립트
set -e

PROJECT_DIR="/home/kei/new-ai-crm"
REMOTE_USER="kei"
REMOTE_HOST="neu.tplinkdns.com"
REMOTE_DIR="~/www/ai-crm"
SSH_OPTS="-o StrictHostKeyChecking=no"

echo "=== Building locally ==="
cd $PROJECT_DIR
npm run build

echo "=== Syncing to remote ==="
rsync -avz --delete --exclude 'node_modules' --exclude '.git' \
  -e "ssh $SSH_OPTS" \
  ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "=== Installing & Starting on remote ==="
ssh $SSH_OPTS $REMOTE_USER@$REMOTE_HOST "
  cd $REMOTE_DIR
  export PATH=/opt/homebrew/bin:\$PATH
  npm install --production
  pm2 restart ai-crm || pm2 start ecosystem.config.js
  pm2 save
"

echo "=== Deployment complete ==="
```

---

### TASK-006: 환경변수 문서 분리

**목표**: 민감 정보를 별도 파일로 분리

**생성 파일**: `/home/kei/new-ai-crm/.env.example`

**코드**:
```bash
# Match-Trade API Configuration
MATCH_TRADE_BASE_URL=https://broker-api-demo.match-trader.com
MATCH_TRADE_API_KEY=your-api-key-here
MATCH_TRADE_BROKER_ID=your-broker-id
MATCH_TRADE_PARTNER_ID=your-partner-id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**HANDOVER.md 수정**: 민감 정보 제거, `.env.example` 참조로 변경

---

### TASK-007: Trading Accounts API 연동 수정

**목표**: Demo 대신 실제 Supabase 데이터 조회

**수정 파일**: `/home/kei/new-ai-crm/src/app/api/trading-accounts/route.ts`

**변경 내용**:
```typescript
// 기존: Match-Trade API 직접 호출 (실패 시 Demo)
// 변경: Supabase trading_accounts 테이블 조회

import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountUuid = searchParams.get("accountUuid");
  const page = parseInt(searchParams.get("page") || "0");
  const size = parseInt(searchParams.get("size") || "10");

  const supabase = createServerClient();

  let query = supabase
    .from("trading_accounts")
    .select("*", { count: "exact" });

  if (accountUuid) {
    query = query.eq("account_uuid", accountUuid);
  }

  const from = page * size;
  const to = from + size - 1;

  const { data, error, count } = await query
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform to API response format
  const content = (data || []).map(transformToTradingAccount);

  return NextResponse.json({
    content,
    totalPages: Math.ceil((count || 0) / size),
    totalElements: count || 0,
    number: page,
    size,
  });
}
```

---

### TASK-008: Customer Store Trading Accounts 조회 추가

**목표**: 고객 상세 조회 시 Trading Accounts 함께 조회

**수정 파일**: `/home/kei/new-ai-crm/src/stores/customerStore.ts`

**변경 내용** (fetchCustomerByUuid 함수):
```typescript
fetchCustomerByUuid: async (uuid: string): Promise<void> => {
  set({ isLoading: true, error: null });

  try {
    // 고객 정보와 Trading Accounts 병렬 조회
    const [customerRes, tradingRes] = await Promise.all([
      fetch(`${BASE_PATH}/api/customers/${uuid}`),
      fetch(`${BASE_PATH}/api/trading-accounts?accountUuid=${uuid}`),
    ]);

    if (!customerRes.ok) {
      if (customerRes.status === 404) {
        set({ selectedCustomer: null, isLoading: false, error: "Customer not found" });
        return;
      }
      throw new Error(`API error: ${customerRes.status}`);
    }

    const customerData: Customer | { error: string } = await customerRes.json();
    const tradingData = tradingRes.ok ? await tradingRes.json() : { content: [] };

    if ("error" in customerData) {
      throw new Error(customerData.error);
    }

    // Trading Accounts 병합
    const customerWithTradingAccounts = {
      ...customerData,
      tradingAccounts: tradingData.content || [],
    };

    set({
      selectedCustomer: customerWithTradingAccounts,
      isLoading: false,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch customer";
    set({
      error: errorMessage,
      selectedCustomer: null,
      isLoading: false,
    });
  }
},
```

---

## 4. 실행 우선순위

### Phase 1: 핵심 기능 (즉시)

| 순서 | 태스크 | 예상 난이도 | 의존성 |
|------|--------|-------------|--------|
| 1 | TASK-001: DB 테이블 생성 | 중 | 없음 |
| 2 | TASK-002: 동기화 스크립트 | 중 | TASK-001 |
| 3 | TASK-003: API 조인 추가 | 저 | TASK-001 |
| 4 | TASK-007: API 연동 수정 | 중 | TASK-001 |
| 5 | TASK-008: Store 수정 | 저 | TASK-007 |

### Phase 2: 코드 품질 (다음)

| 순서 | 태스크 | 예상 난이도 | 의존성 |
|------|--------|-------------|--------|
| 6 | TASK-004: 타입 공통화 | 저 | 없음 |
| 7 | TASK-006: 환경변수 분리 | 저 | 없음 |

### Phase 3: 운영 안정성 (마지막)

| 순서 | 태스크 | 예상 난이도 | 의존성 |
|------|--------|-------------|--------|
| 8 | TASK-005: PM2 설정 | 저 | 없음 |

---

## 5. AI 에이전트 실행 명령

### 전체 자동 실행
```
프로젝트 /home/kei/new-ai-crm 의 AI_TASKS.md 문서를 읽고
Phase 1의 모든 태스크를 순서대로 실행하라.
각 태스크 완료 후 검증하고, 실패 시 롤백하라.
```

### 개별 태스크 실행
```
프로젝트 /home/kei/new-ai-crm 에서 TASK-001을 실행하라.
```

---

## 6. 검증 체크리스트

### TASK-001 검증
- [ ] `trading_accounts` 테이블이 Supabase에 생성됨
- [ ] 인덱스가 올바르게 생성됨
- [ ] RLS 정책이 활성화됨

### TASK-002 검증
- [ ] 동기화 스크립트가 오류 없이 실행됨
- [ ] trading_accounts에 데이터가 삽입됨
- [ ] account_uuid가 accounts 테이블과 매칭됨

### TASK-003 검증
- [ ] `/api/customers/{uuid}` 응답에 tradingAccounts 포함
- [ ] tradingAccounts 배열이 실제 데이터 반환

### Phase 1 전체 검증
```bash
# API 테스트
curl -s 'https://bkf.app/ai-crm/api/customers?size=1' | jq '.content[0].tradingAccounts'

# 고객 상세 테스트
curl -s 'https://bkf.app/ai-crm/api/customers/{고객UUID}' | jq '.tradingAccounts | length'
```

---

*AI 태스크 명세서 작성: Claude Code - 2025-12-28*
