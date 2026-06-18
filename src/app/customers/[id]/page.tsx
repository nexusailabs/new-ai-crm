"use client";

import { useEffect, ReactElement } from "react";
import { useParams, useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useCustomerStore } from "@/stores/customerStore";
import type { Customer } from "@/types/customer";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  Shield,
  Globe,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { TradingAccountsSection } from "@/components/customer/TradingAccountsSection";

function getVerificationBadgeClass(status: string): string {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "PENDING_VERIFICATION":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "REJECTED":
    case "BLOCKED":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "NEW":
      return "bg-sky-500/20 text-sky-400 border-sky-500/30";
    default:
      return "bg-white/10 text-white/60 border-white/20";
  }
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface DetailRowProps {
  label: string;
  value: string | undefined | null;
  icon?: React.ReactNode;
}

function DetailRow({ label, value, icon }: DetailRowProps): ReactElement {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0">
      {icon && <div className="text-white/40 mt-0.5">{icon}</div>}
      <div className="flex-1">
        <p className="text-white/50 text-sm">{label}</p>
        <p className="text-white font-medium">{value || "-"}</p>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps): ReactElement {
  return (
    <GlassCard padding="lg" className="h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white/5 text-violet-400">{icon}</div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div>{children}</div>
    </GlassCard>
  );
}

export default function CustomerDetailPage(): ReactElement {
  const params = useParams();
  const router = useRouter();
  const { selectedCustomer, isLoading, error, fetchCustomerByUuid, clearError } =
    useCustomerStore();

  const customerId = params.id as string;

  useEffect(() => {
    if (customerId) {
      fetchCustomerByUuid(customerId);
    }
  }, [customerId, fetchCustomerByUuid]);

  const handleBack = (): void => {
    router.push("/customers");
  };

  const handleRetry = (): void => {
    clearError();
    if (customerId) {
      fetchCustomerByUuid(customerId);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <GlassCard padding="xl" className="text-center">
          <RefreshCw className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading customer details...</p>
        </GlassCard>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <GlassCard padding="xl" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Customer</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={handleBack}>
              Go Back
            </Button>
            <Button variant="primary" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // No Customer Found
  if (!selectedCustomer) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <GlassCard padding="xl" className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white/40" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Customer Not Found</h2>
          <p className="text-white/60 mb-6">
            The customer you are looking for does not exist or has been removed.
          </p>
          <Button variant="primary" onClick={handleBack}>
            Back to Customers
          </Button>
        </GlassCard>
      </div>
    );
  }

  const customer: Customer = selectedCustomer;

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="mb-4"
        >
          Back to Customers
        </Button>

        <GlassCard padding="lg">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
              {customer.personalDetails.firstname?.[0] || ""}
              {customer.personalDetails.lastname?.[0] || ""}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">
                    {customer.personalDetails.firstname} {customer.personalDetails.lastname}
                  </h1>
                  <p className="text-white/60">{customer.email}</p>
                </div>
                <span
                  className={`inline-flex px-4 py-2 rounded-xl text-sm font-medium border ${getVerificationBadgeClass(
                    customer.verificationStatus
                  )}`}
                >
                  {customer.verificationStatus.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center gap-6 mt-4 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {formatDate(customer.created)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Type: {customer.type}</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </header>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Details */}
        <Section title="Personal Details" icon={<User className="w-5 h-5" />}>
          <DetailRow
            label="First Name"
            value={customer.personalDetails.firstname}
            icon={<User className="w-4 h-4" />}
          />
          <DetailRow
            label="Last Name"
            value={customer.personalDetails.lastname}
            icon={<User className="w-4 h-4" />}
          />
          <DetailRow
            label="Date of Birth"
            value={formatDate(customer.personalDetails.dateOfBirth)}
            icon={<Calendar className="w-4 h-4" />}
          />
          <DetailRow
            label="Citizenship"
            value={customer.personalDetails.citizenship}
            icon={<Globe className="w-4 h-4" />}
          />
          <DetailRow
            label="Language"
            value={customer.personalDetails.language}
            icon={<Globe className="w-4 h-4" />}
          />
          {customer.personalDetails.passport && (
            <>
              <DetailRow
                label="Passport Number"
                value={customer.personalDetails.passport.number}
                icon={<CreditCard className="w-4 h-4" />}
              />
              <DetailRow
                label="Passport Country"
                value={customer.personalDetails.passport.country}
                icon={<Globe className="w-4 h-4" />}
              />
            </>
          )}
        </Section>

        {/* Contact Details */}
        <Section title="Contact Details" icon={<Phone className="w-5 h-5" />}>
          <DetailRow
            label="Email"
            value={customer.email}
            icon={<Mail className="w-4 h-4" />}
          />
          <DetailRow
            label="Phone Number"
            value={customer.contactDetails.phoneNumber}
            icon={<Phone className="w-4 h-4" />}
          />
          <DetailRow
            label="Alternative Phone"
            value={customer.contactDetails.alternativePhoneNumber}
            icon={<Phone className="w-4 h-4" />}
          />
          <DetailRow
            label="Fax Number"
            value={customer.contactDetails.faxNumber}
            icon={<Phone className="w-4 h-4" />}
          />
        </Section>

        {/* Address Details */}
        <Section title="Address Details" icon={<MapPin className="w-5 h-5" />}>
          <DetailRow
            label="Country"
            value={customer.addressDetails.country}
            icon={<Globe className="w-4 h-4" />}
          />
          <DetailRow
            label="State/Province"
            value={customer.addressDetails.state}
            icon={<MapPin className="w-4 h-4" />}
          />
          <DetailRow
            label="City"
            value={customer.addressDetails.city}
            icon={<Building2 className="w-4 h-4" />}
          />
          <DetailRow
            label="Post Code"
            value={customer.addressDetails.postCode}
            icon={<MapPin className="w-4 h-4" />}
          />
          <DetailRow
            label="Address"
            value={customer.addressDetails.address}
            icon={<MapPin className="w-4 h-4" />}
          />
        </Section>

        {/* Banking Details */}
        {customer.bankingDetails && (
          <Section title="Banking Details" icon={<CreditCard className="w-5 h-5" />}>
            <DetailRow
              label="Bank Name"
              value={customer.bankingDetails.bankName}
              icon={<Building2 className="w-4 h-4" />}
            />
            <DetailRow
              label="Account Name"
              value={customer.bankingDetails.accountName}
              icon={<User className="w-4 h-4" />}
            />
            <DetailRow
              label="Bank Account"
              value={customer.bankingDetails.bankAccount}
              icon={<CreditCard className="w-4 h-4" />}
            />
            <DetailRow
              label="Bank Address"
              value={customer.bankingDetails.bankAddress}
              icon={<MapPin className="w-4 h-4" />}
            />
            <DetailRow
              label="SWIFT Code"
              value={customer.bankingDetails.bankSwiftCode}
              icon={<CreditCard className="w-4 h-4" />}
            />
          </Section>
        )}

        {/* Trading Accounts Section */}
        <TradingAccountsSection tradingAccounts={customer.tradingAccounts} />
      </div>
    </div>
  );
}
