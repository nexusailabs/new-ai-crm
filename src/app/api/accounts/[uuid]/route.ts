/**
 * API Route: /api/accounts/[uuid]
 * Backend Proxy for single account lookup from Match-Trade API
 *
 * Updated: 2025-12-28
 * Mission: MISSION-20251228-143658-FIX2
 */

import { NextRequest, NextResponse } from "next/server";
import type { Customer } from "@/types";

// ============================================================================
// Environment Configuration
// ============================================================================

const MATCH_TRADE_BASE_URL =
  process.env.MATCH_TRADE_BASE_URL || "https://broker-api-gudax.match-trade.com";
const MATCH_TRADE_API_KEY = process.env.MATCH_TRADE_API_KEY || "";
const MATCH_TRADE_BROKER_ID = process.env.MATCH_TRADE_BROKER_ID || "159";
const MATCH_TRADE_PARTNER_ID = process.env.MATCH_TRADE_PARTNER_ID || "159";

/**
 * Check if Match-Trade API is properly configured
 */
function isMatchTradeConfigured(): boolean {
  return !!(
    MATCH_TRADE_BASE_URL &&
    MATCH_TRADE_API_KEY &&
    MATCH_TRADE_API_KEY.length > 0
  );
}

interface MatchTradeAccount {
  uuid?: string;
  email?: string;
  created?: string;
  updated?: string;
  verificationStatus?: string;
  type?: string;
  personalDetails?: {
    firstname?: string;
    lastname?: string;
    dateOfBirth?: string;
    citizenship?: string;
    language?: string;
    maritalStatus?: string;
    passport?: {
      number?: string;
      country?: string;
    };
    taxIdentificationNumber?: string;
  };
  contactDetails?: {
    phoneNumber?: string;
    alternativePhoneNumber?: string;
    faxNumber?: string;
    toContact?: {
      toContactDate: string | null;
      alreadyContacted: boolean;
    };
  };
  accountConfiguration?: {
    partnerId?: string | null;
    branchUuid?: string;
    roleUuid?: string;
    accountManager?: {
      uuid: string;
      email: string;
      name: string | null;
    };
    ibParentTradingAccountUuid?: string;
    crmUserScope?: {
      branchScope: string[];
      managerPools: string[];
    };
    accountTypeContact?: boolean;
  };
  addressDetails?: {
    country?: string;
    state?: string;
    city?: string;
    postCode?: string;
    address?: string;
  };
  bankingDetails?: {
    bankAddress?: string;
    bankSwiftCode?: string;
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
  };
  leadDetails?: {
    statusUuid?: string;
    source?: string;
    providerUuid?: string | null;
    becomeActiveClientTime?: string;
  };
}

function transformToCustomer(account: MatchTradeAccount): Customer {
  return {
    uuid: account.uuid || crypto.randomUUID(),
    created: account.created || new Date().toISOString(),
    updated: account.updated || new Date().toISOString(),
    email: account.email || "N/A",
    verificationStatus:
      (account.verificationStatus as Customer["verificationStatus"]) || "NEW",
    type: (account.type as Customer["type"]) || "RETAIL",
    personalDetails: {
      firstname: account.personalDetails?.firstname || "Unknown",
      lastname: account.personalDetails?.lastname || "",
      dateOfBirth: account.personalDetails?.dateOfBirth,
      citizenship: account.personalDetails?.citizenship,
      language: account.personalDetails?.language,
      maritalStatus: account.personalDetails?.maritalStatus,
      passport:
        account.personalDetails?.passport?.number &&
        account.personalDetails?.passport?.country
          ? {
              number: account.personalDetails.passport.number,
              country: account.personalDetails.passport.country,
            }
          : undefined,
      taxIdentificationNumber: account.personalDetails?.taxIdentificationNumber,
    },
    contactDetails: {
      phoneNumber: account.contactDetails?.phoneNumber,
      alternativePhoneNumber: account.contactDetails?.alternativePhoneNumber,
      faxNumber: account.contactDetails?.faxNumber,
      toContact: account.contactDetails?.toContact,
    },
    accountConfiguration: {
      partnerId: account.accountConfiguration?.partnerId,
      branchUuid: account.accountConfiguration?.branchUuid,
      roleUuid: account.accountConfiguration?.roleUuid,
      accountManager: account.accountConfiguration?.accountManager,
      ibParentTradingAccountUuid:
        account.accountConfiguration?.ibParentTradingAccountUuid,
      crmUserScope: account.accountConfiguration?.crmUserScope,
      accountTypeContact:
        account.accountConfiguration?.accountTypeContact ?? false,
    },
    addressDetails: {
      country: account.addressDetails?.country,
      state: account.addressDetails?.state,
      city: account.addressDetails?.city,
      postCode: account.addressDetails?.postCode,
      address: account.addressDetails?.address,
    },
    bankingDetails: account.bankingDetails,
    leadDetails: account.leadDetails,
  };
}

function getDemoCustomerByUuid(uuid: string): Customer | null {
  const demoCustomers: Record<string, Customer> = {
    "demo-1": {
      uuid: "demo-1",
      created: "2024-01-15T10:30:00Z",
      updated: "2024-12-27T08:15:00Z",
      email: "john.doe@example.com",
      verificationStatus: "VERIFIED",
      type: "RETAIL",
      personalDetails: {
        firstname: "John",
        lastname: "Doe",
        dateOfBirth: "1985-03-15",
        citizenship: "US",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+1-555-0101",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "United States",
        city: "New York",
        state: "NY",
      },
    },
    "demo-2": {
      uuid: "demo-2",
      created: "2024-02-20T14:45:00Z",
      updated: "2024-12-26T16:30:00Z",
      email: "jane.smith@example.com",
      verificationStatus: "VERIFIED",
      type: "PROFESSIONAL",
      personalDetails: {
        firstname: "Jane",
        lastname: "Smith",
        dateOfBirth: "1990-07-22",
        citizenship: "GB",
        language: "en",
      },
      contactDetails: {
        phoneNumber: "+44-20-7946-0958",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "United Kingdom",
        city: "London",
      },
    },
    "demo-3": {
      uuid: "demo-3",
      created: "2024-03-10T09:00:00Z",
      updated: "2024-12-27T10:00:00Z",
      email: "hans.mueller@example.de",
      verificationStatus: "VERIFIED",
      type: "EXPERIENCED",
      personalDetails: {
        firstname: "Hans",
        lastname: "Mueller",
        dateOfBirth: "1978-11-08",
        citizenship: "DE",
        language: "de",
      },
      contactDetails: {
        phoneNumber: "+49-30-12345678",
      },
      accountConfiguration: {
        accountTypeContact: false,
      },
      addressDetails: {
        country: "Germany",
        city: "Berlin",
      },
    },
  };

  return demoCustomers[uuid] || null;
}

interface RouteContext {
  params: Promise<{ uuid: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<Customer | { error: string }>> {
  const { uuid } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isDemoId = uuid.startsWith("demo-");

  if (!isDemoId && !uuidRegex.test(uuid)) {
    return NextResponse.json(
      { error: "Invalid account UUID format" },
      { status: 400 }
    );
  }

  // Return demo data for demo IDs or if API not configured
  if (isDemoId || !isMatchTradeConfigured()) {
    const demoCustomer = getDemoCustomerByUuid(uuid);
    if (demoCustomer) {
      return NextResponse.json(demoCustomer);
    }
    return NextResponse.json(
      { error: `Account not found: ${uuid}` },
      { status: 404 }
    );
  }

  try {
    const response = await fetch(
      `${MATCH_TRADE_BASE_URL}/v1/accounts/by-uuid/${uuid}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MATCH_TRADE_API_KEY}`,
          "X-Broker-Id": MATCH_TRADE_BROKER_ID,
          "X-Partner-Id": MATCH_TRADE_PARTNER_ID,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Match-Trade API error:", response.status, errorText);

      // Try to return demo data if API fails
      const demoCustomer = getDemoCustomerByUuid(uuid);
      if (demoCustomer) {
        return NextResponse.json(demoCustomer);
      }

      return NextResponse.json(
        { error: `Account not found: ${uuid}` },
        { status: 404 }
      );
    }

    const data: MatchTradeAccount = await response.json();
    const customer = transformToCustomer(data);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to fetch account:", error);

    // Try to return demo data on error
    const demoCustomer = getDemoCustomerByUuid(uuid);
    if (demoCustomer) {
      return NextResponse.json(demoCustomer);
    }

    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}
