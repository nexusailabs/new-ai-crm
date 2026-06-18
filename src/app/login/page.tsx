"use client";

/**
 * Login Page
 * Updated: 2025-12-29 - i18n support (MISSION-20251229-1847)
 */

import { useState, FormEvent, useEffect, ReactElement } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/stores/i18nStore";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { KeyRound, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage(): ReactElement {
  const router = useRouter();
  const { login, isAuthenticated, error, setError, clearError } = useAuthStore();
  const { t } = useTranslation();
  const [token, setToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/customers");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearError();

    if (!token.trim()) {
      setError(t("auth.pleaseEnterToken"));
      return;
    }

    setIsLoading(true);

    try {
      // Simple token validation - just check it's not empty
      // In production, you might want to make a test API call
      login({ token: token.trim() });
      router.push("/customers");
    } catch {
      setError(t("auth.authFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
      </div>

      <GlassCard variant="light" padding="xl" className="w-full max-w-md relative z-10">
        {/* Language Selector - Top Right */}
        <div className="absolute top-4 right-4">
          <LanguageSelector variant="compact" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t("auth.welcomeBack")}
          </h1>
          <p className="text-white/60">
            {t("auth.enterToken")}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label={t("auth.apiToken")}
            type="password"
            placeholder={t("auth.enterBearerToken")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            icon={<KeyRound className="w-4 h-4" />}
            autoComplete="off"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            rightIcon={<LogIn className="w-4 h-4" />}
          >
            {t("auth.signIn")}
          </Button>
        </form>

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-sm text-white/40 text-center">
            {t("auth.getToken")}
            <br />
            {t("auth.contactAdmin")}
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
