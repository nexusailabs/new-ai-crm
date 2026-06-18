/**
 * Mock Payment Data Generator
 * Simulates gRPC stream events for deposits and withdrawals
 * Created: 2025-12-29
 */

import type {
  DepositEvent,
  WithdrawalEvent,
  PaymentEvent,
  PaymentStatus,
  PaymentStats,
} from "@/types/payment";

// ============================================================================
// Sample Data
// ============================================================================

const firstNames = [
  "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "William", "Sophia",
  "Oliver", "Isabella", "Benjamin", "Mia", "Elijah", "Charlotte", "Lucas",
  "Amelia", "Mason", "Harper", "Logan", "Evelyn", "Alexander", "Aria",
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
];

const currencies = ["USD", "EUR", "GBP", "JPY", "AUD"];
const paymentMethods = ["Bank Transfer", "Credit Card", "Crypto", "Wire Transfer", "E-Wallet"];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateEmail(firstName: string, lastName: string): string {
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "trading.com", "finance.net"];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomElement(domains)}`;
}

function generateAmount(isWithdrawal: boolean = false): number {
  // Deposits tend to be smaller and more frequent
  // Withdrawals tend to be larger but less frequent
  const min = isWithdrawal ? 500 : 100;
  const max = isWithdrawal ? 50000 : 25000;
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generateStatus(): PaymentStatus {
  const rand = Math.random();
  if (rand < 0.6) return "PENDING";
  if (rand < 0.9) return "APPROVED";
  return "REJECTED";
}

function generateTimestamp(hoursAgo: number = 0): string {
  const now = new Date();
  now.setHours(now.getHours() - hoursAgo);
  now.setMinutes(now.getMinutes() - Math.floor(Math.random() * 60));
  return now.toISOString();
}

// ============================================================================
// Generator Functions
// ============================================================================

export function generateDeposit(hoursAgo: number = 0): DepositEvent {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);

  return {
    uuid: generateUUID(),
    timestamp: generateTimestamp(hoursAgo),
    accountInfo: {
      uuid: generateUUID(),
      email: generateEmail(firstName, lastName),
      name: firstName,
      surname: lastName,
    },
    status: generateStatus(),
    amount: generateAmount(false),
    currency: randomElement(currencies),
    method: randomElement(paymentMethods),
    transactionId: `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  };
}

export function generateWithdrawal(hoursAgo: number = 0): WithdrawalEvent {
  const firstName = randomElement(firstNames);
  const lastName = randomElement(lastNames);

  return {
    uuid: generateUUID(),
    timestamp: generateTimestamp(hoursAgo),
    accountInfo: {
      uuid: generateUUID(),
      email: generateEmail(firstName, lastName),
      name: firstName,
      surname: lastName,
    },
    status: generateStatus(),
    amount: generateAmount(true),
    currency: randomElement(currencies),
    method: randomElement(paymentMethods),
    transactionId: `WDR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    bankInfo: {
      bankName: randomElement(["Chase Bank", "Bank of America", "Wells Fargo", "Citibank", "HSBC"]),
      accountNumber: `****${Math.floor(1000 + Math.random() * 9000)}`,
    },
  };
}

export function generatePaymentEvent(hoursAgo: number = 0): PaymentEvent {
  const isDeposit = Math.random() > 0.4; // 60% deposits, 40% withdrawals
  const event = isDeposit ? generateDeposit(hoursAgo) : generateWithdrawal(hoursAgo);

  return {
    uuid: event.uuid,
    type: isDeposit ? "DEPOSIT" : "WITHDRAWAL",
    timestamp: event.timestamp,
    accountInfo: event.accountInfo,
    status: event.status,
    amount: event.amount,
    currency: event.currency,
  };
}

// ============================================================================
// Batch Generators
// ============================================================================

export function generateDeposits(count: number): DepositEvent[] {
  const deposits: DepositEvent[] = [];
  for (let i = 0; i < count; i++) {
    // Spread events over the last 72 hours
    const hoursAgo = (i / count) * 72;
    deposits.push(generateDeposit(hoursAgo));
  }
  // Sort by timestamp descending (newest first)
  return deposits.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function generateWithdrawals(count: number): WithdrawalEvent[] {
  const withdrawals: WithdrawalEvent[] = [];
  for (let i = 0; i < count; i++) {
    const hoursAgo = (i / count) * 72;
    withdrawals.push(generateWithdrawal(hoursAgo));
  }
  return withdrawals.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function generateActivityFeed(count: number): PaymentEvent[] {
  const events: PaymentEvent[] = [];
  for (let i = 0; i < count; i++) {
    const hoursAgo = (i / count) * 24; // Last 24 hours for activity
    events.push(generatePaymentEvent(hoursAgo));
  }
  return events.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ============================================================================
// Statistics Calculator
// ============================================================================

export function calculateStats(events: (DepositEvent | WithdrawalEvent)[]): PaymentStats {
  const stats: PaymentStats = {
    totalAmount: 0,
    totalCount: events.length,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
  };

  events.forEach((event) => {
    stats.totalAmount += event.amount;

    switch (event.status) {
      case "PENDING":
        stats.pendingCount++;
        stats.pendingAmount += event.amount;
        break;
      case "APPROVED":
        stats.approvedCount++;
        stats.approvedAmount += event.amount;
        break;
      case "REJECTED":
        stats.rejectedCount++;
        stats.rejectedAmount += event.amount;
        break;
    }
  });

  return stats;
}

// ============================================================================
// Streaming Simulation
// ============================================================================

let streamInterval: NodeJS.Timeout | null = null;

export function startPaymentStream(
  onDeposit: (deposit: DepositEvent) => void,
  onWithdrawal: (withdrawal: WithdrawalEvent) => void,
  intervalMs: number = 3000
): void {
  if (streamInterval) {
    clearInterval(streamInterval);
  }

  streamInterval = setInterval(() => {
    // Random chance of new event
    if (Math.random() > 0.3) {
      if (Math.random() > 0.4) {
        onDeposit(generateDeposit(0));
      } else {
        onWithdrawal(generateWithdrawal(0));
      }
    }
  }, intervalMs);
}

export function stopPaymentStream(): void {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
}

// ============================================================================
// Initial Data (for page load)
// ============================================================================

export const initialDeposits = generateDeposits(50);
export const initialWithdrawals = generateWithdrawals(30);
export const initialActivityFeed = generateActivityFeed(20);
export const initialDepositStats = calculateStats(initialDeposits);
export const initialWithdrawalStats = calculateStats(initialWithdrawals);
