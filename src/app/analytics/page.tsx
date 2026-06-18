"use client";

/**
 * Analytics Page (Placeholder)
 * Will display charts and analytics
 */

import { ReactElement } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { LineChart, BarChart3, PieChart, TrendingUp } from "lucide-react";

export default function AnalyticsPage(): ReactElement {
  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <LineChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Analytics</h1>
            <p className="text-white/60">
              Trading performance and customer insights
            </p>
          </div>
        </div>
      </header>

      {/* Coming Soon Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassCard hover padding="lg" className="flex flex-col items-center justify-center min-h-[200px]">
          <div className="p-4 rounded-2xl bg-violet-500/10 mb-4">
            <LineChart className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Revenue Trends
          </h3>
          <p className="text-white/40 text-sm text-center">
            Track revenue growth over time
          </p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs bg-violet-500/20 text-violet-400">
            Coming Soon
          </span>
        </GlassCard>

        <GlassCard hover padding="lg" className="flex flex-col items-center justify-center min-h-[200px]">
          <div className="p-4 rounded-2xl bg-sky-500/10 mb-4">
            <BarChart3 className="w-8 h-8 text-sky-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Customer Activity
          </h3>
          <p className="text-white/40 text-sm text-center">
            Monitor customer engagement metrics
          </p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs bg-sky-500/20 text-sky-400">
            Coming Soon
          </span>
        </GlassCard>

        <GlassCard hover padding="lg" className="flex flex-col items-center justify-center min-h-[200px]">
          <div className="p-4 rounded-2xl bg-emerald-500/10 mb-4">
            <PieChart className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Account Distribution
          </h3>
          <p className="text-white/40 text-sm text-center">
            Breakdown by account types
          </p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
            Coming Soon
          </span>
        </GlassCard>

        <GlassCard hover padding="lg" className="flex flex-col items-center justify-center min-h-[200px]">
          <div className="p-4 rounded-2xl bg-amber-500/10 mb-4">
            <TrendingUp className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Performance Metrics
          </h3>
          <p className="text-white/40 text-sm text-center">
            Key performance indicators
          </p>
          <span className="mt-4 px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
            Coming Soon
          </span>
        </GlassCard>
      </div>

      {/* Placeholder Note */}
      <GlassCard variant="dark" padding="lg" className="mt-8">
        <div className="text-center">
          <p className="text-white/60">
            Analytics features are under development. Check back soon for detailed
            charts and insights about your trading platform performance.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
