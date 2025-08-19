'use client';

import { motion } from 'framer-motion';

const features = [
  { name: 'Instant Score', us: true, them: false },
  { name: 'Real-time Updates', us: true, them: false },
  { name: 'Free Tier', us: true, them: false },
  { name: 'AI Platforms', us: '8+', them: '5' },
  { name: 'Price', us: '$79/mo', them: '$295/mo', highlight: true },
];

export function ComparisonTable() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-dark rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-6 text-gray-400">Feature</th>
              <th className="text-center p-6">
                <div className="text-white font-bold">RankMyBrand</div>
                <div className="text-xs text-violet-400 mt-1">Recommended</div>
              </th>
              <th className="text-center p-6 text-gray-500">AthenaHQ</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, i) => (
              <motion.tr
                key={feature.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`border-b border-white/5 ${feature.highlight ? 'bg-violet-500/10' : ''}`}
              >
                <td className="p-6 text-white">{feature.name}</td>
                <td className="p-6 text-center">
                  {typeof feature.us === 'boolean' ? (
                    feature.us ? (
                      <span className="text-green-400 text-xl">✓</span>
                    ) : (
                      <span className="text-gray-600">×</span>
                    )
                  ) : (
                    <span className="text-violet-400 font-bold">{feature.us}</span>
                  )}
                </td>
                <td className="p-6 text-center">
                  {typeof feature.them === 'boolean' ? (
                    feature.them ? (
                      <span className="text-green-400 text-xl">✓</span>
                    ) : (
                      <span className="text-gray-600">×</span>
                    )
                  ) : (
                    <span className="text-gray-500">{feature.them}</span>
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