"use client";

/**
 * Language Selector Component
 * Glassmorphism styled dropdown for language selection
 * Created: 2025-12-29
 * Mission: MISSION-20251229-1847
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation, type Language } from "@/stores/i18nStore";

interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷" },
];

interface LanguageSelectorProps {
  variant?: "compact" | "full";
  className?: string;
}

export function LanguageSelector({ variant = "compact", className }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find((l) => l.code === language) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  if (variant === "compact") {
    return (
      <div ref={dropdownRef} className={cn("relative", className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl",
            "bg-white/5 hover:bg-white/10",
            "border border-white/10 hover:border-white/20",
            "text-white/70 hover:text-white",
            "transition-all duration-200",
            "backdrop-blur-sm"
          )}
          aria-label={t("settings.selectLanguage")}
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-medium">{currentLanguage.flag}</span>
          <ChevronDown
            className={cn("w-3 h-3 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute right-0 mt-2 z-50",
                "w-44 py-2 rounded-xl",
                "bg-gray-900/90 backdrop-blur-xl",
                "border border-white/10",
                "shadow-2xl shadow-black/50"
              )}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-2.5",
                    "text-left transition-colors duration-150",
                    language === lang.code
                      ? "bg-sky-500/20 text-sky-400"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{lang.nativeLabel}</span>
                      {lang.code !== "en" && (
                        <span className="text-xs text-white/40">{lang.label}</span>
                      )}
                    </div>
                  </div>
                  {language === lang.code && <Check className="w-4 h-4 text-sky-400" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full variant for settings page
  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl",
          "bg-white/5 hover:bg-white/10",
          "border border-white/10 hover:border-white/20",
          "text-white transition-all duration-200",
          "backdrop-blur-sm"
        )}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-white/60" />
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">{t("settings.language")}</span>
            <span className="text-xs text-white/50">{currentLanguage.nativeLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentLanguage.flag}</span>
          <ChevronDown
            className={cn("w-4 h-4 text-white/60 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute left-0 right-0 mt-2 z-50",
              "py-2 rounded-xl",
              "bg-gray-900/95 backdrop-blur-xl",
              "border border-white/10",
              "shadow-2xl shadow-black/50"
            )}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-3",
                  "text-left transition-colors duration-150",
                  language === lang.code
                    ? "bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{lang.nativeLabel}</span>
                    <span className="text-xs text-white/40">{lang.label}</span>
                  </div>
                </div>
                {language === lang.code && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-sky-400">{t("common.ok")}</span>
                    <Check className="w-5 h-5 text-sky-400" />
                  </div>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LanguageSelector;
