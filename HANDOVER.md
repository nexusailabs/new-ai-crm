# AI-CRM 프로젝트 인수인계 문서

> **작성일**: 2025-12-28
> **프로젝트 경로**: `/home/kei/new-ai-crm`
> **Production URL**: https://bkf.app/ai-crm
> **basePath**: `/ai-crm`

---

## 1. 프로젝트 개요

Match-Trade Platform API 기반 금융 AI CRM 시스템. 고객(Account) 관리, Trading Accounts 조회, 자연어 명령 인터페이스를 제공합니다.

### 기술 스택

| 항목 | 기술 |
|------|------|
| Framework | Next.js 15.1.3 (App Router) |
| Language | TypeScript |
| State | Zustand |
| UI | Tailwind CSS, Glassmorphism, Lucide Icons |
| Database | Supabase (PostgreSQL on OrbStack) |
| Virtual Scroll | react-window |
| Deployment | Caddy reverse proxy |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Production                            │
│                   https://bkf.app/ai-crm                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caddy (Reverse Proxy)                     │
│                      neu.tplinkdns.com                       │
│              /ai-crm* → localhost:3002                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Next.js Server (PORT=3002)                     │
│                   ~/www/ai-crm                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   API Routes                         │    │
│  │  /api/customers      → Supabase 'accounts' 테이블   │    │
│  │  /api/customers/[id] → Supabase 'customers' 테이블  │    │
│  │  /api/trading-accounts → Match-Trade API            │    │
│  │  /api/accounts       → Match-Trade API (레거시)     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (OrbStack)                       │
│                   127.0.0.1:54321                            │
│                                                              │
│  Tables:                                                     │
│  - accounts (Match-Trade format, 3498 rows)                  │
│  - customers (추가 고객 정보)                                │
│  - trading_accounts (예정)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 주요 파일 구조

```
new-ai-crm/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── customers/
│   │   │   │   ├── route.ts          # GET /api/customers (accounts 테이블)
│   │   │   │   └── [id]/route.ts     # GET /api/customers/[id]
│   │   │   ├── trading-accounts/
│   │   │   │   ├── route.ts          # GET /api/trading-accounts
│   │   │   │   └── by-login/route.ts # GET /api/trading-accounts/by-login
│   │   │   └── accounts/             # 레거시 Match-Trade API
│   │   ├── customers/
│   │   │   ├── page.tsx              # 고객 목록 (Virtual Scroll)
│   │   │   └── [id]/page.tsx         # 고객 상세
│   │   └── layout.tsx
│   ├── components/
│   │   ├── CustomerList.tsx          # react-window 가상 스크롤
│   │   └── ui/                       # 공통 UI 컴포넌트
│   ├── stores/
│   │   └── customerStore.ts          # Zustand 고객 상태관리
│   ├── lib/
│   │   ├── supabase.ts               # Supabase 클라이언트
│   │   └── match-trade/              # Match-Trade API 클라이언트
│   └── types/
│       ├── index.ts                  # Customer, TradingAccount 타입
│       ├── supabase.ts               # Supabase 테이블 타입
│       └── trading-account.ts        # TradingAccount 상세 타입
├── next.config.ts                    # basePath: "/ai-crm"
├── .env.local                        # 환경변수
└── HANDOVER.md                       # 이 문서
```

---

## 4. 환경 변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Match-Trade API (선택)
MATCH_TRADE_API_URL=https://mtr-demo-prod.match-trader.com
```

---

## 5. 배포 방법

### 로컬 빌드 및 배포

```bash
# 1. 로컬에서 빌드
cd /home/kei/new-ai-crm
npm run build

# 2. 원격 서버로 배포
rsync -avz --delete --exclude 'node_modules' --exclude '.git' \
  -e "sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no" \
  ./ kei@neu.tplinkdns.com:~/www/ai-crm/

# 3. 원격 서버에서 의존성 설치 및 시작
sshpass -p "$REMOTE_PASS" ssh kei@neu.tplinkdns.com "
  cd ~/www/ai-crm && \
  export PATH=/opt/homebrew/bin:\$PATH && \
  npm install --production && \
  pkill -f 'next.*3002' 2>/dev/null; \
  PORT=3002 nohup npm run start > /tmp/ai-crm.log 2>&1 &
"
```

### 서버 정보

| 항목 | 값 |
|------|-----|
| 호스트 | kei@neu.tplinkdns.com |
| SSH password | <redacted> |
| 프로젝트 경로 | ~/www/ai-crm |
| 포트 | 3002 |
| Supabase | OrbStack (127.0.0.1:54321) |

---

## 6. 현재 상태 (2025-12-28)

### 완료된 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| 고객 목록 | ✅ | 3498명 전체 로딩, Virtual Scroll |
| 고객 검색 | ✅ | 이메일 기반 검색 |
| 고객 정렬 | ✅ | 모든 칼럼 정렬 가능 |
| Supabase 연동 | ✅ | accounts 테이블에서 조회 |
| basePath 적용 | ✅ | /ai-crm 경로 설정 |
| Production 배포 | ✅ | bkf.app/ai-crm 정상 작동 |

### 진행 중/남은 작업

| 작업 | 상태 | 설명 |
|------|------|------|
| Trading Accounts 연동 | 🔨 | API 라우트 생성됨, DB 스키마 필요 |
| 고객 상세 페이지 | ✅ | accounts 테이블 조회로 수정 완료 |
| Trading Accounts 칼럼 | ⚠️ | 현재 0으로 표시됨 |

---

## 7. 알려진 이슈

### 1. ~~고객 상세 페이지 404~~ ✅ 해결됨 (2025-12-28)

**문제**: `/api/customers/[id]`가 `customers` 테이블을 조회하는데, 실제 데이터는 `accounts` 테이블에 있음

**해결**: `[id]/route.ts`를 `accounts` 테이블 조회로 변경 완료

```typescript
// 수정 완료
.from("accounts")
.eq("uuid", id)
```

### 2. Trading Accounts가 0으로 표시

**원인**: accounts 테이블에 trading_accounts 정보가 없음

**해결 방안**:
1. trading_accounts 테이블 생성 (Match-Trade API 스키마 기반)
2. Match-Trade API에서 데이터 동기화
3. 고객별 trading accounts 조인 쿼리

### 3. 서버 재시작 시 수동 작업 필요

**해결 방안**: pm2 또는 systemd 서비스 등록

---

## 8. Match-Trade API 참조

**문서 위치**: `/home/kei/match-trade-docs/output-v2/INTEGRATION_GUIDE.md`

### Trading Accounts 스키마 (v1.25)

```typescript
interface TradingAccount {
  uuid: string;
  externalId: string;
  login: string;
  accountInfo: {
    offerUuid: string;
    offerName: string;
    currency: string;
    leverage: number;
    demo: boolean;
  };
  financeInfo: {
    balance: number | null;
    equity: number | null;
    margin: number | null;
    freeMargin: number | null;
    profit: number | null;
  };
  tradingApiToken: string;
  tradingApiDomain: string;
  system: {
    uuid: string;
    name: string;
  };
}
```

---

## 9. NEXUS 미션 이력

| Mission ID | 상태 | 내용 |
|------------|------|------|
| MISSION-20251228-153251 | ✅ QA PASS | Trading Accounts 타입 및 API 연동 |
| MISSION-20251228-143658 | ✅ 완료 | 전체 고객 로딩 (3498명) |
| MISSION-20251228-141232 | ✅ 완료 | Supabase 연결 문제 해결 |

---

## 10. 다음 단계 권장사항

### 우선순위 높음

1. **Trading Accounts DB 스키마 생성**
   - `/home/kei/match-trade-docs/output-v2/INTEGRATION_GUIDE.md` 참조
   - Supabase에 `trading_accounts` 테이블 생성
   - Match-Trade API 동기화 스크립트 작성

2. ~~**고객 상세 페이지 수정**~~ ✅ 완료
   - `/api/customers/[id]`를 `accounts` 테이블 조회로 변경 완료
   - Trading Accounts 조인 쿼리 추가 (별도 작업)

### 우선순위 중간

3. **서버 자동 재시작 설정**
   - pm2 또는 systemd 서비스 등록

4. **Match-Trade API 실시간 동기화**
   - 10초 단위 동기화 (sep-crm-v2 참조)

---

## 11. 관련 프로젝트 (참조용)

| 프로젝트 | 위치 | 설명 |
|----------|------|------|
| gudax-trade | 로컬 아카이브: `/home/kei/archives/gudax-trade-backup-20251228.tar.gz` | 멀티 계정 트레이딩 플랫폼 |
| Match-Trade Docs | `/home/kei/match-trade-docs/` | API 문서 |

---

## 12. 테스트 명령

```bash
# 프로덕션 API 테스트
curl -s 'https://bkf.app/ai-crm/api/customers?size=10' | jq '.content | length'

# 로컬 API 테스트 (원격 서버에서)
curl -s 'http://localhost:3002/ai-crm/api/customers?size=10' | jq '.content | length'

# Playwright 테스트
cd /home/kei/new-ai-crm
npx playwright test
```

---

*인수인계 문서 작성: Claude Code - 2025-12-28*
