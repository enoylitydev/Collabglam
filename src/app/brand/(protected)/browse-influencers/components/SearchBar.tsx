// =============================================
// === file: app/brand/browse-influencers/components/SearchBar.tsx
// =============================================
import React from "react";
import { Loader2, Search } from "lucide-react";


export function SearchBar({ value, onChange, onSubmit, loading }: { value: string; onChange: (v: string) => void; onSubmit: () => void; loading?: boolean; }) {
return (
<div className="flex gap-2">
<div className="flex-1 min-w-[220px]">
<input
className="h-12 w-full rounded-xl border border-gray-200 px-4 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
placeholder="Search creators by name, keyword, @mention or #hashtag…"
value={value}
onChange={(e) => onChange(e.target.value)}
onKeyDown={(e) => e.key === "Enter" && onSubmit()}
/>
</div>
<button
onClick={onSubmit}
disabled={!!loading}
className="inline-flex items-center gap-2 rounded-xl px-4 md:px-5 h-12 text-sm font-medium text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] disabled:opacity-50"
>
{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
{loading ? "Searching…" : "Search"}
</button>
</div>
);
}