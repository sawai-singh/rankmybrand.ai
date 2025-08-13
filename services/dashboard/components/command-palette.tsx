"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Home,
  BarChart3,
  Bot,
  Settings,
  FileText,
  Download,
  RefreshCw,
  Zap,
  Users,
  Target,
  TrendingUp,
  AlertCircle,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  category: "navigation" | "actions" | "settings" | "insights";
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const items: CommandItem[] = [
    // Navigation
    {
      id: "home",
      label: "Go to Dashboard",
      shortcut: "⌘H",
      icon: <Home className="w-4 h-4" />,
      action: () => router.push("/"),
      category: "navigation",
    },
    {
      id: "analytics",
      label: "View Analytics",
      shortcut: "⌘A",
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => router.push("/analytics"),
      category: "navigation",
    },
    {
      id: "recommendations",
      label: "AI Recommendations",
      shortcut: "⌘R",
      icon: <Bot className="w-4 h-4" />,
      action: () => router.push("/recommendations"),
      category: "navigation",
    },
    // Actions
    {
      id: "refresh",
      label: "Refresh Data",
      shortcut: "⌘⇧R",
      icon: <RefreshCw className="w-4 h-4" />,
      action: () => window.location.reload(),
      category: "actions",
    },
    {
      id: "export",
      label: "Export Report",
      shortcut: "⌘E",
      icon: <Download className="w-4 h-4" />,
      action: () => console.log("Export"),
      category: "actions",
    },
    {
      id: "quick-action",
      label: "Execute Top Recommendation",
      icon: <Zap className="w-4 h-4" />,
      action: () => console.log("Execute"),
      category: "actions",
    },
    // Insights
    {
      id: "geo-score",
      label: "GEO Score: 87",
      icon: <Target className="w-4 h-4" />,
      action: () => router.push("/metrics/geo"),
      category: "insights",
    },
    {
      id: "trending",
      label: "Trending Topics",
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => router.push("/insights/trending"),
      category: "insights",
    },
    {
      id: "competitors",
      label: "Competitor Analysis",
      icon: <Users className="w-4 h-4" />,
      action: () => router.push("/competitors"),
      category: "insights",
    },
    // Settings
    {
      id: "settings",
      label: "Settings",
      shortcut: "⌘,",
      icon: <Settings className="w-4 h-4" />,
      action: () => router.push("/settings"),
      category: "settings",
    },
    {
      id: "theme-light",
      label: "Light Mode",
      icon: <Sun className="w-4 h-4" />,
      action: () => document.documentElement.classList.remove("dark"),
      category: "settings",
    },
    {
      id: "theme-dark",
      label: "Dark Mode",
      icon: <Moon className="w-4 h-4" />,
      action: () => document.documentElement.classList.add("dark"),
      category: "settings",
    },
  ];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glassmorphism glassmorphism-hover px-4 py-2 rounded-lg flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50"
            >
              <Command className="glassmorphism rounded-xl border border-white/20 shadow-2xl">
                <div className="flex items-center border-b border-white/10 px-4">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search for commands, pages, or actions..."
                    className="flex-1 bg-transparent py-4 px-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <Command.List className="max-h-96 overflow-y-auto p-2 custom-scrollbar">
                  <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </Command.Empty>

                  {Object.entries(groupedItems).map(([category, items]) => (
                    <Command.Group key={category} heading={category.charAt(0).toUpperCase() + category.slice(1)}>
                      {items.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={item.label}
                          onSelect={() => {
                            item.action();
                            setOpen(false);
                          }}
                          className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-white/10">
                              {item.icon}
                            </div>
                            <span className="text-sm">{item.label}</span>
                          </div>
                          {item.shortcut && (
                            <kbd className="text-xs text-muted-foreground bg-white/10 px-2 py-1 rounded">
                              {item.shortcut}
                            </kbd>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </Command.List>
              </Command>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}