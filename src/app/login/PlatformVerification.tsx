import { useState } from 'react';
import { Instagram, Youtube, Globe, ShieldCheck, AlertTriangle, Plus } from 'lucide-react';
import { FloatingLabelInput } from '@/components/common/FloatingLabelInput';
import { Button } from './Button';
import { post } from '@/lib/api';

type P = {
  influencerId: string;
  onContinue: (platforms: SavedPlatform[]) => void;
};
type PlatformValue = 'instagram'|'tiktok'|'youtube'|'x';
type VerifyState = 'idle'|'verifying'|'verified'|'selfreport';

export type SavedPlatform = {
  platform: PlatformValue;
  handle: string;
  verified: boolean;
  followersBracket?: string;
  avgViewsBracket?: string;
  engagementBracket?: string; // %
  postingFrequency?: 'weekly'|'2-3x'|'daily';
};

const followerBrackets = ['<10k','10k-50k','50k-100k','100k-250k','250k-1M','1M+'];
const viewsBrackets = ['<5k','5k-10k','10k-50k','50k-100k','100k+'];
const engagementBrackets = ['<1','1-3','3-5','5-8','8+']; // %

export function PlatformVerification({ influencerId, onContinue }: P) {
  const [primary, setPrimary] = useState<PlatformValue>('instagram');
  const [handle, setHandle] = useState('');
  const [state, setState] = useState<VerifyState>('idle');
  const [saving, setSaving] = useState(false);
  const [platforms, setPlatforms] = useState<SavedPlatform[]>([]);

  const verify = async () => {
    if (!handle.trim()) return;
    setState('verifying');
    try {
      const res = await post('/influencer/platform/verify', { influencerId, platform: primary, handle });
      if (res?.verified) {
        setPlatforms(prev => [...prev, { platform: primary, handle, verified: true }]);
        setState('verified');
      } else {
        setState('selfreport');
      }
    } catch {
      setState('selfreport');
    }
  };

  const addSelfReport = (p: Partial<SavedPlatform>) => {
    setPlatforms(prev => [...prev, {
      platform: primary, handle, verified: false,
      followersBracket: p.followersBracket,
      avgViewsBracket: p.avgViewsBracket,
      engagementBracket: p.engagementBracket,
      postingFrequency: p.postingFrequency,
    }]);
    setState('idle');
    setHandle('');
  };

  const saveAll = async () => {
    if (!platforms.length) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('influencerId', influencerId);
      fd.append('platforms', JSON.stringify(platforms));
      // optionally append screenshots with keys `screenshots[]`
      await post('/influencer/platforms/save', fd);
      onContinue(platforms);
    } finally {
      setSaving(false);
    }
  };

  const icon = (p: PlatformValue) => p === 'instagram' ? <Instagram className="w-5 h-5" /> :
    p === 'youtube' ? <Youtube className="w-5 h-5" /> : <Globe className="w-5 h-5" />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 text-center">We’ll never post on your behalf — verification is read-only.</p>

      {/* chips */}
      <div className="grid grid-cols-4 gap-2">
        {(['instagram','tiktok','youtube','x'] as PlatformValue[]).map(p => (
          <button key={p}
            type="button"
            onClick={() => { setPrimary(p); setState('idle'); }}
            className={`p-3 rounded-xl border-2 ${primary===p?'border-yellow-500 bg-yellow-50':'border-gray-300 hover:border-gray-400'}`}>
            <div className="flex flex-col items-center gap-1">
              {icon(p)} <span className="text-xs capitalize">{p}</span>
            </div>
          </button>
        ))}
      </div>

      <FloatingLabelInput
        id="pf-handle"
        label="Handle"
        type="text"
        placeholder="@yourhandle"
        value={handle}
        onChange={e => setHandle(e.target.value)}
        required
      />

      {state === 'idle' && (
        <Button onClick={verify} variant="influencer">Verify via {primary === 'instagram' ? 'Instagram' : 'platform'}</Button>
      )}

      {state === 'verifying' && (
        <Button loading variant="influencer">Verifying…</Button>
      )}

      {state === 'verified' && (
        <div className="p-4 rounded-lg border border-green-200 bg-green-50 flex items-center gap-3">
          <ShieldCheck className="text-green-600" /> <span className="text-sm text-green-900">Verified! Profile linked.</span>
          <button
            type="button"
            className="ml-auto text-sm text-gray-700 hover:underline flex items-center gap-1"
            onClick={()=>{ setState('idle'); setHandle(''); }}
          ><Plus className="w-4 h-4"/> Add another</button>
        </div>
      )}

      {state === 'selfreport' && (
        <div className="space-y-4 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle /> <span className="text-sm">Couldn’t verify (private or not found). Self-report to continue.</span>
          </div>
          <select className="w-full px-4 py-3 border-2 rounded-lg" defaultValue="">
            <option value="" disabled>Followers bracket</option>
            {followerBrackets.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="w-full px-4 py-3 border-2 rounded-lg" defaultValue="">
            <option value="" disabled>Avg views (last 10)</option>
            {viewsBrackets.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="w-full px-4 py-3 border-2 rounded-lg" defaultValue="">
            <option value="" disabled>Engagement rate (%)</option>
            {engagementBrackets.map(b => <option key={b} value={b}>{b}%</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {['weekly','2-3x','daily'].map(f => (
              <button key={f} type="button" className="px-3 py-2 border-2 rounded-lg hover:border-gray-400">{f}</button>
            ))}
          </div>
          {/* (optional) file input for screenshot */}
          <input type="file" accept="image/*" className="block w-full text-sm" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>setState('idle')}>Cancel</Button>
            <Button onClick={()=>{
              const selects = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];
              const [followersBracket, avgViewsBracket, engagementBracket] = selects.map(s=>s.value);
              const freqBtn = document.querySelector('.grid.grid-cols-3 button[aria-pressed="true"]') as HTMLButtonElement|null;
              addSelfReport({
                followersBracket,
                avgViewsBracket,
                engagementBracket,
                postingFrequency: 'weekly'
              });
            }} variant="influencer">Save self-report</Button>
          </div>
        </div>
      )}

      {platforms.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Added platforms</h4>
          <ul className="text-sm text-gray-700 list-disc ml-5">
            {platforms.map((p, i) => (
              <li key={i}>{p.platform} · {p.handle} {p.verified ? '— verified' : '— self-report'}</li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={saveAll} loading={saving} variant="influencer">Continue</Button>
    </div>
  );
}
