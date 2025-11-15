// File: app/brand/(protected)/applied-influencers/page.tsx
"use client";

import React, { Suspense, lazy } from "react";
import MediaKitPage from "./viewMediaKit";

export default function appliedInfluencer() {
    return (
    <div>
      <Suspense fallback={<div>Loading Media-Kit</div>}>
        <MediaKitPage/>
      </Suspense>
    </div>
  );
}
