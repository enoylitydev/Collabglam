// "use client";

// import React from 'react';
// import ModashDashboard from './ModashDashboard';

// function BrowseInf() {
//   return <ModashDashboard />;
// }

// export default BrowseInf;

// app/brand/(protected)/browse-influencer/page.tsx

"use client";
import { Suspense } from 'react';
import ModashDashboard from './ModashDashboard';

export default function BrowseInfluencerPage() {
  return (
    <Suspense fallback={null}>
      <ModashDashboard />
    </Suspense>
  );
}
