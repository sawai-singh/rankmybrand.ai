'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  { name: 'Instant AI Score (10s)', rankmybrand: true, athena: false },
  { name: 'Real-time Updates', rankmybrand: true, athena: false },
  { name: 'Free Tier Available', rankmybrand: true, athena: false },
  { name: '8+ AI Platforms', rankmybrand: true, athena: '5 only' },
  { name: 'One-click Fixes', rankmybrand: true, athena: false },
  { name: 'API Access', rankmybrand: true, athena: 'Limited' },
  { name: 'Mobile App', rankmybrand: true, athena: false },
  { name: 'White Label Option', rankmybrand: true, athena: true },
  { name: 'Competitor Tracking', rankmybrand: 'Unlimited', athena: '3 max' },
  { name: 'Starting Price', rankmybrand: '$79/mo', athena: '$295/mo' },
];

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-2xl glass">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left p-6 font-heading text-lg">Feature</th>
            <th className="text-center p-6">
              <div className="inline-flex flex-col items-center">
                <span className="font-heading text-lg gradient-text">RankMyBrand</span>
                <span className="text-xs text-gray-500 mt-1">Recommended</span>
              </div>
            </th>
            <th className="text-center p-6">
              <span className="font-heading text-lg text-gray-500">AthenaHQ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature, index) => (
            <tr 
              key={index}
              className={cn(
                "border-b border-gray-100 dark:border-gray-800/50",
                "hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors"
              )}
            >
              <td className="p-6 font-medium">{feature.name}</td>
              <td className="p-6 text-center">
                {typeof feature.rankmybrand === 'boolean' ? (
                  feature.rankmybrand ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300 mx-auto" />
                  )
                ) : (
                  <span className="text-primary-600 dark:text-primary-400 font-medium">
                    {feature.rankmybrand}
                  </span>
                )}
              </td>
              <td className="p-6 text-center">
                {typeof feature.athena === 'boolean' ? (
                  feature.athena ? (
                    <Check className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300 mx-auto" />
                  )
                ) : (
                  <span className="text-gray-500">
                    {feature.athena}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}