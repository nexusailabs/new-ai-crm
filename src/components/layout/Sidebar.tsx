"use client";

/**
 * Navigation Sidebar Component
 * Glass morphism design with navigation links and logout
 * Updated: 2025-12-29 - i18n support (MISSION-20251229-1847)
 */

import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "@/stores/i18nStore";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import {
  LayoutDashboard,
  Users,
  LineChart,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    titleKey: "nav.main",
    items: [
      {
        labelKey: "nav.dashboard",
        href: "/",
        icon: <LayoutDashboard className="w-5 h-5" />,
      },
      {
        labelKey: "nav.customers",
        href: "/customers",
        icon: <Users className="w-5 h-5" />,
      },
      {
        labelKey: "nav.trading",
        href: "/trading",
        icon: <Wallet className="w-5 h-5" />,
      },
    ],
  },
  {
    titleKey: "nav.monitoring",
    items: [
      {
        labelKey: "nav.monitor",
        href: "/monitoring",
        icon: <Activity className="w-5 h-5" />,
      },
      {
        labelKey: "nav.deposits",
        href: "/deposits",
        icon: <ArrowDownRight className="w-5 h-5" />,
      },
      {
        labelKey: "nav.withdrawals",
        href: "/withdrawals",
        icon: <ArrowUpRight className="w-5 h-5" />,
      },
    ],
  },
  {
    titleKey: "nav.analytics",
    items: [
      {
        labelKey: "nav.analytics",
        href: "/analytics",
        icon: <LineChart className="w-5 h-5" />,
      },
      {
        labelKey: "nav.reports",
        href: "/reports",
        icon: <BarChart3 className="w-5 h-5" />,
      },
      {
        labelKey: "nav.settings",
        href: "/settings",
        icon: <Settings className="w-5 h-5" />,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "fixed left-0 top-0 h-screen z-40",
        "bg-white/5 backdrop-blur-xl border-r border-white/10",
        "flex flex-col",
        "transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-lg font-bold text-white">AI CRM</h1>
              <p className="text-xs text-white/50">{t("nav.tradingPlatform")}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.titleKey}>
            {/* Section Title */}
            {!isCollapsed && (
              <p className="px-4 mb-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                {t(section.titleKey)}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <motion.button
                    key={item.href}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
                      "transition-all duration-200",
                      "text-left",
                      isActive
                        ? "bg-gradient-to-r from-sky-500/20 to-violet-500/20 text-white border border-white/10"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    )}
                    whileHover={{ x: isCollapsed ? 0 : 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span
                      className={cn(
                        isActive ? "text-sky-400" : "text-white/60",
                        "transition-colors"
                      )}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="font-medium">{t(item.labelKey)}</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section & Logout */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {/* Language Selector */}
        {!isCollapsed && (
          <div className="px-2 py-2">
            <LanguageSelector variant="compact" className="w-full" />
          </div>
        )}

        {/* User Info */}
        {!isCollapsed && user && (
          <div className="px-4 py-2">
            <p className="text-sm text-white/60">{t("nav.signedInAs")}</p>
            <p className="text-sm text-white truncate">{user.email}</p>
          </div>
        )}

        {/* Logout Button */}
        <motion.button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
            "text-red-400 hover:bg-red-500/10",
            "transition-all duration-200"
          )}
          whileHover={{ x: isCollapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium">{t("nav.signOut")}</span>}
        </motion.button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl",
            "text-white/40 hover:text-white/60 hover:bg-white/5",
            "transition-all duration-200"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">{t("nav.collapse")}</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
