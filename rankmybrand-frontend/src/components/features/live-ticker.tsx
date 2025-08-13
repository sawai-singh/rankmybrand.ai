'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Zap } from 'lucide-react';

const updates = [
  { type: 'score', text: 'Nike.com just hit 95 GEO score', icon: TrendingUp },
  { type: 'win', text: 'TechStartup increased visibility by 234%', icon: Award },
  { type: 'new', text: 'Amazon joined RankMyBrand', icon: Zap },
  { type: 'score', text: 'Apple.com ranking #1 for "innovation"', icon: TrendingUp },
  { type: 'win', text: 'LocalBiz beat 3 competitors this week', icon: Award },
  { type: 'new', text: 'Microsoft started tracking AI metrics', icon: Zap },
];

export function LiveTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % updates.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentUpdate = updates[currentIndex];
  const Icon = currentUpdate.icon;

  return (
    <div className="relative overflow-hidden">
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-gray-500">Live</span>
        </div>
        
        <motion.div
          key={currentIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-1.5 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
            <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="text-sm font-medium">{currentUpdate.text}</span>
        </motion.div>

        <span className="text-xs text-gray-400">Updated just now</span>
      </div>
    </div>
  );
}