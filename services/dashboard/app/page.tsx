"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeroMetrics } from "@/components/hero-metrics";
import { CommandPalette } from "@/components/command-palette";
import { AIVisibilityHeatmap } from "@/components/ai-visibility-heatmap";
import { CompetitorLandscape3D } from "@/components/competitor-landscape-3d";
import { SmartRecommendations } from "@/components/smart-recommendations";
import { ActivityFeed } from "@/components/activity-feed";
import { WelcomeModal } from "@/components/welcome-modal";
import { Bell, Settings, Zap, RefreshCw, Moon, Sun, User, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  
  const searchParams = useSearchParams();
  const router = useRouter();
  const isNewUser = searchParams.get('onboarding') === 'complete';

  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add("dark");
    
    // Check if token and user data are passed in URL (from onboarding)
    const tokenFromUrl = searchParams.get('token');
    const userFromUrl = searchParams.get('user');
    
    if (tokenFromUrl) {
      // Store the token in localStorage for the dashboard domain
      localStorage.setItem('token', decodeURIComponent(tokenFromUrl));
      localStorage.setItem('auth_token', decodeURIComponent(tokenFromUrl));
      console.log('Token stored from URL');
      
      // Store user data if provided
      if (userFromUrl) {
        try {
          const userData = JSON.parse(decodeURIComponent(userFromUrl));
          localStorage.setItem('user', JSON.stringify(userData));
          console.log('User data stored from URL');
        } catch (e) {
          console.error('Failed to parse user data from URL', e);
        }
      }
      
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('token');
      newUrl.searchParams.delete('user');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    // Load user data from localStorage or API
    loadUserData();
    
    // Show welcome modal for new users
    if (isNewUser) {
      setShowWelcome(true);
      // Remove query param
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [isNewUser, searchParams]);

  const loadUserData = async () => {
    try {
      // Get user from localStorage first
      const storedUser = localStorage.getItem('user');
      const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token');
      
      if (!authToken) {
        // Only use demo mode if no token at all
        console.log('No auth token found - using demo mode');
        const demoUser = {
          id: 1,
          email: 'demo@rankmybrand.ai',
          firstName: 'Demo',
          lastName: 'User',
          company: {
            name: 'Your Company',
            domain: 'yourcompany.com'
          },
          onboardingCompleted: true
        };
        setUser(demoUser);
        setIsLoading(false);
        return;
      }
      
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      
      // Fetch fresh user data from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Load dashboard data
        await loadDashboardData(data.user.company?.domain);
      } else if (response.status === 401) {
        // Token expired or invalid
        if (isNewUser) {
          // New user from onboarding, don't redirect
          console.log('New user with invalid token - continuing with stored data');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            await loadDashboardData(userData.company?.domain);
          }
        } else {
          // Regular user with expired token, redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          router.push('/login');
        }
      } else if (response.status === 404) {
        // Endpoint doesn't exist yet, continue with stored user
        console.log('Auth endpoint not found, using stored user data');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          await loadDashboardData(userData.company);
        }
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboardData = async (domain?: string) => {
    if (!domain) return;
    
    try {
      const authToken = localStorage.getItem('auth_token');
      // Fetch real dashboard data from your API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000'}/api/analysis/latest?domain=${domain}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    setLastRefresh(new Date());
    await loadDashboardData(user?.company?.domain);
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    router.push('/login');
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
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 rounded-lg glassmorphism glassmorphism-hover"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    {user?.firstName ? user.firstName[0].toUpperCase() : <User className="w-4 h-4 text-white" />}
                  </div>
                  <div className="text-sm text-left">
                    <p className="font-medium">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Loading...'}</p>
                    <p className="text-xs text-muted-foreground">{user?.company?.name || user?.subscriptionTier || 'Free'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {/* User Menu Dropdown */}
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-64 rounded-xl glassmorphism border border-white/10 shadow-xl overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/10">
                        <p className="text-sm font-medium">{user?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">{user?.company?.name}</p>
                      </div>
                      <div className="p-2">
                        <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span className="text-sm">Profile Settings</span>
                        </button>
                        <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          <span className="text-sm">Account Settings</span>
                        </button>
                        <div className="h-px bg-white/10 my-2" />
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2 text-red-400"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome Modal for New Users */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeModal
            userName={user?.firstName || user?.email?.split('@')[0] || 'there'}
            companyName={user?.company?.name}
            onClose={() => setShowWelcome(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Hero Metrics */}
        <section className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <h2 className="text-2xl font-bold mb-1">
              {user?.company?.name ? `${user.company.name} Overview` : 'Overview'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
              {user?.company?.domain && ` • Tracking: ${user.company.domain}`}
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
