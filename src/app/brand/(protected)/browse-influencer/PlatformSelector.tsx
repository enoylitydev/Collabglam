// PlatformSelector.tsx
import React from 'react';
import type { Platform } from './filters';
import { platformTheme } from './utils/platform';

interface PlatformSelectorProps {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
}

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  const platforms: Platform[] = ['youtube', 'tiktok', 'instagram'];

  const toggle = (p: Platform) => {
    const set = new Set(selected);
    set.has(p) ? set.delete(p) : set.add(p);
    const next = Array.from(set);
    onChange(next.length ? next : [p]); // keep at least one
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Platform(s)
      </label>
      <div className="grid grid-cols-3 gap-2">
        {platforms.map((platform) => {
          const theme = platformTheme[platform];
          const isSelected = selected.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              onClick={() => toggle(platform)}
              className={`relative flex flex-col items-center p-3 rounded-lg border transition-all ${
                isSelected
                  ? `border-gray-700 ${theme.color} text-white shadow-md`
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              aria-pressed={isSelected}
            >
              <div className={`mb-1 ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                {theme.icon}
              </div>
              <span className="text-xs font-medium">{theme.label}</span>

              {isSelected && (
                <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-gray-700 ring-offset-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
