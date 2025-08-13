'use client';

import { Shield, Award, Clock, Users } from 'lucide-react';

export function TrustBadges() {
  const badges = [
    { icon: Shield, label: 'SOC2 Compliant', subtext: 'Enterprise Security' },
    { icon: Award, label: '99.9% Uptime', subtext: 'Guaranteed SLA' },
    { icon: Clock, label: '24/7 Support', subtext: 'Always Available' },
    { icon: Users, label: '1,000+ Brands', subtext: 'Trust RankMyBrand' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-8">
      {badges.map((badge, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <badge.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-sm">{badge.label}</p>
            <p className="text-xs text-gray-500">{badge.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
}