'use client';

import { Shield, Award, Clock, Users } from 'lucide-react';

export function TrustBadges() {
  const badges = [
    { icon: Shield, label: 'SOC2 Compliant', subtext: 'Enterprise Security' },
    { icon: Award, label: <span className="font-mono tabular-nums">99.9%</span>, sublabel: ' Uptime', subtext: 'Guaranteed SLA' },
    { icon: Clock, label: <><span className="font-mono tabular-nums">24/7</span> Support</>, subtext: 'Always Available' },
    { icon: Users, label: <><span className="font-mono tabular-nums">1,000+</span> Brands</>, subtext: 'Trust RankMyBrand' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-8">
      {badges.map((badge, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <badge.icon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-0">{badge.label}{badge.sublabel}</p>
            <p className="text-xs text-neutral-500">{badge.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
}