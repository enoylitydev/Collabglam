import React from 'react';
import { Users, Heart, Monitor, PieChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MediaKit } from './mediakit';
import { COLORS } from './index';
import { formatNumber } from '@/lib/utils';

interface StatsGridProps {
  mediaKit: MediaKit;
  isEditing: boolean;
  onFieldChange: (field: keyof MediaKit, value: any) => void;
}

const toNumber = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const StatsGrid: React.FC<StatsGridProps> = ({ mediaKit, isEditing, onFieldChange }) => {
  const followersNum = toNumber(mediaKit?.followers, 0);
  const engagementNum = toNumber(mediaKit?.engagementRate, 0);
  const male = toNumber(mediaKit?.audienceBifurcation?.malePercentage, 0);
  const female = toNumber(mediaKit?.audienceBifurcation?.femalePercentage, 0);
  const platform = mediaKit?.platformName || '—';

  const stats: Array<{
    label: string;
    value: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    subtitle?: string;
  }> = [
    {
      label: 'Total Followers',
      value: isEditing ? (
        <input
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(followersNum) ? followersNum : 0}
          onChange={(e) => onFieldChange('followers', Number(e.target.value))}
          className="w-full max-w-xs md:max-w-none px-3 py-2 text-center text-2xl md:text-3xl font-bold bg-transparent border-b border-gray-300 focus:border-yellow-500 outline-none"
        />
      ) : (
        <span className="block text-2xl md:text-3xl">{formatNumber(followersNum)}</span>
      ),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Engagement Rate',
      value: isEditing ? (
        <div className="flex items-center justify-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Number.isFinite(engagementNum) ? engagementNum : 0}
            onChange={(e) => onFieldChange('engagementRate', Number(e.target.value))}
            className="w-24 md:w-28 px-2 py-1 text-center text-2xl md:text-3xl font-bold bg-transparent border-b border-gray-300 focus:border-yellow-500 outline-none"
          />
          <span className="text-2xl md:text-3xl font-bold">%</span>
        </div>
      ) : (
        <span className="block text-2xl md:text-3xl">
          {(Number.isFinite(engagementNum) ? engagementNum : 0).toFixed(2)}%
        </span>
      ),
      icon: Heart,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Platform',
      value: isEditing ? (
        <input
          type="text"
          value={platform}
          onChange={(e) => onFieldChange('platformName', e.target.value)}
          className="w-full max-w-xs md:max-w-none px-3 py-2 text-center text-2xl md:text-3xl font-bold bg-transparent border-b border-gray-300 focus:border-yellow-500 outline-none"
        />
      ) : (
        <span className="block text-2xl md:text-3xl">{platform}</span>
      ),
      icon: Monitor,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Audience Split',
      value: <span className="block text-2xl md:text-3xl">{male}% / {female}%</span>,
      icon: PieChart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      subtitle: 'Male / Female',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        >
          <CardContent className="p-0">
            <div className={`bg-gradient-to-r ${COLORS.PRIMARY_GRADIENT} p-5 sm:p-6 rounded-lg`}>
              <div className="text-center space-y-4">
                <div className={`inline-flex p-3 rounded-full ${stat.bgColor} ring-4 ring-white/50`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>

                <div>
                  <div className="text-gray-800 mb-1">{stat.value}</div>
                  <div className="text-sm md:text-base font-semibold text-gray-700">{stat.label}</div>
                  {stat.subtitle && <div className="text-xs md:text-sm text-gray-600 mt-1">{stat.subtitle}</div>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
