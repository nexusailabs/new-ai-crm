/**
 * i18n Store - Internationalization State Management
 * Zustand store for managing language state with localStorage persistence
 * Created: 2025-12-29
 * Mission: MISSION-20251229-1847
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type Language = "en" | "ko";

export interface TranslationKeys {
  // Common
  common: {
    loading: string;
    error: string;
    retry: string;
    refresh: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    view: string;
    search: string;
    filter: string;
    all: string;
    none: string;
    yes: string;
    no: string;
    ok: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    clear: string;
    sync: string;
    online: string;
    offline: string;
    live: string;
    actions: string;
    processed: string;
  };

  // Navigation / Sidebar
  nav: {
    main: string;
    dashboard: string;
    customers: string;
    trading: string;
    monitoring: string;
    monitor: string;
    deposits: string;
    withdrawals: string;
    analytics: string;
    reports: string;
    settings: string;
    signOut: string;
    collapse: string;
    signedInAs: string;
    tradingPlatform: string;
  };

  // Auth / Login
  auth: {
    welcomeBack: string;
    enterToken: string;
    apiToken: string;
    enterBearerToken: string;
    signIn: string;
    pleaseEnterToken: string;
    authFailed: string;
    getToken: string;
    contactAdmin: string;
  };

  // Status Labels
  status: {
    pending: string;
    approved: string;
    rejected: string;
    new: string;
    verified: string;
    blocked: string;
    unverified: string;
    pendingVerification: string;
  };

  // Customers Page
  customers: {
    title: string;
    subtitle: string;
    totalCustomers: string;
    totalBalance: string;
    registered: string;
    customer: string;
    type: string;
    accounts: string;
    balance: string;
    location: string;
    failedToLoad: string;
    loadingCustomers: string;
    noCustomersFound: string;
    searchPlaceholder: string;
    allTypes: string;
    allStatuses: string;
  };

  // Customer Types
  customerTypes: {
    retail: string;
    professional: string;
    experienced: string;
  };

  // Deposits Page
  deposits: {
    title: string;
    subtitle: string;
    totalAmount: string;
    totalCount: string;
    depositTransactions: string;
    loadingDeposits: string;
    noDepositsFound: string;
    failedToLoad: string;
    searchPlaceholder: string;
    dateId: string;
    amount: string;
  };

  // Withdrawals Page
  withdrawals: {
    title: string;
    subtitle: string;
    totalVolume: string;
    pendingReview: string;
    processedToday: string;
    reqs: string;
    userProfile: string;
    accountHealth: string;
    equity: string;
    openOps: string;
    orders: string;
    loadingWithdrawals: string;
    noWithdrawalsFound: string;
    failedToLoad: string;
    searchPlaceholder: string;
    approveWithdrawal: string;
    rejectWithdrawal: string;
  };

  // Payment Common
  payment: {
    method: string;
    time: string;
    amount: string;
    currency: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    approve: string;
    reject: string;
    allMethods: string;
  };

  // Data Source
  dataSource: {
    hybrid: string;
    cache: string;
    api: string;
    unknown: string;
    dbCount: string;
    deltaCount: string;
  };

  // Settings
  settings: {
    title: string;
    language: string;
    selectLanguage: string;
    korean: string;
    english: string;
  };

  // Monitoring
  monitoring: {
    title: string;
    subtitle: string;
  };

  // Analytics
  analyticsPage: {
    title: string;
    subtitle: string;
  };

  // Reports
  reportsPage: {
    title: string;
    subtitle: string;
  };

  // Table
  table: {
    rowsPerPage: string;
    of: string;
    noData: string;
    sortAsc: string;
    sortDesc: string;
  };
}

export interface I18nState {
  language: Language;
  translations: Record<Language, TranslationKeys>;
}

export interface I18nActions {
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export type I18nStore = I18nState & I18nActions;

// ============================================================================
// Translation Data
// ============================================================================

const translations: Record<Language, TranslationKeys> = {
  en: {
    common: {
      loading: "Loading...",
      error: "Error",
      retry: "Retry",
      refresh: "Refresh",
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      delete: "Delete",
      edit: "Edit",
      view: "View",
      search: "Search",
      filter: "Filter",
      all: "All",
      none: "None",
      yes: "Yes",
      no: "No",
      ok: "OK",
      close: "Close",
      back: "Back",
      next: "Next",
      previous: "Previous",
      submit: "Submit",
      reset: "Reset",
      clear: "Clear",
      sync: "Sync",
      online: "Online",
      offline: "Offline",
      live: "Live",
      actions: "Actions",
      processed: "Processed",
    },
    nav: {
      main: "Main",
      dashboard: "Dashboard",
      customers: "Customers",
      trading: "Trading",
      monitoring: "Monitoring",
      monitor: "Monitor",
      deposits: "Deposits",
      withdrawals: "Withdrawals",
      analytics: "Analytics",
      reports: "Reports",
      settings: "Settings",
      signOut: "Sign Out",
      collapse: "Collapse",
      signedInAs: "Signed in as",
      tradingPlatform: "Trading Platform",
    },
    auth: {
      welcomeBack: "Welcome Back",
      enterToken: "Enter your Match-Trade API token to continue",
      apiToken: "API Token",
      enterBearerToken: "Enter your Bearer token",
      signIn: "Sign In",
      pleaseEnterToken: "Please enter your API token",
      authFailed: "Failed to authenticate. Please check your token.",
      getToken: "Get your API token from the Match-Trade CRM system.",
      contactAdmin: "Contact your administrator for access.",
    },
    status: {
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      new: "New",
      verified: "Verified",
      blocked: "Blocked",
      unverified: "Unverified",
      pendingVerification: "Pending",
    },
    customers: {
      title: "Customers",
      subtitle: "Customer accounts and leads",
      totalCustomers: "Total Customers",
      totalBalance: "Total Balance",
      registered: "Registered",
      customer: "Customer",
      type: "Type",
      accounts: "Accounts",
      balance: "Balance",
      location: "Location",
      failedToLoad: "Failed to load customers",
      loadingCustomers: "Loading customers...",
      noCustomersFound: "No customers found",
      searchPlaceholder: "Search by name, email, UUID, location...",
      allTypes: "All types",
      allStatuses: "All statuses",
    },
    customerTypes: {
      retail: "Retail",
      professional: "Pro",
      experienced: "Exp",
    },
    deposits: {
      title: "Deposits",
      subtitle: "Real-time deposit monitoring",
      totalAmount: "Total Amount",
      totalCount: "Total Count",
      depositTransactions: "Deposit Transactions",
      loadingDeposits: "Loading deposits...",
      noDepositsFound: "No deposits found",
      failedToLoad: "Failed to load deposits",
      searchPlaceholder: "Search by name, email, UUID, amount...",
      dateId: "Date / ID",
      amount: "Amount",
    },
    withdrawals: {
      title: "Withdrawals",
      subtitle: "Global Transaction Monitoring",
      totalVolume: "Total Volume",
      pendingReview: "Pending Review",
      processedToday: "Processed Today",
      reqs: "reqs",
      userProfile: "User Profile",
      accountHealth: "Account Health",
      equity: "Equity",
      openOps: "Open Ops",
      orders: "orders",
      loadingWithdrawals: "Loading withdrawals...",
      noWithdrawalsFound: "No withdrawals found",
      failedToLoad: "Failed to load withdrawals",
      searchPlaceholder: "Search by name, email, UUID, amount...",
      approveWithdrawal: "Approve withdrawal",
      rejectWithdrawal: "Reject withdrawal",
    },
    payment: {
      method: "Method",
      time: "Time",
      amount: "Amount",
      currency: "Currency",
      justNow: "Just now",
      minutesAgo: "m ago",
      hoursAgo: "h ago",
      daysAgo: "d ago",
      approve: "Approve",
      reject: "Reject",
      allMethods: "All methods",
    },
    dataSource: {
      hybrid: "Hybrid",
      cache: "Cache",
      api: "API",
      unknown: "Unknown",
      dbCount: "DB",
      deltaCount: "Delta",
    },
    settings: {
      title: "Settings",
      language: "Language",
      selectLanguage: "Select Language",
      korean: "Korean",
      english: "English",
    },
    monitoring: {
      title: "Monitor",
      subtitle: "System monitoring dashboard",
    },
    analyticsPage: {
      title: "Analytics",
      subtitle: "Performance metrics and insights",
    },
    reportsPage: {
      title: "Reports",
      subtitle: "Financial and operational reports",
    },
    table: {
      rowsPerPage: "Rows per page",
      of: "of",
      noData: "No data available",
      sortAsc: "Sort ascending",
      sortDesc: "Sort descending",
    },
  },
  ko: {
    common: {
      loading: "로딩 중...",
      error: "오류",
      retry: "재시도",
      refresh: "새로고침",
      save: "저장",
      cancel: "취소",
      confirm: "확인",
      delete: "삭제",
      edit: "편집",
      view: "보기",
      search: "검색",
      filter: "필터",
      all: "전체",
      none: "없음",
      yes: "예",
      no: "아니오",
      ok: "확인",
      close: "닫기",
      back: "뒤로",
      next: "다음",
      previous: "이전",
      submit: "제출",
      reset: "초기화",
      clear: "지우기",
      sync: "동기화",
      online: "온라인",
      offline: "오프라인",
      live: "실시간",
      actions: "작업",
      processed: "처리됨",
    },
    nav: {
      main: "메인",
      dashboard: "대시보드",
      customers: "고객",
      trading: "거래",
      monitoring: "모니터링",
      monitor: "모니터",
      deposits: "입금",
      withdrawals: "출금",
      analytics: "분석",
      reports: "보고서",
      settings: "설정",
      signOut: "로그아웃",
      collapse: "접기",
      signedInAs: "로그인:",
      tradingPlatform: "거래 플랫폼",
    },
    auth: {
      welcomeBack: "다시 오셨군요",
      enterToken: "Match-Trade API 토큰을 입력해주세요",
      apiToken: "API 토큰",
      enterBearerToken: "Bearer 토큰 입력",
      signIn: "로그인",
      pleaseEnterToken: "API 토큰을 입력해주세요",
      authFailed: "인증에 실패했습니다. 토큰을 확인해주세요.",
      getToken: "Match-Trade CRM 시스템에서 API 토큰을 받으세요.",
      contactAdmin: "접근 권한은 관리자에게 문의하세요.",
    },
    status: {
      pending: "대기 중",
      approved: "승인됨",
      rejected: "거부됨",
      new: "신규",
      verified: "인증됨",
      blocked: "차단됨",
      unverified: "미인증",
      pendingVerification: "대기 중",
    },
    customers: {
      title: "고객",
      subtitle: "고객 계정 및 리드 관리",
      totalCustomers: "총 고객수",
      totalBalance: "총 잔액",
      registered: "등록일",
      customer: "고객",
      type: "유형",
      accounts: "계정",
      balance: "잔액",
      location: "위치",
      failedToLoad: "고객 정보를 불러오지 못했습니다",
      loadingCustomers: "고객 정보 로딩 중...",
      noCustomersFound: "고객을 찾을 수 없습니다",
      searchPlaceholder: "이름, 이메일, UUID, 위치로 검색...",
      allTypes: "모든 유형",
      allStatuses: "모든 상태",
    },
    customerTypes: {
      retail: "일반",
      professional: "전문가",
      experienced: "숙련",
    },
    deposits: {
      title: "입금",
      subtitle: "실시간 입금 모니터링",
      totalAmount: "총 금액",
      totalCount: "총 건수",
      depositTransactions: "입금 거래",
      loadingDeposits: "입금 정보 로딩 중...",
      noDepositsFound: "입금 내역이 없습니다",
      failedToLoad: "입금 정보를 불러오지 못했습니다",
      searchPlaceholder: "이름, 이메일, UUID, 금액으로 검색...",
      dateId: "날짜 / ID",
      amount: "금액",
    },
    withdrawals: {
      title: "출금",
      subtitle: "글로벌 거래 모니터링",
      totalVolume: "총 거래량",
      pendingReview: "검토 대기",
      processedToday: "오늘 처리",
      reqs: "건",
      userProfile: "사용자 프로필",
      accountHealth: "계정 상태",
      equity: "자본",
      openOps: "진행중 거래",
      orders: "건",
      loadingWithdrawals: "출금 정보 로딩 중...",
      noWithdrawalsFound: "출금 내역이 없습니다",
      failedToLoad: "출금 정보를 불러오지 못했습니다",
      searchPlaceholder: "이름, 이메일, UUID, 금액으로 검색...",
      approveWithdrawal: "출금 승인",
      rejectWithdrawal: "출금 거부",
    },
    payment: {
      method: "결제 방법",
      time: "시간",
      amount: "금액",
      currency: "통화",
      justNow: "방금",
      minutesAgo: "분 전",
      hoursAgo: "시간 전",
      daysAgo: "일 전",
      approve: "승인",
      reject: "거부",
      allMethods: "모든 방법",
    },
    dataSource: {
      hybrid: "하이브리드",
      cache: "캐시",
      api: "API",
      unknown: "알 수 없음",
      dbCount: "DB",
      deltaCount: "델타",
    },
    settings: {
      title: "설정",
      language: "언어",
      selectLanguage: "언어 선택",
      korean: "한국어",
      english: "영어",
    },
    monitoring: {
      title: "모니터",
      subtitle: "시스템 모니터링 대시보드",
    },
    analyticsPage: {
      title: "분석",
      subtitle: "성과 지표 및 인사이트",
    },
    reportsPage: {
      title: "보고서",
      subtitle: "재무 및 운영 보고서",
    },
    table: {
      rowsPerPage: "페이지당 행",
      of: "/",
      noData: "데이터 없음",
      sortAsc: "오름차순 정렬",
      sortDesc: "내림차순 정렬",
    },
  },
};

// ============================================================================
// Helper: Get nested translation value
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return key if not found
    }
  }

  return typeof current === "string" ? current : path;
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useI18nStore = create<I18nStore>()(
  persist(
    (set, get) => ({
      language: "en",
      translations,

      setLanguage: (lang: Language) => {
        set({ language: lang });
      },

      t: (key: string): string => {
        const { language, translations: trans } = get();
        return getNestedValue(trans[language] as unknown as Record<string, unknown>, key);
      },
    }),
    {
      name: "i18n-storage",
      partialize: (state) => ({ language: state.language }),
    }
  )
);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get translation function
 */
export function useTranslation() {
  const language = useI18nStore((state) => state.language);
  const t = useI18nStore((state) => state.t);
  const setLanguage = useI18nStore((state) => state.setLanguage);

  return { t, language, setLanguage };
}

/**
 * Hook to get current language
 */
export function useLanguage(): Language {
  return useI18nStore((state) => state.language);
}

/**
 * Hook to get all available translations for current language
 */
export function useTranslations(): TranslationKeys {
  const language = useI18nStore((state) => state.language);
  const translations = useI18nStore((state) => state.translations);
  return translations[language];
}

export default useI18nStore;
