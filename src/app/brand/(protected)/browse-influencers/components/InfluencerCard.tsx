import React from 'react';
import { Users as UsersIcon } from 'lucide-react';
import { InfluencerResult } from '../types';

export default function e

({ item, onClick }: { item: InfluencerResult; onClick?: () => void }) {
  return (
    <div onClick={onClick} role="button" className="group relative p-5 rounded-2xl border border-gray-200 bg-white hover:shadow-xl transition cursor-pointer">
      <div className="flex items-start gap-4">
        {item.avatar ? (
          <img src={item.avatar} alt={item.name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
            <UsersIcon className="h-7 w-7 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold truncate">{item.name}</h4>
            {item.verifiedStatus && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-blue-500 text-white">✓</span>
            )}
          </div>
          <div className="text-sm text-gray-600 truncate">@{item.username} · {item.platform}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Followers" value={fmt(item.followers)} />
            <Stat label="Eng. rate" value={`${(item.engagementRate * 100).toFixed(1)}%`} />
            <Stat label="Location" value={item.location || '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmt(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}