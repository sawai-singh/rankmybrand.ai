"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HeroMetrics } from "@/components/hero-metrics";
import { CommandPalette } from "@/components/command-palette";
import { AIVisibilityHeatmap } from "@/components/ai-visibility-heatmap";
import { CompetitorLandscape3D } from "@/components/competitor-landscape-3d";
import { SmartRecommendations } from "@/components/smart-recommendations";
import { ActivityFeed } from "@/components/activity-feed";
import { Bell, Settings, Zap, RefreshCw, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add("dark");
    // Simulate initial data load
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setLastRefresh(new Date());
    setTimeout(() => setIsLoading(false), 1000);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your GEO insights...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 glassmorphism border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">RankMyBrand.ai</h1>
                  <p className="text-xs text-muted-foreground">GEO Dashboard</p>
                </div>
              </motion.div>
              <CommandPalette />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                className="p-2 rounded-lg glassmorphism glassmorphism-hover"
                title="Refresh data"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
              <button className="p-2 rounded-lg glassmorphism glassmorphism-hover relative">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </button>
              <button className="p-2 rounded-lg glassmorphism glassmorphism-hover">
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg glassmorphism glassmorphism-hover"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <div className="h-8 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                <div className="text-sm">
                  <p className="font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">Premium</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Metrics */}
        <section className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <h2 className="text-2xl font-bold mb-1">Overview</h2>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </motion.div>
          <HeroMetrics />
        </section>

        {/* AI Visibility & Competitor Landscape */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <AIVisibilityHeatmap />
          <CompetitorLandscape3D />
        </section>

        {/* Recommendations & Activity */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SmartRecommendations />
          </div>
          <div>
            <ActivityFeed />
          </div>
        </section>
      </main>
    </div>
  );
}
