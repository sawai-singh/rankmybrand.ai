'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { 
  Search, 
  Home, 
  BarChart, 
  Settings, 
  FileText, 
  Users, 
  HelpCircle,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Shield,
  TrendingUp,
  Command as CommandIcon,
  ChevronRight,
  Clock,
  Star,
  Hash,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
  shortcut?: string;
  isPremium?: boolean;
  isNew?: boolean;
}

export function IntelligentCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = React.useState<CommandItem[]>([]);

  // Command items
  const commands: CommandItem[] = [
    {
      id: 'home',
      title: 'Go to Home',
      description: 'Navigate to homepage',
      icon: <Home className="w-4 h-4" />,
      action: () => router.push('/'),
      category: 'Navigation',
      keywords: ['main', 'landing', 'start'],
      shortcut: '⌘H',
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'View your analytics dashboard',
      icon: <BarChart className="w-4 h-4" />,
      action: () => router.push('/dashboard'),
      category: 'Navigation',
      keywords: ['analytics', 'stats', 'metrics'],
      shortcut: '⌘D',
    },
    {
      id: 'analyze',
      title: 'Analyze Domain',
      description: 'Start a new AI visibility analysis',
      icon: <Zap className="w-4 h-4" />,
      action: () => router.push('/onboarding/company'),
      category: 'Actions',
      keywords: ['scan', 'check', 'test', 'audit'],
      isNew: true,
    },
    {
      id: 'competitors',
      title: 'Compare Competitors',
      description: 'Analyze competitor visibility',
      icon: <Users className="w-4 h-4" />,
      action: () => router.push('/onboarding/competitors'),
      category: 'Actions',
      keywords: ['compare', 'versus', 'competition'],
    },
    {
      id: 'reports',
      title: 'View Reports',
      description: 'Access your visibility reports',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/reports'),
      category: 'Navigation',
      keywords: ['documents', 'results', 'insights'],
      isPremium: true,
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Manage your account settings',
      icon: <Settings className="w-4 h-4" />,
      action: () => router.push('/settings'),
      category: 'System',
      keywords: ['preferences', 'config', 'account'],
      shortcut: '⌘,',
    },
    {
      id: 'help',
      title: 'Help & Documentation',
      description: 'Get help and read docs',
      icon: <HelpCircle className="w-4 h-4" />,
      action: () => router.push('/help'),
      category: 'Support',
      keywords: ['docs', 'guide', 'tutorial', 'faq'],
      shortcut: '⌘?',
    },
  ];

  // Categories
  const categories = ['All', 'Navigation', 'Actions', 'System', 'Support'];

  // Filter commands based on search and category
  const filteredCommands = React.useMemo(() => {
    let filtered = commands;

    if (selectedCategory && selectedCategory !== 'All') {
      filtered = filtered.filter(cmd => cmd.category === selectedCategory);
    }

    if (search) {
      filtered = filtered.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.title.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(searchLower))
        );
      });
    }

    return filtered;
  }, [search, selectedCategory]);

  // AI-powered suggestions (simulated)
  React.useEffect(() => {
    if (search.length > 2) {
      // Simulate AI suggestions based on search
      const suggestions = commands
        .filter(cmd => {
          const score = calculateRelevanceScore(search, cmd);
          return score > 0.3;
        })
        .sort((a, b) => {
          const scoreA = calculateRelevanceScore(search, a);
          const scoreB = calculateRelevanceScore(search, b);
          return scoreB - scoreA;
        })
        .slice(0, 3);
      
      setAiSuggestions(suggestions);
    } else {
      setAiSuggestions([]);
    }
  }, [search]);

  // Calculate relevance score for AI suggestions
  function calculateRelevanceScore(query: string, item: CommandItem): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    if (item.title.toLowerCase().includes(queryLower)) score += 1;
    if (item.description?.toLowerCase().includes(queryLower)) score += 0.5;
    if (item.keywords?.some(k => k.includes(queryLower))) score += 0.3;

    return score;
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save recent searches
  const handleSelect = (item: CommandItem) => {
    if (search && !recentSearches.includes(search)) {
      setRecentSearches(prev => [search, ...prev].slice(0, 5));
    }
    item.action();
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-2xl hover:shadow-3xl transition-all z-40 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <CommandIcon className="w-6 h-6" />
        <motion.div
          className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="absolute bottom-full mb-2 right-0 px-3 py-1 bg-black/80 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Press ⌘K
        </div>
      </motion.button>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Command Palette */}
            <motion.div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="glass-panel-floating rounded-3xl overflow-hidden shadow-2xl">
                <Command className="w-full">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Command.Input
                      value={search}
                      onValueChange={setSearch}
                      placeholder="Search commands or type anything..."
                      className="w-full px-12 py-5 text-lg bg-transparent border-b border-gray-200 dark:border-gray-700 focus:outline-none"
                    />
                    <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">
                      ESC
                    </kbd>
                  </div>

                  {/* Categories */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    {categories.map(category => (
                      <motion.button
                        key={category}
                        onClick={() => setSelectedCategory(category === 'All' ? null : category)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                          (category === 'All' && !selectedCategory) || selectedCategory === category
                            ? 'bg-violet-600 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {category}
                      </motion.button>
                    ))}
                  </div>

                  {/* Command List */}
                  <Command.List className="max-h-[400px] overflow-y-auto p-2">
                    {/* AI Suggestions */}
                    {aiSuggestions.length > 0 && (
                      <Command.Group heading="AI Suggestions" className="mb-4">
                        {aiSuggestions.map(item => (
                          <CommandItemComponent
                            key={item.id}
                            item={item}
                            onSelect={handleSelect}
                            isAiSuggested
                          />
                        ))}
                      </Command.Group>
                    )}

                    {/* Recent Searches */}
                    {recentSearches.length > 0 && !search && (
                      <Command.Group heading="Recent" className="mb-4">
                        {recentSearches.map((term, index) => (
                          <Command.Item
                            key={index}
                            onSelect={() => setSearch(term)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-violet-600/10 cursor-pointer"
                          >
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{term}</span>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* All Commands */}
                    <Command.Group heading={selectedCategory || 'All Commands'}>
                      {filteredCommands.length > 0 ? (
                        filteredCommands.map(item => (
                          <CommandItemComponent
                            key={item.id}
                            item={item}
                            onSelect={handleSelect}
                          />
                        ))
                      ) : (
                        <div className="px-3 py-8 text-center text-gray-500">
                          No commands found for "{search}"
                        </div>
                      )}
                    </Command.Group>
                  </Command.List>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>↑↓ Navigate</span>
                      <span>↵ Select</span>
                      <span>ESC Close</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      <span>AI-Powered</span>
                    </div>
                  </div>
                </Command>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Command Item Component
interface CommandItemComponentProps {
  item: CommandItem;
  onSelect: (item: CommandItem) => void;
  isAiSuggested?: boolean;
}

function CommandItemComponent({ item, onSelect, isAiSuggested }: CommandItemComponentProps) {
  return (
    <Command.Item
      onSelect={() => onSelect(item)}
      className="group relative flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-violet-600/10 cursor-pointer transition-all"
    >
      {/* Icon */}
      <div className={cn(
        'p-2 rounded-lg',
        isAiSuggested ? 'bg-violet-600/20' : 'bg-gray-100 dark:bg-gray-800'
      )}>
        {item.icon}
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.title}</span>
          {item.isNew && (
            <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full">
              New
            </span>
          )}
          {item.isPremium && (
            <Star className="w-3 h-3 text-yellow-500" />
          )}
          {isAiSuggested && (
            <Sparkles className="w-3 h-3 text-violet-500" />
          )}
        </div>
        {item.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {item.description}
          </p>
        )}
      </div>

      {/* Shortcut or Arrow */}
      {item.shortcut ? (
        <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">
          {item.shortcut}
        </kbd>
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
      )}
    </Command.Item>
  );
}