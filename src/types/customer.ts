/**
 * Customer (Account) Types for Match-Trade API
 * Based on Match-Trade Broker API v1.25
 */

export type VerificationStatus =
  | "NEW"
  | "REJECTED"
  | "VERIFIED"
  | "BLOCKED"
  | "PENDING_VERIFICATION"
  | "UNVERIFIED";

export type AccountType = "RETAIL" | "PROFESSIONAL" | "EXPERIENCED";

export type AccountFilterType = "CLIENT" | "LEAD" | "ALL";

export interface Passport {
  number: string;
  country: string;
}

export interface PersonalDetails {
  firstname: string;
  lastname: string;
  dateOfBirth?: string;
  citizenship?: string;
  language?: string;
  maritalStatus?: string;
  passport?: Passport;
  taxIdentificationNumber?: string;
}

export interface ToContact {
  toContactDate: string | null;
  alreadyContacted: boolean;
}

export interface ContactDetails {
  phoneNumber?: string;
  alternativePhoneNumber?: string;
  faxNumber?: string;
  toContact?: ToContact;
}

export interface AccountManager {
  uuid: string;
  email: string;
  name: string | null;
}

export interface CrmUserScope {
  branchScope: string[];
  managerPools: string[];
}

export interface AccountConfiguration {
  partnerId?: string | null;
  branchUuid?: string;
  roleUuid?: string;
  accountManager?: AccountManager;
  ibParentTradingAccountUuid?: string;
  crmUserScope?: CrmUserScope;
  accountTypeContact: boolean;
}

export interface AddressDetails {
  country?: string;
  state?: string;
  city?: string;
  postCode?: string;
  address?: string;
}

export interface BankingDetails {
  bankAddress?: string;
  bankSwiftCode?: string;
  bankAccount?: string;
  bankName?: string;
  accountName?: string;
}

export interface LeadDetails {
  statusUuid?: string;
  source?: string;
  providerUuid?: string | null;
  becomeActiveClientTime?: string;
}

/**
 * @deprecated Use TradingAccountSimple or TradingAccount from ./trading-account.ts
 * This type is kept for backward compatibility with existing code
 */
export interface TradingAccountLegacy {
  uuid: string;
  login: string;
  balance: number;
  equity: number;
  currency: string;
  type: string;
  status: string;
  created: string;
}

/**
 * Alias for backward compatibility
 * @deprecated Use TradingAccountSimple or TradingAccount from ./trading-account.ts
 */
export type TradingAccount = TradingAccountLegacy;

export interface Customer {
  uuid: string;
  created: string;
  updated: string;
  email: string;
  verificationStatus: VerificationStatus;
  type: AccountType;
  personalDetails: PersonalDetails;
  contactDetails: ContactDetails;
  accountConfiguration: AccountConfiguration;
  addressDetails: AddressDetails;
  bankingDetails?: BankingDetails;
  leadDetails?: LeadDetails;
  tradingAccounts?: TradingAccount[];
}

export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number | null;
  number: number | null;
  size: number;
}

export interface GetCustomersParams {
  query?: string;
  page?: number;
  size?: number;
  sort?: string;
  from?: string;
  to?: string;
  accountType?: AccountFilterType;
}

export interface CustomerState {
  customers: Customer[];
  selectedCustomer: Customer | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    size: number;
    totalPages: number;
    totalElements: number | null;
  };
}

export interface CustomerActions {
  fetchCustomers: (params?: GetCustomersParams) => Promise<void>;
  fetchAllCustomers: () => Promise<void>;
  fetchCustomerByUuid: (uuid: string) => Promise<void>;
  setSelectedCustomer: (customer: Customer | null) => void;
  clearError: () => void;
  reset: () => void;
}

export type CustomerStore = CustomerState & CustomerActions;
