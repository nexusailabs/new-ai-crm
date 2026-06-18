# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2025-12-29

### Added
- **gRPC Stream-based Payment Monitoring System**: Real-time deposit/withdrawal monitoring dashboard
  - New pages: `/deposits`, `/withdrawals`, `/monitoring`
  - gRPC stream simulation with mock data generator
  - Real-time activity feed with live event updates
  - KPI dashboard (Total Volume, Net Flow, Pending Actions, Success Rate)
  - Alerts section for critical events
  - Filtering and search functionality

### New Files
- `src/types/payment.ts` - Payment type definitions (DepositEvent, WithdrawalEvent, PaymentStats, etc.)
- `src/lib/mockPaymentData.ts` - Mock data generator for gRPC stream simulation
- `src/stores/paymentStore.ts` - Zustand store for payment state management
- `src/app/api/deposits/route.ts` - Deposits API endpoint
- `src/app/api/withdrawals/route.ts` - Withdrawals API endpoint
- `src/app/api/payments/activity/route.ts` - Payment activity stream endpoint
- `src/app/deposits/page.tsx` - Deposits monitoring page
- `src/app/withdrawals/page.tsx` - Withdrawals management page
- `src/app/monitoring/page.tsx` - Unified payment monitoring dashboard
- `src/components/payment/PaymentStatsCard.tsx` - Statistics card component
- `src/components/payment/PaymentTable.tsx` - Payment events table
- `src/components/payment/ActivityFeed.tsx` - Live activity feed component
- `src/components/payment/PaymentFilters.tsx` - Filter controls
- `src/components/payment/StreamIndicator.tsx` - Stream status indicator

### Changed
- `src/components/layout/Sidebar.tsx` - Added MONITORING section with Monitor, Deposits, Withdrawals links
- `src/types/index.ts` - Added payment type exports

### Technical Details
- Simulated gRPC streaming using interval-based mock data generation
- Zustand store for real-time state management
- Glassmorphism UI design with dark theme
- Responsive layout with TailwindCSS

### Production Deployment
- Successfully deployed to https://bkf.app/ai-crm
- All new routes verified working

## [0.2.0] - 2025-12-29

### Fixed
- **Trading Accounts toUpperCase Error**: Fixed TypeError when clicking on customer details
  - Added `normalizeAccount()` function in `TradingAccountsSection.tsx` to handle different API formats
  - Added null safety with `(type || "").toUpperCase()` for type/status badge rendering
  - File: `src/components/customer/TradingAccountsSection.tsx`

- **Trading Accounts Count Showing 0**: Fixed batch processing for large Supabase queries
  - Root cause: Supabase/PostgREST `.in()` query silently fails when given >200 items
  - Implemented batch processing with `BATCH_SIZE = 200` for trading accounts fetch
  - Applied fix to both large requests (>1000 items) and standard pagination
  - File: `src/app/api/customers/route.ts`

### Technical Details
- Before fix: 0 customers showed trading accounts, $0 total balance
- After fix: 2,803/3,498 customers show trading accounts, $33,176,488.64 total balance

### Mission Reference
- Mission ID: MISSION-20251228-L7WFOB
- Tasks: TASK-004 (AccountRow 공통화)

## [0.1.0] - 2025-12-28

### Added
- Initial release
- Customer list with virtual scrolling
- Customer detail page
- Trading accounts display
- Supabase integration
- Match-Trade API data sync
