"use client";

import React, { Suspense, lazy } from "react";
import InfluencerReportPage from "./Influencer";

export default function activeInfluencer() {
    return (
    <div>
      <Suspense fallback={<div>Loading Influencers</div>}>
        <InfluencerReportPage/>
      </Suspense>
    </div>
  );
}
