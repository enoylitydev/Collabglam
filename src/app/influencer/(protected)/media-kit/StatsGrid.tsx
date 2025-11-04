
// -----------------------------------------------------------------------------
// StatsGrid.tsx — v2 (aggregates + active profile audience split)
// -----------------------------------------------------------------------------

import React from 'react';
import { Users, Heart, Monitor } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GenderSplit, Provider } from './mediakit';
import { COLORS } from './index';
import { formatNumber } from '@/lib/utils';

interface StatsGridProps {
  totals: { followers: number; engagements: number; erWeighted: number; avgViewsMean: number };
  primaryPlatform?: Provider | 'other' | null;
  audienceSplit?: GenderSplit;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ totals, primaryPlatform, audienceSplit }) => {
  const split = audienceSplit ? `${audienceSplit.male}% / ${audienceSplit.female}%` : '—';

  const cards = [
    {
      label: 'Total Followers',
      value: <span className="block text-2xl md:text-3xl">{formatNumber(totals.followers)}</span>,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Weighted ER',
      value: <span className="block text-2xl md:text-3xl">{(totals.erWeighted || 0).toFixed(2)}%</span>,
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Primary Platform',
      value: <span className="block text-2xl md:text-3xl">{primaryPlatform ? (primaryPlatform as string).toUpperCase() : '—'}</span>,
      icon: Monitor,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Audience Split',
      value: <span className="block text-2xl md:text-3xl">{split}</span>,
      icon: Monitor,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((c, i) => (
        <Card key={i} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <CardContent className="p-0">
            <div className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} p-5 sm:p-6 rounded-lg`}>
              <div className="text-center space-y-4">
                <div className={`inline-flex p-3 rounded-full ${c.bgColor} ring-4 ring-white/50`}>
                  <c.icon className={`h-6 w-6 ${c.color}`} />
                </div>
                <div>
                  <div className="text-gray-800 mb-1">{c.value}</div>
                  <div className="text-sm md:text-base font-semibold text-gray-700">{c.label}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

