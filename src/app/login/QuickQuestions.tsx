import { useMemo, useState } from 'react';
import { Button } from './Button';
import { useAutosave } from './useAutosave';
import { post } from '@/lib/api';

type P = { influencerId: string; onDone: () => void; };

const formats = ['Reels/Shorts','Stories','Static','Long-form','Tutorials','Live','Reviews','Unboxing'];
const budgets = ['₹5k–10k','₹10k–25k','₹25k–50k','₹50k–1L','₹1L+'];
const projectLength = ['One-off (<2 wks)','Short (2–8 wks)','Long-term (3–6 m)','Retainer (6+ m)'];
const capacity = ['Light','Normal','Heavy'];

const niches = ['Beauty','Fashion','Tech','Fitness','Travel','Lifestyle','Gaming','Food','Art','Music'];
const collabTypes = ['Paid','Product Gifting','Ambassador','Event'];
const cadence = ['Single Deliverable','Weekly Series','Always-on'];

const storyGroups = {
  Content: [
    "What’s one thing your content always delivers—no exceptions?",
    "What’s your why—the thing that fuels your creativity?",
    "How do you stay real when the internet loves perfect?"
  ],
  Audience: [
    "What’s one product your audience still thanks you for recommending?",
    "What’s one topic your followers can’t get enough of?",
    "How do you hope your audience feels after every post?"
  ],
  Brand: [
    "What makes a brand an instant yes for you?",
    "What’s been your most unexpected collab—and why did it click?",
    "What’s one thing you won’t compromise on in a partnership?"
  ]
} as const;

export function QuickQuestions({ influencerId, onDone }: P) {
  const [step, setStep] = useState<1|2|3>(1);

  // round states
  const [round1, setRound1] = useState<{ formats:string[]; budgets: Record<string,string>; projectLength?:string; capacity?:string }>({ formats: [], budgets: {} });
  const [round2, setRound2] = useState<{ niches:string[]; industries:string[]; collabs:string[]; cadence:string[] }>({ niches:[], industries:[], collabs:[], cadence:[] });
  const [round3, setRound3] = useState<{ selected: { group: keyof typeof storyGroups; prompt: string }[] }>({ selected: [] });

  // autosave hooks
  useAutosave(round1, (v)=>post('/influencer/onboarding/save', { influencerId, section: 'round1', payload: v }));
  useAutosave(round2, (v)=>post('/influencer/onboarding/save', { influencerId, section: 'round2', payload: v }));
  useAutosave(round3, (v)=>post('/influencer/onboarding/save', { influencerId, section: 'round3', payload: v }));

  const canNext1 = round1.formats.length>0 && round1.projectLength && round1.capacity && round1.formats.every(f => round1.budgets[f]);
  const canNext2 = round2.niches.length>=1 && round2.industries.length>=1 && round2.collabs.length>=1;
  const canFinish = true; // round3 is optional (skip allowed)

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 text-center">Step {step} of 3</div>

      {step===1 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Pick formats & budgets, how you like to work, and current capacity.</p>
          {/* formats */}
          <div className="flex flex-wrap gap-2">
            {formats.map(f => (
              <button key={f} type="button"
                onClick={()=>{
                  setRound1(s => {
                    const on = s.formats.includes(f);
                    const formats = on ? s.formats.filter(x=>x!==f) : [...s.formats, f];
                    const budgets = {...s.budgets}; if (on) delete budgets[f];
                    return {...s, formats, budgets};
                  });
                }}
                className={`px-3 py-2 rounded-full border-2 text-sm ${round1.formats.includes(f)?'border-yellow-500 bg-yellow-50':'border-gray-300'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* budgets per selected format */}
          {round1.formats.map(f => (
            <div key={f} className="grid grid-cols-2 gap-2 items-center">
              <span className="text-sm text-gray-700">{f} budget</span>
              <select value={round1.budgets[f] || ''} onChange={e=>setRound1(s=>({...s, budgets:{...s.budgets, [f]: e.target.value}}))}
                className="px-3 py-2 border-2 rounded-lg">
                <option value="" disabled>Select</option>
                {budgets.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ))}

          {/* project length */}
          <select className="w-full px-4 py-3 border-2 rounded-lg" value={round1.projectLength || ''} onChange={e=>setRound1(s=>({...s, projectLength: e.target.value}))}>
            <option value="" disabled>Preferred Project Length</option>
            {projectLength.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* capacity */}
          <select className="w-full px-4 py-3 border-2 rounded-lg" value={round1.capacity || ''} onChange={e=>setRound1(s=>({...s, capacity: e.target.value}))}>
            <option value="" disabled>Capacity Right Now</option>
            {capacity.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <Button variant="influencer" disabled={!canNext1} onClick={()=>setStep(2)}>Next</Button>
        </div>
      )}

      {step===2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Pick niches, industries you want, collab types, and cadence you enjoy.</p>

          {/* niches (max 5) */}
          <div className="flex flex-wrap gap-2">
            {niches.map(n => (
              <button key={n} type="button"
                onClick={()=>{
                  setRound2(s=>{
                    const on = s.niches.includes(n);
                    if (!on && s.niches.length>=5) return s;
                    const niches = on ? s.niches.filter(x=>x!==n) : [...s.niches, n];
                    return {...s, niches};
                  });
                }}
                className={`px-3 py-2 rounded-full border-2 text-sm ${round2.niches.includes(n)?'border-yellow-500 bg-yellow-50':'border-gray-300'}`}>
                {n}
              </button>
            ))}
          </div>

          {/* industries (simple multi for now; you can replace with dependent dropdowns) */}
          <input
            className="w-full px-4 py-3 border-2 rounded-lg"
            placeholder="Industries you want to work with (comma separated)"
            onChange={e=>setRound2(s=>({...s, industries: e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}
          />

          {/* collab types */}
          <div className="flex flex-wrap gap-2">
            {collabTypes.map(c => (
              <button key={c} type="button"
                onClick={()=>setRound2(s=>{
                  const on = s.collabs.includes(c);
                  const collabs = on ? s.collabs.filter(x=>x!==c) : [...s.collabs, c];
                  return {...s, collabs};
                })}
                className={`px-3 py-2 rounded-full border-2 text-sm ${round2.collabs.includes(c)?'border-yellow-500 bg-yellow-50':'border-gray-300'}`}>
                {c}
              </button>
            ))}
          </div>

          {/* cadence */}
          <div className="flex flex-wrap gap-2">
            {cadence.map(c => (
              <button key={c} type="button"
                onClick={()=>setRound2(s=>{
                  const on = s.cadence.includes(c);
                  const cadence = on ? s.cadence.filter(x=>x!==c) : [...s.cadence, c];
                  return {...s, cadence};
                })}
                className={`px-3 py-2 rounded-full border-2 text-sm ${round2.cadence.includes(c)?'border-yellow-500 bg-yellow-50':'border-gray-300'}`}>
                {c}
              </button>
            ))}
          </div>

          <Button variant="influencer" disabled={!canNext2} onClick={()=>setStep(3)}>Next</Button>
        </div>
      )}

      {step===3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Pick up to 3 prompts (max 1 per group).</p>
            <span className="text-xs text-gray-500">{round3.selected.length} / 3 selected</span>
          </div>

          {Object.entries(storyGroups).map(([group, prompts]) => (
            <div key={group}>
              <p className="text-sm font-medium text-gray-800">{group}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {prompts.map(p => {
                  const on = round3.selected.some(s => s.prompt===p);
                  const groupUsed = round3.selected.some(s => s.group === group);
                  return (
                    <button key={p} type="button"
                      onClick={()=>{
                        setRound3(s=>{
                          if (on) return {...s, selected: s.selected.filter(x=>x.prompt!==p)};
                          if (s.selected.length>=3) return s;
                          if (groupUsed) return s;
                          return {...s, selected: [...s.selected, { group: group as any, prompt: p }]};
                        });
                      }}
                      className={`px-3 py-2 rounded-full border-2 text-sm ${on?'border-yellow-500 bg-yellow-50':'border-gray-300'}`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>onDone()}>Skip for now</Button>
            <Button variant="influencer" disabled={!canFinish} onClick={()=>onDone()}>Finish</Button>
          </div>
        </div>
      )}
    </div>
  );
}
