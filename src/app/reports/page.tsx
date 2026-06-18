"use client";

/**
 * Reports Page (Placeholder)
 * Will display downloadable reports
 */

import { ReactElement } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  Users,
  Wallet,
  FileSpreadsheet,
} from "lucide-react";

interface ReportItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const reports: ReportItem[] = [
  {
    title: "Customer Report",
    description: "Complete customer data export with contact information",
    icon: <Users className="w-6 h-6" />,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
  },
  {
    title: "Trading Activity",
    description: "All trading transactions and account movements",
    icon: <Wallet className="w-6 h-6" />,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    title: "Monthly Summary",
    description: "Monthly performance metrics and KPIs",
    icon: <Calendar className="w-6 h-6" />,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    title: "Financial Report",
    description: "Revenue, deposits, and withdrawal analysis",
    icon: <FileSpreadsheet className="w-6 h-6" />,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
];

export default function ReportsPage(): ReactElement {
  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-white/60">
              Generate and download platform reports
            </p>
          </div>
        </div>
      </header>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {reports.map((report) => (
          <GlassCard key={report.title} hover padding="lg">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${report.iconBg} ${report.iconColor}`}>
                {report.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {report.title}
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  {report.description}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  disabled
                >
                  Coming Soon
                </Button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Recent Reports */}
      <GlassCard padding="none">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white">Recent Reports</h2>
          <p className="text-white/60 text-sm mt-1">
            Previously generated reports
          </p>
        </div>

        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">No reports generated yet</p>
          <p className="text-white/40 text-sm mt-1">
            Generate a report to see it listed here
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
