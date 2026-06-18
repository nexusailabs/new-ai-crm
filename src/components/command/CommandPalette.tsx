"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Search, Home, Users, Settings, HelpCircle } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    {
      id: "go-home",
      label: "Go to Dashboard",
      description: "View main dashboard",
      icon: <Home className="w-5 h-5" />,
      action: () => router.push("/"),
      keywords: ["dashboard", "home", "overview"],
    },
    {
      id: "go-customers",
      label: "Go to Customers",
      description: "View customer list",
      icon: <Users className="w-5 h-5" />,
      action: () => router.push("/customers"),
      keywords: ["customers", "list", "accounts"],
    },
    {
      id: "go-settings",
      label: "Settings",
      description: "Configure application",
      icon: <Settings className="w-5 h-5" />,
      action: () => router.push("/settings"),
      keywords: ["settings", "config", "preferences"],
    },
    {
      id: "go-help",
      label: "Help & Support",
      description: "Get help and documentation",
      icon: <HelpCircle className="w-5 h-5" />,
      action: () => router.push("/help"),
      keywords: ["help", "support", "docs"],
    },
  ];

  const filteredCommands = commands.filter((command) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    return (
      command.label.toLowerCase().includes(lowerQuery) ||
      command.description?.toLowerCase().includes(lowerQuery) ||
      command.keywords?.some((k) => k.includes(lowerQuery))
    );
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          setIsOpen(false);
          setQuery("");
          setSelectedIndex(0);
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
            setQuery("");
            setSelectedIndex(0);
          }
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when query changes (using onChange callback instead of useEffect)
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setSelectedIndex(0);
  }, []);

  return (
    <>
      {/* Command Palette Trigger Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-white/50 text-sm hover:bg-white/10 hover:text-white/70 transition-all"
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">Cmd+K</kbd>
        </button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            {/* Command Palette Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
            >
              <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="p-4 border-b border-white/10">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Type a command or search..."
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    variant="search"
                    icon={<Search className="w-5 h-5" />}
                  />
                </div>

                {/* Command List */}
                <div className="max-h-80 overflow-y-auto">
                  {filteredCommands.length === 0 ? (
                    <div className="p-8 text-center text-white/40">
                      No commands found
                    </div>
                  ) : (
                    <ul className="p-2">
                      {filteredCommands.map((command, index) => (
                        <li key={command.id}>
                          <button
                            onClick={() => {
                              command.action();
                              setIsOpen(false);
                              setQuery("");
                            }}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`
                              w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150
                              ${index === selectedIndex ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5"}
                            `}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                index === selectedIndex
                                  ? "bg-sky-500/20 text-sky-400"
                                  : "bg-white/5 text-white/40"
                              }`}
                            >
                              {command.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{command.label}</p>
                              {command.description && (
                                <p className="text-sm text-white/40 truncate">
                                  {command.description}
                                </p>
                              )}
                            </div>
                            {index === selectedIndex && (
                              <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-white/50">
                                Enter
                              </kbd>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 flex items-center gap-4 text-xs text-white/30">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono">Esc</kbd> close
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono">Arrow</kbd> navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono">Enter</kbd> select
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
