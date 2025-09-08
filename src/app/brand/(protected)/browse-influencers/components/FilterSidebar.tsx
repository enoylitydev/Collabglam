'use client';
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Filter } from 'lucide-react';
import { Platform, SearchFilters } from '../types'
import { PLATFORMS } from '../constants';

interface FilterSidebarProps {
  selectedPlatforms: Platform[];
  onPlatformsChange: (platforms: Platform[]) => void;
  initialFilters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
}

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }>
  = ({ title, defaultOpen = true, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div className="rounded-xl border bg-white">
        <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-3 py-2 font-medium hover:bg-gray-50">
          <span>{title}</span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>
        {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
      </div>
    );
  };

export default function FilterSidebar({ selectedPlatforms, onPlatformsChange, initialFilters, onApply }: FilterSidebarProps) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const isIG = selectedPlatforms.includes('instagram');
  const isTT = selectedPlatforms.includes('tiktok');
  const isYT = selectedPlatforms.includes('youtube');

  const togglePlatform = (p: Platform) => {
    onPlatformsChange(
      selectedPlatforms.includes(p)
        ? selectedPlatforms.filter(x => x !== p)
        : [...selectedPlatforms, p]
    );
  };

  const update = (patch: Partial<SearchFilters>) => setFilters(f => ({ ...f, ...patch }));

  return (
    <aside className="w-80 h-full overflow-y-auto bg-white p-4 md:p-6 flex flex-col border-r">
      <header className="mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</h2>
        <p className="text-xs text-gray-500">Tune creators by platform and audience.</p>
      </header>

      <div className="flex-1 space-y-4 pr-1">
        {/* Platforms */}
        <Section title="Platforms">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(['youtube', 'tiktok', 'instagram'] as Platform[]).map((p: Platform) => {
              const isSelected = selectedPlatforms.includes(p);
              const base =
                'px-3 py-2 rounded-xl text-sm font-medium border transition-colors duration-200 ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFA135] focus-visible:ring-offset-2';
              const state = isSelected
                ? `text-white bg-gradient-to-r ${PLATFORMS[p].gradient} border-transparent shadow`
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50';

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePlatform(p);
                    }
                  }}
                  aria-pressed={isSelected}
                  title={PLATFORMS[p].label}
                  className={[base, state].join(' ')}
                >
                  <span className="inline-flex items-center gap-2">
                    {PLATFORMS[p].label}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Influencer */}
        <Section title="Influencer" defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Followers min</label>
              <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.minFollowers ?? ''}
                onChange={e => update({ minFollowers: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Followers max</label>
              <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.maxFollowers ?? ''}
                onChange={e => update({ maxFollowers: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Min engagement %</label>
              <input type="number" step="0.1" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.minEngagement ?? 0}
                onChange={e => update({ minEngagement: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Last posted (days)</label>
              <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.lastPostedDays ?? ''}
                onChange={e => update({ lastPostedDays: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Language code</label>
              <input placeholder="en" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.languageCode ?? ''}
                onChange={e => update({ languageCode: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Gender</label>
              <select className="mt-1 w-full border rounded-md px-2 py-1" value={filters.influencerGender ?? ''}
                onChange={e => update({ influencerGender: (e.target.value || undefined) as any })}>
                <option value="">Any</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Bio contains</label>
              <input className="mt-1 w-full border rounded-md px-2 py-1" value={filters.bioQuery ?? ''}
                onChange={e => update({ bioQuery: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input id="hasEmail" type="checkbox" checked={!!filters.hasEmail} onChange={e => update({ hasEmail: e.target.checked })} />
              <label htmlFor="hasEmail" className="text-xs text-gray-700 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Has public email</label>
            </div>
          </div>
        </Section>

        {/* YouTube-only */}
        {isYT && (
          <Section title="YouTube">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex items-center gap-2">
                <input id="isArtist" type="checkbox" checked={!!filters.isOfficialArtist} onChange={e => update({ isOfficialArtist: e.target.checked })} />
                <label htmlFor="isArtist" className="text-xs text-gray-700">Official artist</label>
              </div>
              <div>
                <label className="text-xs text-gray-600">Views growth value</label>
                <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1"
                  value={filters.viewsGrowthRate?.value ?? ''}
                  onChange={e => update({ viewsGrowthRate: { ...(filters.viewsGrowthRate || { interval: 'i1month', operator: 'gt' }), value: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Views growth interval</label>
                <select className="mt-1 w-full border rounded-md px-2 py-1"
                  value={filters.viewsGrowthRate?.interval ?? 'i1month'}
                  onChange={e => update({ viewsGrowthRate: { ...(filters.viewsGrowthRate || { value: 0.1, operator: 'gt' }), interval: e.target.value as any } })}>
                  <option value="i1month">1m</option>
                  <option value="i3months">3m</option>
                  <option value="i6months">6m</option>
                  <option value="i12months">12m</option>
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* TikTok-only */}
        {isTT && (
          <Section title="TikTok">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Likes growth value</label>
                <input type="number" step="0.01" className="mt-1 w-full border rounded-md px-2 py-1"
                  value={filters.likesGrowthRate?.value ?? ''}
                  onChange={e => update({ likesGrowthRate: { ...(filters.likesGrowthRate || { interval: 'i1month', operator: 'gt' }), value: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Likes growth interval</label>
                <select className="mt-1 w-full border rounded-md px-2 py-1"
                  value={filters.likesGrowthRate?.interval ?? 'i1month'}
                  onChange={e => update({ likesGrowthRate: { ...(filters.likesGrowthRate || { value: 0.1, operator: 'gt' }), interval: e.target.value as any } })}>
                  <option value="i1month">1m</option>
                  <option value="i3months">3m</option>
                  <option value="i6months">6m</option>
                  <option value="i12months">12m</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Shares min</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.sharesMin ?? ''}
                  onChange={e => update({ sharesMin: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Shares max</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.sharesMax ?? ''}
                  onChange={e => update({ sharesMax: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Saves min</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.savesMin ?? ''}
                  onChange={e => update({ savesMin: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Saves max</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.savesMax ?? ''}
                  onChange={e => update({ savesMax: Number(e.target.value) })} />
              </div>
            </div>
          </Section>
        )}

        {/* Instagram-only */}
        {isIG && (
          <Section title="Instagram">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Reels plays min</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.reelsPlaysMin ?? ''}
                  onChange={e => update({ reelsPlaysMin: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Reels plays max</label>
                <input type="number" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.reelsPlaysMax ?? ''}
                  onChange={e => update({ reelsPlaysMax: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input id="sponsored" type="checkbox" checked={!!filters.hasSponsoredPosts} onChange={e => update({ hasSponsoredPosts: e.target.checked })} />
                <label htmlFor="sponsored" className="text-xs text-gray-700">Has sponsored posts</label>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Account types (IDs, comma)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" placeholder="2, 7" value={(filters.accountTypes || []).join(', ')}
                  onChange={e => update({ accountTypes: e.target.value.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Brands (IDs, comma)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" placeholder="1708, 13" value={(filters.brands || []).join(', ')}
                  onChange={e => update({ brands: e.target.value.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Interests (IDs, comma)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" placeholder="3, 21, 1" value={(filters.interests || []).join(', ')}
                  onChange={e => update({ interests: e.target.value.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n)) })} />
              </div>
            </div>
          </Section>
        )}

        {/* Audience */}
        <Section title="Audience">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Audience language id</label>
              <input placeholder="en" className="mt-1 w-full border rounded-md px-2 py-1" value={filters.audienceLanguage?.id ?? ''}
                onChange={e => update({ audienceLanguage: { id: e.target.value, weight: filters.audienceLanguage?.weight ?? 0.2 } })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Lang weight</label>
              <input type="number" step="0.05" min={0} max={1} className="mt-1 w-full border rounded-md px-2 py-1" value={filters.audienceLanguage?.weight ?? 0}
                onChange={e => update({ audienceLanguage: { id: filters.audienceLanguage?.id ?? '', weight: Number(e.target.value) } })} />
            </div>
            <div>
              <label className="text-xs text-gray-600">Gender focus</label>
              <select className="mt-1 w-full border rounded-md px-2 py-1" value={filters.audienceGender?.id ?? ''}
                onChange={e => update({ audienceGender: e.target.value ? { id: e.target.value as any, weight: filters.audienceGender?.weight ?? 0.5 } : undefined })}>
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Audience geo IDs (id:weight, comma)</label>
              <input className="mt-1 w-full border rounded-md px-2 py-1" placeholder="148838:0.2, 62149:0.2"
                value={(filters.audienceWeightedLocations || []).map(x => `${x.id}:${x.weight}`).join(', ')}
                onChange={e => update({
                  audienceWeightedLocations:
                    e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
                      const [idRaw, wRaw] = pair.split(':');
                      const id = Number(idRaw);
                      const w = Number(wRaw);
                      return (Number.isFinite(id) && Number.isFinite(w)) ? { id, weight: w } : null;
                    }).filter(Boolean) as any
                })} />
            </div>
          </div>
        </Section>
      </div>

      <div className="sticky bottom-0 bg-white pt-3 border-t mt-2">
        <button onClick={() => onApply(filters)} className="w-full rounded-xl px-4 py-2.5 font-medium text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90">Apply Filters</button>
      </div>
    </aside>
  );
}
