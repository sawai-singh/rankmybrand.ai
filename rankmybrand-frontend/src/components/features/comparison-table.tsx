'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const features = [
  { name: 'Instant Score', us: true, them: false },
  { name: 'Real-time Updates', us: true, them: false },
  { name: 'Free Tier', us: true, them: false },
  { name: 'AI Platforms', us: 'All major', them: 'Limited' },
  { name: 'Price', us: '$79/mo', them: '$200+/mo', highlight: true },
];

export function ComparisonTable() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* White background with shadow for better hierarchy */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left p-6 text-gray-700 dark:text-gray-300 font-semibold">Feature</th>
              <th className="text-center p-6">
                <div className="text-gray-900 dark:text-white font-bold">RankMyBrand</div>
                <div className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">✓ Recommended</div>
              </th>
              <th className="text-center p-6 text-gray-600 dark:text-gray-400 font-semibold">Other Tools</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, i) => (
              <motion.tr
                key={feature.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  feature.highlight ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                }`}
              >
                <td className="p-6 text-gray-900 dark:text-white font-medium">{feature.name}</td>
                <td className="p-6 text-center">
                  {typeof feature.us === 'boolean' ? (
                    feature.us ? (
                      <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400 stroke-[3]" aria-label="Included" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/20 rounded-full">
                        <X className="w-4 h-4 text-red-500 dark:text-red-400 stroke-[3]" aria-label="Not included" />
                      </div>
                    )
                  ) : (
                    <span className="text-primary-600 dark:text-primary-400 font-bold">{feature.us}</span>
                  )}
                </td>
                <td className="p-6 text-center">
                  {typeof feature.them === 'boolean' ? (
                    feature.them ? (
                      <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400 stroke-[3]" aria-label="Included" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/20 rounded-full">
                        <X className="w-4 h-4 text-red-500 dark:text-red-400 stroke-[3]" aria-label="Not included" />
                      </div>
                    )
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400 font-medium">{feature.them}</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}