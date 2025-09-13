import React, { useState } from 'react';
import { Bug } from 'lucide-react';

interface RawJsonProps {
  data: any;
}

export const RawJson: React.FC<RawJsonProps> = ({ data }) => (
  <pre className="max-h-[360px] overflow-auto rounded-lg bg-gray-900 text-gray-100 text-xs p-3 whitespace-pre-wrap">
    {JSON.stringify(data ?? { note: "No payload available yet" }, null, 2)}
  </pre>
);

interface DebugToggleProps {
  label: string;
  render: () => React.ReactNode;
}

export const DebugToggle: React.FC<DebugToggleProps> = ({ label, render }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="space-y-2">
      <button 
        onClick={() => setOpen(v => !v)} 
        className="inline-flex items-center gap-2 text-xs rounded px-2 py-1 border bg-white hover:bg-gray-50 transition-colors"
      >
        <Bug className="h-3.5 w-3.5" /> 
        {label} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="w-full">
          {render()}
        </div>
      )}
    </div>
  );
};