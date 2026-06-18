"use client";

/**
 * Settings Page
 * Application settings and configuration
 * Updated: 2025-12-29 - i18n support (MISSION-20251229-1847)
 */

import { ReactElement, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/stores/i18nStore";
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Key,
  Save,
  Check,
  Globe,
} from "lucide-react";

export default function SettingsPage(): ReactElement {
  const { token, user } = useAuthStore();
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Mask the token for display
  const maskedToken = token
    ? `${token.slice(0, 8)}...${token.slice(-8)}`
    : "Not configured";

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{t("settings.title")}</h1>
            <p className="text-white/60">
              Manage your account and application settings
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Language Settings - NEW */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Globe className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">{t("settings.language")}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-3">
                  {t("settings.selectLanguage")}
                </label>
                <LanguageSelector variant="full" />
              </div>
            </div>
          </GlassCard>

          {/* Profile Settings */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <User className="w-5 h-5 text-sky-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Profile</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Input
                  label="Email"
                  type="email"
                  value={user?.email || "Not logged in"}
                  disabled
                />
              </div>
              <div>
                <Input
                  label="Display Name"
                  type="text"
                  value={user?.name || ""}
                  placeholder="Enter your name"
                  disabled
                />
              </div>
            </div>
          </GlassCard>

          {/* API Settings */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Key className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">API Configuration</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  API Token
                </label>
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-white/60 font-mono text-sm">
                    {maskedToken}
                  </code>
                  <Button variant="secondary" size="sm" disabled>
                    Update
                  </Button>
                </div>
                <p className="text-white/40 text-xs mt-2">
                  Your Match-Trade API token is securely stored
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Notification Settings */}
          <GlassCard padding="lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
            </div>

            <div className="space-y-4">
              {[
                { label: "Email notifications", description: "Receive email updates" },
                { label: "Trading alerts", description: "Get notified on important trades" },
                { label: "Customer updates", description: "New customer registrations" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                >
                  <div>
                    <p className="text-white font-medium">{item.label}</p>
                    <p className="text-white/40 text-sm">{item.description}</p>
                  </div>
                  <button
                    className="w-12 h-6 rounded-full bg-white/10 relative cursor-not-allowed"
                    disabled
                  >
                    <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/40 transition-all" />
                  </button>
                </div>
              ))}
              <p className="text-white/40 text-xs">
                Notification settings coming soon
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button
                variant="secondary"
                className="w-full justify-start"
                leftIcon={<Shield className="w-4 h-4" />}
                disabled
              >
                Security Settings
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                leftIcon={<Palette className="w-4 h-4" />}
                disabled
              >
                Theme Settings
              </Button>
            </div>
          </GlassCard>

          {/* Save Button */}
          <GlassCard padding="lg">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleSave}
              leftIcon={
                saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )
              }
              disabled
            >
              {saved ? "Saved!" : t("common.save")}
            </Button>
            <p className="text-white/40 text-xs text-center mt-3">
              Settings are automatically saved
            </p>
          </GlassCard>

          {/* App Info */}
          <GlassCard variant="dark" padding="lg">
            <h3 className="text-sm font-medium text-white/60 mb-3">
              Application Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Version</span>
                <span className="text-white/60">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Environment</span>
                <span className="text-white/60">Production</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">API</span>
                <span className="text-emerald-400">Connected</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
