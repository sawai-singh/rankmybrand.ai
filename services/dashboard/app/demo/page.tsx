"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { HeroMetrics } from "@/components/hero-metrics";
import { CommandPalette } from "@/components/command-palette";
import { AIVisibilityHeatmap } from "@/components/ai-visibility-heatmap";
import { CompetitorLandscape3D } from "@/components/competitor-landscape-3d";
import { SmartRecommendations } from "@/components/smart-recommendations";
import { ActivityFeed } from "@/components/activity-feed";
import { WelcomeModal } from "@/components/welcome-modal";
import { Bell, Settings, Zap, RefreshCw, Moon, Sun, User, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export default function DemoDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [darkMode, setDarkMode] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const searchParams = useSearchParams();
  const isNewUser = searchParams.get('onboarding') === 'complete';

  // Get user data from localStorage (set during onboarding)
  const userData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const userEmail = userData.email || 'demo@company.com';
  const companyName = userData.company || 'Your Company';

  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add("dark");
    
    // Show welcome modal for new users
    if (isNewUser) {
      setShowWelcome(true);
      // Remove query param
      window.history.replaceState({}, '', '/demo');
    }
  }, [isNewUser]);

  const handleRefresh = () => {
    setIsLoading(true);
    setLastRefresh(new Date());
    setTimeout(() => setIsLoading(false), 1500);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 transition-colors duration-500">
      {/* Welcome Modal */}
      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
      
      {/* Command Palette */}
      <CommandPalette />
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <motion.div 
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    RankMyBrand.ai
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">AI Visibility Dashboard</p>
                </div>
              </motion.div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "text-gray-600 dark:text-gray-400",
                  isLoading && "animate-spin"
                )}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <button className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              <button className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                <Settings className="w-5 h-5" />
              </button>
              
              {/* User Menu */}
              <div className="relative ml-2">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                    {userEmail.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
                  >
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {userEmail.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {userEmail}
                      </p>
                    </div>
                    <button
                      onClick={() => window.location.href = 'http://localhost:3003'}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Back to Home
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Hero Metrics */}
          <HeroMetrics isLoading={isLoading} />
          
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AIVisibilityHeatmap />
            <CompetitorLandscape3D />
          </div>
          
          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SmartRecommendations />
            </div>
            <div>
              <ActivityFeed />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}