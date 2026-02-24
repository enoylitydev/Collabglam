// File: app/brand/(protected)/applied-influencers/page.tsx
"use client";

import React, { Suspense, lazy } from "react";
import AppliedInfluencersPage from "./appliedInfluencer";

export default function appliedInfluencer() {

  return (
    <div>
      <Suspense fallback={<div>Loading influencers…</div>}>
        <AppliedInfluencersPage/>
      </Suspense>
    </div>
  );
}
